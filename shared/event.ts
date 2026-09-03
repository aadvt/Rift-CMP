export type AnalyticsEventType = "page_view" | "session_start" | "custom";

/**
 * Hard bounds on the event envelope.
 *
 * Every other write endpoint on the API bounds its string inputs; ingestion did
 * not, which made it the one browser-facing route where a public key — a
 * credential that ships in page source and is therefore held by everybody —
 * could write an unbounded string, an unbounded property object, or an
 * unbounded batch straight into Postgres. Not a vulnerability with a name, just
 * the absence of a ceiling on the highest-volume endpoint in the system.
 *
 * These live in `shared/` rather than in the route because they are part of the
 * contract, not an implementation detail: the SDK needs to know what it may not
 * send, and the API needs to enforce it.
 *
 * Both sides read them. The API enforces every bound and is the authority; the
 * SDK checks the subset visible at the `track()` call site (`sdk/src/validate.ts`)
 * and refuses locally, which is a diagnostic rather than a control — that code
 * runs in the caller's browser and can be skipped.
 *
 * Values are chosen to sit well clear of real traffic — 2048 is the practical
 * ceiling browsers place on a URL, and 100 events is ten times the SDK's own
 * `MAX_BATCH_SIZE` — so that hitting one means something is wrong rather than
 * merely large.
 */
export const EVENT_LIMITS = {
  /** Bytes of raw request body accepted by `POST /api/v1/events`. */
  bodyBytes: 1_048_576,
  /** Events in a single batch. The SDK sends at most 10. */
  batchSize: 100,
  /** `site_id`, `session_id` — opaque identifiers, matched to `principal_external_id`. */
  identifier: 200,
  /** `event_type` is an enum, but `name` is caller-supplied. */
  name: 120,
  /** `source`, e.g. `rift-cmp-sdk/0.1.0`. */
  source: 80,
  /** `payload.page.url` and `payload.referrer`. */
  url: 2048,
  /** `payload.page.title`. */
  title: 300,
  /** `payload.device.*` — derived from the user agent, so short by construction. */
  deviceField: 120,
  /** Keys in `payload.properties`. */
  propertyKeys: 100,
  /** Length of a single property key. */
  propertyKeyLength: 100,
  /** Serialised size of the whole `payload.properties` object, in bytes. */
  propertiesBytes: 8192,
} as const;

export interface AnalyticsEventPayload {
  page: {
    url: string;
    title: string;
  };
  device: {
    type: string;
    browser: string;
    os: string;
  };
  // Always present, per docs/event-schema.md; null when there is no referrer.
  // The API still accepts a missing referrer and normalises it to null, so an
  // older SDK build does not start failing validation.
  referrer: string | null;
  properties?: Record<string, unknown>;
}

export interface AnalyticsEvent {
  event_id: string;
  site_id: string;
  session_id: string;
  event_type: AnalyticsEventType;
  name?: string;
  event_time: string;
  schema_version: number;
  source: string;
  payload: AnalyticsEventPayload;
}
