import type { AnalyticsEvent, AnalyticsEventType } from "@rift-cmp/shared";

export type EventName = string;

export type ConsentCheck = (purpose: string) => boolean;

export type SDKOptions = {
  apiUrl?: string;
};

export type SessionState = {
  sessionId: string;
  lastActivity: number;
};

export type InternalEvent = Omit<AnalyticsEvent, "event_type" | "name" | "payload"> & {
  event_type: AnalyticsEventType;
  name?: string;
  payload: AnalyticsEvent["payload"];
};
