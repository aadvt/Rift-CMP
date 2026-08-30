import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "database";
import type { AnalyticsEvent } from "@rift-cmp/shared";
import { jsonError, setCorsHeaders } from "@/lib/cors";

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
  let payload: unknown;

  const authHeader = request.headers.get("authorization") ?? "";
  const authMatch = /^Bearer\s+(.+)$/i.exec(authHeader);
  const publicKey = authMatch?.[1]?.trim();

  if (!publicKey) {
    return jsonError("unauthorized", "Missing Authorization: Bearer <public_key> header.", [], 401);
  }

  try {
    payload = await request.json();
  } catch {
    return jsonError("invalid_json", "Request body must be valid JSON.");
  }

  const rawEvents = Array.isArray((payload as { events?: unknown[] })?.events)
    ? (payload as { events: unknown[] }).events
    : [payload];

  const validatedEvents: AnalyticsEvent[] = [];
  const rejectedEvents: Array<{ code: string; message: string }> = [];
  const seenEventIds = new Set<string>();

  for (const rawEvent of rawEvents) {
    const parsed = eventSchema.safeParse(rawEvent);

    if (!parsed.success) {
      rejectedEvents.push({
        code: "invalid_event",
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      continue;
    }

    const event = parsed.data as AnalyticsEvent;
    if (seenEventIds.has(event.event_id)) {
      rejectedEvents.push({
        code: "duplicate_event",
        message: `Duplicate event_id: ${event.event_id}`,
      });
      continue;
    }

    seenEventIds.add(event.event_id);
    validatedEvents.push(event);
  }

  if (validatedEvents.length === 0 && rejectedEvents.length > 0) {
    return jsonError("invalid_request", "One or more events are invalid.", rejectedEvents);
  }

  const siteIds = [...new Set(validatedEvents.map((event) => event.site_id))];

  let websites: Array<{ id: string; isActive: boolean }>;
  try {
    websites = await prisma.website.findMany({
      where: { id: { in: siteIds }, publicKey },
      select: { id: true, isActive: true },
    });
  } catch (error) {
    console.error("[rift-cmp] failed to look up websites", error);
    return jsonError("ingest_failed", "Failed to verify site credentials.", [], 500);
  }

  const websiteById = new Map(websites.map((website) => [website.id, website]));

  for (const siteId of siteIds) {
    const website = websiteById.get(siteId);

    // A site_id that does not exist and a site_id whose public_key does not
    // match are deliberately indistinguishable: both return 401. Reporting 404
    // for the former would let a caller enumerate valid site IDs. See
    // docs/architecture.md and docs/integration-contract.md, which define 401
    // for bad keys and 403 for inactive sites, and no 404.
    if (!website) {
      return jsonError("unauthorized", `Website not authorized for site_id: ${siteId}.`, [], 401);
    }

    if (!website.isActive) {
      return jsonError("forbidden", `Website is inactive for site_id: ${siteId}.`, [], 403);
    }
  }

  const accepted = validatedEvents.length;

  try {
    // One transaction for the whole batch: a mid-batch failure must not leave
    // some events persisted and others dropped.
    await prisma.$transaction(
      validatedEvents.flatMap((event) => {
        const eventTime = new Date(event.event_time);
        const properties = event.payload.properties
          ? (event.payload.properties as Prisma.InputJsonValue)
          : Prisma.JsonNull;

        return [
          prisma.session.upsert({
            where: { id: event.session_id },
            update: { lastActivity: eventTime },
            create: {
              id: event.session_id,
              siteId: event.site_id,
              startedAt: eventTime,
              lastActivity: eventTime,
            },
          }),
          // Idempotent by event_id: a replayed event is a no-op update rather
          // than a second row, per docs/api-spec.md.
          prisma.event.upsert({
            where: { eventId: event.event_id },
            update: {},
            create: {
              eventId: event.event_id,
              siteId: event.site_id,
              sessionId: event.session_id,
              eventType: event.event_type,
              name: event.name ?? null,
              eventTime,
              pageUrl: event.payload.page.url,
              pageTitle: event.payload.page.title,
              referrer: event.payload.referrer ?? null,
              deviceType: event.payload.device.type,
              browser: event.payload.device.browser,
              os: event.payload.device.os,
              properties,
            },
          }),
        ];
      }),
    );
  } catch (error) {
    // Without this the handler would throw, and Next's default 500 carries no
    // CORS headers — a browser would see an opaque CORS failure instead of a
    // server error, and the SDK could not read the status to decide on retry.
    console.error("[rift-cmp] failed to persist events", error);
    return jsonError("ingest_failed", "Failed to persist events.", [], 500);
  }

  return setCorsHeaders(
    Response.json(
      {
        accepted,
        rejected: rejectedEvents.length,
        errors: rejectedEvents,
      },
      { status: 202 },
    ),
  );
}
