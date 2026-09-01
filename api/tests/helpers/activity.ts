import { randomUUID } from "node:crypto";
import { prisma } from "database";

/**
 * Seeds analytics activity directly.
 *
 * The ingestion path is covered thoroughly by `ingest-*.test.ts`; these fixtures
 * exist to give the read models something to aggregate, so they write rows
 * directly rather than paying a network round trip per event.
 */

export interface ActivitySpec {
  siteId: string;
  /** One session is created per entry, with its events. */
  sessions: Array<{
    startedAt: Date;
    device?: string;
    browser?: string;
    os?: string;
    pages?: Array<{ url: string; title: string; at?: Date }>;
    customEvents?: number;
  }>;
}

export async function seedActivity(spec: ActivitySpec): Promise<void> {
  for (const session of spec.sessions) {
    const sessionId = randomUUID();
    const device = session.device ?? "desktop";
    const browser = session.browser ?? "Chrome";
    const os = session.os ?? "Windows";
    const pages = session.pages ?? [{ url: "https://example.com/", title: "Home" }];

    await prisma.session.create({
      data: {
        id: sessionId,
        siteId: spec.siteId,
        startedAt: session.startedAt,
        lastActivity: session.startedAt,
      },
    });

    const common = {
      siteId: spec.siteId,
      sessionId,
      deviceType: device,
      browser,
      os,
      referrer: null,
    };

    const rows = [
      {
        ...common,
        eventId: randomUUID(),
        eventType: "session_start",
        name: "session_start",
        eventTime: session.startedAt,
        pageUrl: pages[0].url,
        pageTitle: pages[0].title,
      },
      ...pages.map((page) => ({
        ...common,
        eventId: randomUUID(),
        eventType: "page_view",
        name: "page_view",
        eventTime: page.at ?? session.startedAt,
        pageUrl: page.url,
        pageTitle: page.title,
      })),
      ...Array.from({ length: session.customEvents ?? 0 }, () => ({
        ...common,
        eventId: randomUUID(),
        eventType: "custom",
        name: "test_click",
        eventTime: session.startedAt,
        pageUrl: pages[0].url,
        pageTitle: pages[0].title,
      })),
    ];

    await prisma.event.createMany({ data: rows });
  }
}

/** A fixed reference point, so range assertions are not clock-dependent. */
export const REFERENCE_NOW = new Date("2026-06-15T12:00:00.000Z");

export function daysBefore(days: number, from: Date = REFERENCE_NOW): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}
