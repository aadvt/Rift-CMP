import { AnalyticsClient } from "./client";
import { ConsentClient } from "./consent";
import type { ConsentApi } from "./consent";
import type { ConsentCheck, SDKOptions } from "./types";

const state = {
  client: null as AnalyticsClient | null,
  consent: null as ConsentClient | null,
  siteId: null as string | null,
  publicKey: null as string | null,
  consentCheck: (() => true) as (purpose: string) => boolean,
};

function getClient(siteId?: string, publicKey?: string, options?: SDKOptions) {
  // Re-initialising with different credentials must not keep sending events
  // under the previous site's key, so the client is rebuilt from scratch.
  if (state.client && siteId && publicKey) {
    const siteChanged = state.siteId !== siteId;
    const keyChanged = state.publicKey !== publicKey;
    if (siteChanged || keyChanged) {
      state.client = null;
      // The consent client authenticates with the same key against the same
      // site, so it is only ever as valid as the analytics client beside it.
      state.consent = null;
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
    state.consent = new ConsentClient(siteId, publicKey, options);
    state.siteId = siteId;
    state.publicKey = publicKey;
    // A consent check registered before init() must also gate the automatic
    // session_start / page_view events that init() emits, not just track().
    state.client.setConsentCheck(state.consentCheck);
  }
  return state.client;
}

function warnUninitialised(method: string) {
  console.warn(
    `[rift-cmp] analytics.consent.${method}() failed`,
    new Error("analytics.init(siteId, publicKey, options) must be called before use."),
  );
}

/**
 * Stands in for the real client before `init()`.
 *
 * `analytics.consent.isGranted(...)` is the sort of call a page makes during
 * first paint, potentially before the snippet has initialised. It degrades the
 * same way `analytics.track()` does - warn, deny, carry on - because throwing
 * out of a consent check would take the host page down with it.
 */
const uninitialisedConsent: ConsentApi = {
  async getState() {
    warnUninitialised("getState");
    return [];
  },
  getCachedState() {
    warnUninitialised("getCachedState");
    return [];
  },
  isGranted() {
    warnUninitialised("isGranted");
    return false;
  },
  async record() {
    warnUninitialised("record");
    return false;
  },
  async grant() {
    warnUninitialised("grant");
    return false;
  },
  async deny() {
    warnUninitialised("deny");
    return false;
  },
  async withdraw() {
    warnUninitialised("withdraw");
    return false;
  },
  onChange() {
    warnUninitialised("onChange");
    return () => {};
  },
  getPrincipalId() {
    warnUninitialised("getPrincipalId");
    return null;
  },
  clear() {
    warnUninitialised("clear");
  },
};

const analytics = {
  /**
   * The consent client for this site.
   *
   * Deliberately *not* wired into the event consent gate by default - the SDK
   * does not decide that analytics requires consent, an integrator does:
   *
   * ```js
   * analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
   * ```
   */
  get consent(): ConsentApi {
    return state.consent ?? uninitialisedConsent;
  },
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
export { ConsentClient } from "./consent";
export type { ConsentApi, ConsentChangeListener, ConsentRecordOptions } from "./consent";
export type { ConsentStatus, EffectiveConsent } from "@rift-cmp/shared";

if (typeof window !== "undefined") {
  (window as typeof window & { analytics?: typeof analytics }).analytics = analytics;
}
