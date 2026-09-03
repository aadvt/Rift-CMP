import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "database";
import type { AnalyticsEvent, ApiErrorDetail, IngestResponse } from "@rift-cmp/shared";
import { jsonError, setCorsHeaders } from "@/lib/cors";
import { enforceAnalyticsConsent, guardIngest } from "@/lib/ingest-guard";

const eventSchema = z.object({
  event_id: z.string().uuid(),
  site_id: z.string().min(1),
  session_id: z.string().min(1),
  event_type: z.enum(["page_view", "session_start", "custom"]),
  name: z.string().optional(),
  event_time: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "event_time must be a valid RFC3339 timestamp",
  }),
  schema_version: z.number().int().min(1),
  source: z.string().min(1),
  payload: z.object({
    page: z.object({
      url: z.string().min(1),
      title: z.string().min(1),
    }),
    device: z.object({
      type: z.string().min(1),
      browser: z.string().min(1),
      os: z.string().min(1),
    }),
    referrer: z.string().nullable().optional(),
    properties: z.record(z.string(), z.any()).optional(),
  }),
});

export async function OPTIONS() {
  return setCorsHeaders(new Response(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  // The public key alone determines which site this request may write to.
  // `site_id` in the body is checked against it, never used to select the site.
  const guard = await guardIngest(request, {
    limit: "events",
    siteCeiling: "eventsPerSite",
    route: "events",
  });
  if (!guard.ok) return guard.response;
  const { caller, allowOrigin } = guard.guarded;
  const { siteId } = caller;

  // Server-side consent enforcement, for sites that have asked for it. The SDK
  // gates events client-side too, and that gate is a convenience for honest
  // integrators - it is not evidence, because the code enforcing it is code the
  // caller controls. See `enforceAnalyticsConsent` for what is actually checked.
  const consent = await enforceAnalyticsConsent(request, caller, allowOrigin);
  if (!consent.ok) return consent.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("invalid_json", "Request body must be valid JSON.", [], 400, { allowOrigin });
  }

  const rawEvents = Array.isArray((payload as { events?: unknown[] })?.events)
    ? (payload as { events: unknown[] }).events
    : [payload];

  const candidates: AnalyticsEvent[] = [];
  const rejected: ApiErrorDetail[] = [];
  const seenEventIds = new Set<string>();

  for (const rawEvent of rawEvents) {
    const parsed = eventSchema.safeParse(rawEvent);

    if (!parsed.success) {
      rejected.push({
        code: "invalid_event",
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      continue;
    }

    const event = parsed.data as AnalyticsEvent;

    // Tamper check: a batch may only contain events for the authenticated site.
    if (event.site_id !== siteId) {
      rejected.push({
        code: "site_mismatch",
        message: `Event ${event.event_id} declares site_id "${event.site_id}", which this key does not authorise.`,
      });
      continue;
    }

    if (seenEventIds.has(event.event_id)) {
      rejected.push({
        code: "duplicate_event",
        message: `Duplicate event_id: ${event.event_id}`,
      });
      continue;
    }

    seenEventIds.add(event.event_id);
    candidates.push(event);
  }

  // A session id belonging to another site must not be written into, or
  // attached to. The composite foreign key on `events` backs this up in the
  // database, but rejecting here gives the caller a precise error.
  const foreignSessionIds = new Set(
    candidates.length === 0
      ? []
      : (
          await prisma.session.findMany({
            where: { id: { in: [...new Set(candidates.map((event) => event.session_id))] } },
            select: { id: true, siteId: true },
          })
        )
          .filter((session) => session.siteId !== siteId)
          .map((session) => session.id),
  );

  const accepted = candidates.filter((event) => {
    if (foreignSessionIds.has(event.session_id)) {
      rejected.push({
        code: "session_conflict",
        message: `Session ${event.session_id} belongs to a different site.`,
      });
      return false;
    }
    return true;
  });

  if (accepted.length === 0 && rejected.length > 0) {
    return jsonError("invalid_request", "One or more events are invalid.", rejected, 400, {
      allowOrigin,
    });
  }

  if (accepted.length > 0) {
    try {
      await persistBatch(siteId, accepted);
    } catch (error) {
      // Without this the handler would throw, and Next's default 500 carries no
      // CORS headers - a browser would see an opaque CORS failure instead of a
      // server error, and the SDK could not read the status to decide on retry.
      console.error("[rift-cmp] failed to persist events", error);
      return jsonError("ingest_failed", "Failed to persist events.", [], 500, { allowOrigin });
    }
  }

  const body: IngestResponse = {
    accepted: accepted.length,
    rejected: rejected.length,
    errors: rejected,
  };

  return setCorsHeaders(Response.json(body, { status: 202 }), allowOrigin);
}

/**
 * Writes a validated, single-site batch.
 *
 * Both inserts use `skipDuplicates`, which makes ingestion idempotent: replaying
 * a batch (the SDK retries, and an unload flush can repeat) is a no-op rather
 * than a duplicate row. Events are an immutable log, so the first write of an
 * `event_id` wins and later copies are ignored.
 */
async function persistBatch(siteId: string, events: AnalyticsEvent[]) {
  const sessions = new Map<string, { startedAt: Date; lastActivity: Date }>();

  for (const event of events) {
    const at = new Date(event.event_time);
    const existing = sessions.get(event.session_id);
    if (!existing) {
      sessions.set(event.session_id, { startedAt: at, lastActivity: at });
      continue;
    }
    if (at < existing.startedAt) existing.startedAt = at;
    if (at > existing.lastActivity) existing.lastActivity = at;
  }

  await prisma.$transaction([
    prisma.session.createMany({
      data: [...sessions].map(([id, times]) => ({ id, siteId, ...times })),
      skipDuplicates: true,
    }),

    // Scoped to `siteId` so a session can never be advanced by another tenant,
    // and guarded on `lt` so out-of-order events cannot move activity backwards.
    ...[...sessions].map(([id, times]) =>
      prisma.session.updateMany({
        where: { id, siteId, lastActivity: { lt: times.lastActivity } },
        data: { lastActivity: times.lastActivity },
      }),
    ),

    prisma.event.createMany({
      data: events.map((event) => ({
        id: event.event_id,
        eventId: event.event_id,
        siteId,
        sessionId: event.session_id,
        eventType: event.event_type,
        name: event.name ?? null,
        eventTime: new Date(event.event_time),
        pageUrl: event.payload.page.url,
        pageTitle: event.payload.page.title,
        referrer: event.payload.referrer ?? null,
        deviceType: event.payload.device.type,
        browser: event.payload.device.browser,
        os: event.payload.device.os,
        properties: event.payload.properties
          ? (event.payload.properties as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      })),
      skipDuplicates: true,
    }),
  ]);
}
