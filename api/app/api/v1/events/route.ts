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

const batchSchema = z.object({
  events: z.array(eventSchema),
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

  const siteIds = new Set(validatedEvents.map((event) => event.site_id));

  for (const siteId of siteIds) {
    const website = await prisma.website.findFirst({
      where: { id: siteId, publicKey },
      select: { id: true, isActive: true },
    });

    if (!website) {
      return jsonError("unauthorized", `Website not authorized for site_id: ${siteId}.`, [], 401);
    }

    if (!website.isActive) {
      return jsonError("forbidden", `Website is inactive for site_id: ${siteId}.`, [], 403);
    }
  }

  const accepted = validatedEvents.length;

  for (const event of validatedEvents) {
    const session = await prisma.session.upsert({
      where: { id: event.session_id },
      update: { lastActivity: new Date(event.event_time) },
      create: {
        id: event.session_id,
        siteId: event.site_id,
        startedAt: new Date(event.event_time),
        lastActivity: new Date(event.event_time),
      },
    });

    const properties = event.payload.properties
      ? (event.payload.properties as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    await prisma.event.upsert({
      where: { eventId: event.event_id },
      update: {
        siteId: event.site_id,
        sessionId: session.id,
        eventType: event.event_type,
        name: event.name ?? null,
        eventTime: new Date(event.event_time),
        pageUrl: event.payload.page.url,
        pageTitle: event.payload.page.title,
        referrer: event.payload.referrer ?? null,
        deviceType: event.payload.device.type,
        browser: event.payload.device.browser,
        os: event.payload.device.os,
        properties,
      },
      create: {
        id: event.event_id,
        eventId: event.event_id,
        siteId: event.site_id,
        sessionId: session.id,
        eventType: event.event_type,
        name: event.name ?? null,
        eventTime: new Date(event.event_time),
        pageUrl: event.payload.page.url,
        pageTitle: event.payload.page.title,
        referrer: event.payload.referrer ?? null,
        deviceType: event.payload.device.type,
        browser: event.payload.device.browser,
        os: event.payload.device.os,
        properties,
      },
    });
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
