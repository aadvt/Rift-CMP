import { AnalyticsClient } from "./client";
import type { ConsentCheck, SDKOptions } from "./types";

const state = {
  client: null as AnalyticsClient | null,
  consentCheck: (() => true) as (purpose: string) => boolean,
};

function getClient(siteId?: string, publicKey?: string, options?: SDKOptions) {
  const current = state.client as (AnalyticsClient & { siteId?: string | null; publicKey?: string | null }) | null;

  if (current && siteId && publicKey) {
    const siteChanged = current.siteId !== siteId;
    const keyChanged = current.publicKey !== publicKey;
    if (siteChanged || keyChanged) {
      state.client = null;
    }
  }

  if (!state.client) {
    if (!siteId) {
      throw new Error("analytics.init(siteId, publicKey, options) must be called before use.");
    }
    if (!publicKey) {
      throw new Error("analytics.init(siteId, publicKey, options) requires a publicKey.");
    }
    state.client = new AnalyticsClient(siteId, publicKey, options);
  }
  return state.client;
}

const analytics = {
  init(siteId: string, publicKeyOrOptions?: string | SDKOptions, maybeOptions?: SDKOptions) {
    try {
      const publicKey = typeof publicKeyOrOptions === "string" ? publicKeyOrOptions : undefined;
      const options = typeof publicKeyOrOptions === "string" ? maybeOptions : publicKeyOrOptions;

      if (!publicKey && options && "publicKey" in options && typeof (options as { publicKey?: string }).publicKey === "string") {
        const explicitKey = (options as { publicKey?: string }).publicKey;
        const client = getClient(siteId, explicitKey, options);
        return client.init();
      }

      if (!publicKey) {
        throw new Error("analytics.init(siteId, publicKey, options) requires a publicKey.");
      }

      const client = getClient(siteId, publicKey, options);
      return client.init();
    } catch (error) {
      console.warn("[rift-cmp] analytics.init() failed", error);
      return null;
    }
  },
  setConsentCheck(fn: (purpose: string) => boolean) {
    try {
      state.consentCheck = fn;
      if (state.client) {
        state.client.setConsentCheck(fn);
      }
      return true;
    } catch (error) {
      console.warn("[rift-cmp] setConsentCheck() failed", error);
      return false;
    }
  },
  track(name: string, properties?: Record<string, unknown>) {
    try {
      const client = getClient();
      if (!state.consentCheck("analytics")) {
        return false;
      }
      return client.track(name, properties);
    } catch (error) {
      console.warn("[rift-cmp] analytics.track() failed", error);
      return false;
    }
  },
};

export { analytics };
export default analytics;

export type { ConsentCheck, SDKOptions } from "./types";

if (typeof window !== "undefined") {
  (window as typeof window & { analytics?: typeof analytics }).analytics = analytics;
}
