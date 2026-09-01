export type AnalyticsEventType = "page_view" | "session_start" | "custom";

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
