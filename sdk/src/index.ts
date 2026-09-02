import { AnalyticsClient } from "./client";
import { ConsentClient } from "./consent";
import type { ConsentApi } from "./consent";
import { DiscoveryClient } from "./discovery";
import type { ConsentCheck, SDKOptions } from "./types";

const state = {
  client: null as AnalyticsClient | null,
  consent: null as ConsentClient | null,
  discovery: null as DiscoveryClient | null,
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
      // Discovery observes on behalf of one site; keeping it running after the
      // credentials change would file observations under the wrong tenant.
      state.discovery?.stop();
      state.discovery = null;
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
    state.discovery = new DiscoveryClient(siteId, publicKey, options);
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

/**
 * Resolves a destination host to a declared purpose using the operator's
 * mapping, matching the most specific suffix first so `ads.example.com` can be
 * mapped separately from `example.com`.
 */
function resolveHostPurpose(host: string, mapping: Record<string, string>): string | null {
  const normalised = host.toLowerCase();
  const labels = normalised.split(".");
  for (let i = 0; i < labels.length - 1; i += 1) {
    const candidate = labels.slice(i).join(".");
    if (mapping[candidate]) return mapping[candidate];
  }
  return mapping[normalised] ?? null;
}

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
  /**
   * In-page discovery: what runs on this page, where it sends data, and whether
   * anything fired without consent.
   *
   * Off by default. It wraps `fetch`, `XMLHttpRequest`, `sendBeacon`,
   * `Image.src`, `document.cookie` and `Storage.setItem` to attribute requests
   * to the script that made them, which is a large enough footprint on a
   * customer's page that it must be an explicit opt-in rather than something
   * the tag starts doing on its own:
   *
   * ```js
   * analytics.discovery.start();
   * analytics.discovery.watchConsent((purpose) => analytics.consent.isGranted(purpose));
   * ```
   */
  discovery: {
    /** Begins observing. Returns false if already running or outside a browser. */
    start(): boolean {
      try {
        return state.discovery?.start() ?? false;
      } catch (error) {
        console.warn("[rift-cmp] analytics.discovery.start() failed", error);
        return false;
      }
    },
    /** Stops observing and restores every wrapped browser API. */
    stop(): void {
      try {
        state.discovery?.stop();
      } catch (error) {
        console.warn("[rift-cmp] analytics.discovery.stop() failed", error);
      }
    },
    /**
     * Maps a destination host to the purpose it needs, so a request made while
     * that purpose is not granted is recorded as a violation.
     *
     * The mapping is the operator's, not the SDK's: only the fiduciary knows
     * which of its vendors serve which declared purpose.
     */
    watchConsent(isGranted: (purpose: string) => boolean, hostPurposes: Record<string, string> = {}): boolean {
      try {
        if (!state.discovery) return false;
        state.discovery.setConsentLookup((host) => {
          const purposeCode = resolveHostPurpose(host, hostPurposes);
          if (!purposeCode) return null;
          return {
            purposeCode,
            status: isGranted(purposeCode) ? "GRANTED" : "NOT_GRANTED",
          };
        });
        return true;
      } catch (error) {
        console.warn("[rift-cmp] analytics.discovery.watchConsent() failed", error);
        return false;
      }
    },
    /** Sends what has been observed so far. Normally automatic. */
    async flush(): Promise<boolean> {
      try {
        return (await state.discovery?.flush()) ?? false;
      } catch (error) {
        console.warn("[rift-cmp] analytics.discovery.flush() failed", error);
        return false;
      }
    },
    /** The current observations, without sending them. */
    snapshot() {
      try {
        return state.discovery?.snapshot() ?? null;
      } catch (error) {
        console.warn("[rift-cmp] analytics.discovery.snapshot() failed", error);
        return null;
      }
    },
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
export { DiscoveryClient } from "./discovery";
export type { DiscoveryOptions } from "./discovery";

if (typeof window !== "undefined") {
  (window as typeof window & { analytics?: typeof analytics }).analytics = analytics;
}
