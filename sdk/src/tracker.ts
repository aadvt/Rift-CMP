import type { AnalyticsEvent } from "@rift-cmp/shared";
import type { ConsentCheck, SDKOptions } from "./types";
import { AnalyticsClient } from "./client";

export class Tracker {
  private client: AnalyticsClient;

  constructor(siteId: string, options?: SDKOptions) {
    this.client = new AnalyticsClient(siteId, options);
  }

  init() {
    return this.client.init();
  }

  setConsentCheck(fn: ConsentCheck) {
    this.client.setConsentCheck(fn);
  }

  track(name: string, properties?: Record<string, unknown>) {
    return this.client.track(name, properties);
  }

  buildCustomEvent(name: string, properties?: Record<string, unknown>): AnalyticsEvent {
    return {
      event_id: crypto.randomUUID(),
      site_id: this.client["siteId" as keyof AnalyticsClient] as string,
      session_id: this.client.getSessionId(),
      event_type: "custom",
      name,
      event_time: new Date().toISOString(),
      schema_version: 1,
      source: "rift-cmp-sdk/0.1.0",
      payload: {
        page: {
          url: window.location.href,
          title: document.title,
        },
        device: {
          type: "desktop",
          browser: "Unknown",
          os: "Unknown",
        },
        referrer: document.referrer || null,
        properties: properties ?? {},
      },
    };
  }
}
