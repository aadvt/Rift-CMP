import { AnalyticsClient } from "./client";
import { ConsentClient } from "./consent";
import type { ConsentApi } from "./consent";
import { DiscoveryClient } from "./discovery";
import { ConsentUi } from "./ui";
import type { ConsentCheck, SDKOptions } from "./types";
import { validateTrackInput } from "./validate";
import { DEFAULT_API_URL } from "./constants";

const state = {
  client: null as AnalyticsClient | null,
  consent: null as ConsentClient | null,
  discovery: null as DiscoveryClient | null,
  ui: null as ConsentUi | null,
  siteId: null as string | null,
  publicKey: null as string | null,
  apiUrl: DEFAULT_API_URL as string,
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
      state.ui?.close();
      state.ui = null;
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
    state.apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
    // A consent check registered before init() must also gate the automatic
    // session_start / page_view events that init() emits, not just track().
    state.client.setConsentCheck(state.consentCheck);
    // Sites that enforce consent server-side need the batch to say which
    // principal to look the decision up for. Neither of these mints an identity:
    // a visitor who has never decided anything simply sends no token, and their
    // events are refused, which is what enforcement means.
    state.client.setConsentSessionProvider(
      () => state.consent?.ensureSessionForKnownPrincipal() ?? Promise.resolve(null),
      () => state.consent?.getSessionToken() ?? null,
    );
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
  getSessionToken() {
    warnUninitialised("getSessionToken");
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

/**
 * The UI for the current site, or null before `init()`.
 *
 * Rebuilt when `force` changes so "manage preferences" can reopen a banner the
 * visitor has already answered, without that becoming the default behaviour.
 */
function getUi(force = false): ConsentUi | null {
  if (!state.consent || !state.siteId || !state.publicKey) return null;
  state.ui = new ConsentUi(state.consent, {
    apiUrl: state.apiUrl,
    publicKey: state.publicKey,
    force,
  });
  return state.ui;
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
  /**
   * The consent banner and preference centre.
   *
   * Opt-in, like discovery. A tag that drew a dialog over a customer's page the
   * moment it loaded would be a surprising thing for a script to do on its own,
   * and an operator who has not declared any purposes has nothing to show.
   *
   * ```js
   * analytics.init("site_x", "pk_x");
   * analytics.banner.show();                 // only if something is undecided
   * analytics.banner.showPreferences();      // "cookie settings" link
   * ```
   *
   * The UI renders a configuration the server built and records decisions
   * through `analytics.consent`. It holds no legal rule of its own.
   */
  banner: {
    /**
     * Shows the banner when any non-essential purpose is still undecided.
     *
     * Resolves `false` when there is nothing to ask - the site declares no
     * purposes, the configuration could not be fetched, or every purpose
     * already has a decision. Silence is never read as a decision.
     */
    async show(options: { force?: boolean } = {}): Promise<boolean> {
      try {
        const ui = getUi(options.force);
        if (!ui) return false;
        return await ui.showBannerIfNeeded();
      } catch (error) {
        console.warn("[rift-cmp] analytics.banner.show() failed", error);
        return false;
      }
    },
    /** Opens the preference centre, with the current decisions reflected. */
    async showPreferences(): Promise<boolean> {
      try {
        const ui = getUi(true);
        if (!ui) return false;
        return await ui.showPreferences();
      } catch (error) {
        console.warn("[rift-cmp] analytics.banner.showPreferences() failed", error);
        return false;
      }
    },
    /** Closes whatever is open. Records nothing. */
    close(): boolean {
      try {
        state.ui?.close();
        return true;
      } catch {
        return false;
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
  /**
   * Queues a custom event.
   *
   * Returns `false` synchronously when the event is refused before it is built —
   * the consent gate denied it, or it failed the bounds in `EVENT_LIMITS` — and
   * a `Promise<boolean>` once it reaches the client. That split is pre-existing
   * (the consent gate has always returned a bare `false`) and is preserved here
   * rather than smoothed over, because changing it would be a breaking change to
   * every caller that branches on the result. `await` handles both.
   */
  track(name: string, properties?: Record<string, unknown>) {
    try {
      const client = getClient();
      if (!state.consentCheck("analytics")) {
        return false;
      }
      // Checked before queueing, so an over-limit event is not persisted to
      // localStorage, not retried, and not counted against the batch. The API
      // re-checks all of it: this is a diagnostic, not the enforcement.
      const validation = validateTrackInput(name, properties);
      if (!validation.ok) {
        console.warn(
          `[rift-cmp] analytics.track() rejected locally: ${validation.reason}. ` +
            "The event was not queued. Bounds are in shared/event.ts (EVENT_LIMITS).",
        );
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

export type {
  ConsentCheck,
  ConsentSessionProvider,
  SDKOptions,
  SyncConsentSessionProvider,
} from "./types";
export { ConsentClient } from "./consent";
export type { ConsentApi, ConsentChangeListener, ConsentRecordOptions } from "./consent";
export type { ConsentStatus, EffectiveConsent } from "@rift-cmp/shared";
export { DiscoveryClient } from "./discovery";
export { ConsentUi } from "./ui";
export type { ConsentUiOptions } from "./ui";
export type { DiscoveryOptions } from "./discovery";

/**
 * Publishes the callable SDK as `window.analytics`.
 *
 * This is the **only** thing that may claim the name `analytics`. The IIFE build
 * is deliberately given an internal global name (`__riftCmpBundle` in
 * `package.json`) rather than `analytics`, because a bundler's `--global-name`
 * emits `var <name> = (() => { … })()` at script top level, and under classic
 * `<script>` semantics that assignment runs *after* this module body and would
 * overwrite the line below with the module namespace — leaving `analytics.init`
 * undefined and breaking the install snippet the dashboard hands operators.
 *
 * So the two must not share a name. Renaming the build global is the fix;
 * `docs/sdk-api.md` records why.
 */
if (typeof window !== "undefined") {
  (window as typeof window & { analytics?: typeof analytics }).analytics = analytics;
}
