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
  referrer?: string | null;
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
