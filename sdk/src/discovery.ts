import type {
  ComponentKind,
  DiscoveredDestination,
  DiscoveredStorageItem,
  DiscoveredViolation,
  DiscoveryReport,
  StorageKind,
} from "@rift-cmp/shared";
import { DEFAULT_API_URL } from "./constants";
import type { SDKOptions } from "./types";

/**
 * In-page discovery: what is running on this page, where it sends data, and
 * whether any of it fired without consent.
 *
 * ## How attribution works
 *
 * `PerformanceResourceTiming` tells you a request happened and what kind it was,
 * but not which script caused it. To answer "which component", the client wraps
 * the four APIs a tag can use to reach the network - `fetch`, `XMLHttpRequest`,
 * `sendBeacon` and `Image.src` - and captures a stack trace at the call site.
 * The first frame that is not this SDK is the responsible script.
 *
 * Wrapping is additive and defensive: every wrapper calls through to the
 * original, and every callback is wrapped in try/catch. A discovery bug must
 * never break the customer's website, so failure here degrades to "we observed
 * less", never to a thrown error on the host page.
 *
 * `PerformanceObserver` runs alongside as a backstop, catching requests made by
 * markup the wrappers never see - an `<img>` in the served HTML, a stylesheet,
 * a font. Those are recorded with a null initiator rather than guessed at.
 *
 * ## Privacy
 *
 * Only hostname, a truncated path, and storage *key names* ever leave the page.
 * Query strings, fragments, request bodies and stored values are stripped at
 * the point of capture, not at the point of send, so they are never held in
 * memory as part of a report.
 */

const SCHEMA_VERSION = 1;
const SDK_SOURCE = "rift-cmp-sdk/0.1.0";
/** Reports are flushed on this cadence, then once more on unload. */
const FLUSH_INTERVAL_MS = 10_000;
/** A page that contacts more hosts than this is almost certainly in a loop. */
const MAX_DESTINATIONS = 200;
const MAX_STORAGE_ITEMS = 200;
const MAX_VIOLATIONS = 100;
const MAX_PATH_LENGTH = 120;

type ConsentLookup = (host: string) => { purposeCode: string; status: string } | null;

export interface DiscoveryOptions extends SDKOptions {
  /**
   * Resolves a destination host to the purpose it needs and the principal's
   * current status for that purpose. Returning null means "no opinion", which
   * is the default - the SDK does not decide which vendors map to which
   * purposes, the operator does.
   */
  consentLookup?: ConsentLookup;
}

interface DestinationRecord extends DiscoveredDestination {}

/** Strips everything after the path. Identifiers live in query strings. */
function safePath(pathname: string): string | null {
  if (!pathname || pathname === "/") return null;
  return pathname.length > MAX_PATH_LENGTH ? `${pathname.slice(0, MAX_PATH_LENGTH)}…` : pathname;
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw, typeof location !== "undefined" ? location.href : undefined);
  } catch {
    return null;
  }
}

/**
 * Walks a stack trace for the first frame outside this SDK.
 *
 * Reported as `host/file` rather than the full URL: the file name is what
 * identifies the component, and the rest is noise that could carry a token.
 */
function attributeCaller(): string | null {
  try {
    const stack = new Error().stack;
    if (!stack) return null;

    for (const line of stack.split("\n").slice(1)) {
      // Stack frames end in `:line:column`, which has to come off - but the URL
      // itself may legitimately carry a `:port`, so the suffix is stripped by
      // shape rather than by cutting at the first colon.
      const match = /(https?:\/\/[^\s)]+)/.exec(line);
      if (!match) continue;
      const cleaned = match[1].replace(/:\d+(?::\d+)?\)?$/, "");
      const url = parseUrl(cleaned);
      if (!url) continue;
      // Skip the SDK's own frames; we want the caller, not ourselves.
      if (/rift|index\.global\.js/i.test(url.pathname)) continue;
      const file = url.pathname.split("/").filter(Boolean).pop();
      return file ? `${url.host}/${file}` : url.host;
    }
  } catch {
    // A browser that formats stacks differently just yields no attribution.
  }
  return null;
}

function initiatorTypeToKind(initiatorType: string): ComponentKind {
  switch (initiatorType) {
    case "script":
      return "script";
    case "img":
    case "image":
    case "input":
      return "image";
    case "iframe":
    case "frame":
      return "iframe";
    case "fetch":
      return "fetch";
    case "xmlhttprequest":
      return "xhr";
    case "beacon":
      return "beacon";
    case "css":
    case "link":
      return "stylesheet";
    case "video":
    case "audio":
      return "media";
    default:
      return "other";
  }
}

export class DiscoveryClient {
  private readonly siteId: string;
  private readonly publicKey: string;
  private readonly apiUrl: string;
  private consentLookup: ConsentLookup | null;

  private destinations = new Map<string, DestinationRecord>();
  private storage = new Map<string, DiscoveredStorageItem>();
  private violations: DiscoveredViolation[] = [];

  private started = false;
  private flushTimer: number | null = null;
  private restore: Array<() => void> = [];

  constructor(siteId: string, publicKey: string, options: DiscoveryOptions = {}) {
    this.siteId = siteId;
    this.publicKey = publicKey;
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.consentLookup = options.consentLookup ?? null;
  }

  /**
   * Begins observing. Idempotent, and a no-op outside a browser so that
   * server-rendered imports of the SDK stay inert.
   */
  start(): boolean {
    if (this.started || typeof window === "undefined") return false;
    this.started = true;

    try {
      this.instrumentFetch();
      this.instrumentXhr();
      this.instrumentBeacon();
      this.instrumentImage();
      this.observeResources();
      this.observeStorage();
      this.observeInjectedNodes();
      this.scheduleFlush();
      this.registerUnloadFlush();
    } catch (error) {
      console.warn("[rift-cmp] discovery failed to start", error);
    }
    return true;
  }

  /** Stops observing and restores every wrapped API. */
  stop() {
    for (const undo of this.restore.splice(0)) {
      try {
        undo();
      } catch {
        // Restoring is best-effort; a failure here must not throw.
      }
    }
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.started = false;
  }

  setConsentLookup(fn: ConsentLookup) {
    this.consentLookup = fn;
  }

  /** The report as it stands, for callers that want to inspect before sending. */
  snapshot(): DiscoveryReport {
    const page = typeof location !== "undefined" ? parseUrl(location.href) : null;
    return {
      site_id: this.siteId,
      page_url: page ? `${page.origin}${page.pathname}` : "unknown",
      collected_at: new Date().toISOString(),
      schema_version: SCHEMA_VERSION,
      source: SDK_SOURCE,
      destinations: [...this.destinations.values()],
      storage: [...this.storage.values()],
      violations: [...this.violations],
    };
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  private record(rawUrl: string | undefined, kind: ComponentKind, initiator: string | null) {
    try {
      if (!rawUrl) return;
      const url = parseUrl(rawUrl);
      if (!url || !/^https?:$/.test(url.protocol)) return;

      // Never catalogue calls to our own ingestion API; that is us, not the
      // customer's site, and it would appear as a tracker on every page.
      if (this.apiUrl && url.href.startsWith(this.apiUrl)) return;

      const key = `${url.host}|${kind}`;
      const existing = this.destinations.get(key);

      if (existing) {
        existing.request_count += 1;
        if (!existing.initiator && initiator) existing.initiator = initiator;
        return;
      }

      if (this.destinations.size >= MAX_DESTINATIONS) return;

      const thirdParty = typeof location !== "undefined" && url.host !== location.host;
      this.destinations.set(key, {
        host: url.host,
        kind,
        initiator,
        sample_path: safePath(url.pathname),
        third_party: thirdParty,
        request_count: 1,
        first_seen: new Date().toISOString(),
      });

      if (thirdParty) this.checkConsent(url.host);
    } catch {
      // Recording is never allowed to interrupt the request it observed.
    }
  }

  /**
   * Records a violation when a third-party host is contacted under a purpose
   * the principal has not granted.
   *
   * The check runs at observation time on purpose: effective consent is
   * "newest decision wins", so evaluating it later would test the wrong state.
   */
  private checkConsent(host: string) {
    if (!this.consentLookup || this.violations.length >= MAX_VIOLATIONS) return;
    try {
      const verdict = this.consentLookup(host);
      if (!verdict || verdict.status === "GRANTED") return;

      const already = this.violations.some(
        (v) => v.host === host && v.purpose_code === verdict.purposeCode,
      );
      if (already) return;

      this.violations.push({
        host,
        purpose_code: verdict.purposeCode,
        consent_status: verdict.status,
        observed_at: new Date().toISOString(),
      });
    } catch {
      // A throwing lookup is the integrator's bug, not grounds to crash.
    }
  }

  private recordStorage(kind: StorageKind, name: string, writer: string | null) {
    try {
      if (!name || this.storage.size >= MAX_STORAGE_ITEMS) return;
      const key = `${kind}|${name}`;
      if (this.storage.has(key)) return;
      this.storage.set(key, {
        kind,
        name: name.slice(0, 120),
        writer,
        first_seen: new Date().toISOString(),
      });
    } catch {
      // As above: observation must not break the page.
    }
  }

  // ─── Instrumentation ──────────────────────────────────────────────────────

  private instrumentFetch() {
    if (typeof window.fetch !== "function") return;
    const original = window.fetch;
    const self = this;

    window.fetch = function patchedFetch(this: unknown, ...args: Parameters<typeof fetch>) {
      try {
        const input = args[0];
        const raw =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request)?.url;
        if (raw) self.record(raw, "fetch", attributeCaller());
      } catch {
        // fall through to the real fetch regardless
      }
      return original.apply(this as never, args);
    };

    this.restore.push(() => {
      window.fetch = original;
    });
  }

  private instrumentXhr() {
    if (typeof XMLHttpRequest !== "function") return;
    const original = XMLHttpRequest.prototype.open;
    const self = this;

    // `open` is an overloaded signature; typing the wrapper as a plain
    // variadic function and re-asserting is the only way to preserve both arms.
    XMLHttpRequest.prototype.open = function patchedOpen(
      this: XMLHttpRequest,
      ...args: [method: string, url: string | URL, ...rest: unknown[]]
    ) {
      try {
        const raw = args[1];
        self.record(typeof raw === "string" ? raw : raw?.href, "xhr", attributeCaller());
      } catch {
        // ignore
      }
      return (original as (...a: unknown[]) => void).apply(this, args);
    } as XMLHttpRequest["open"];

    this.restore.push(() => {
      XMLHttpRequest.prototype.open = original;
    });
  }

  private instrumentBeacon() {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    const original = navigator.sendBeacon.bind(navigator);
    const self = this;

    navigator.sendBeacon = function patchedBeacon(url: string | URL, data?: BodyInit | null) {
      try {
        self.record(typeof url === "string" ? url : url.href, "beacon", attributeCaller());
      } catch {
        // ignore
      }
      return original(url, data);
    };

    this.restore.push(() => {
      navigator.sendBeacon = original;
    });
  }

  /**
   * Catches the tracking pixel, still the most common way a tag exfiltrates a
   * page view without any visible network code.
   */
  private instrumentImage() {
    if (typeof HTMLImageElement === "undefined") return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!descriptor?.set || !descriptor.get) return;

    const originalSet = descriptor.set;
    const self = this;

    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLImageElement, value: string) {
        try {
          if (value) self.record(String(value), "image", attributeCaller());
        } catch {
          // ignore
        }
        return originalSet.call(this, value);
      },
    });

    this.restore.push(() => {
      Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
    });
  }

  /**
   * Backstop for requests the wrappers cannot see - anything the browser issued
   * from markup rather than from script.
   */
  private observeResources() {
    if (typeof PerformanceObserver !== "function") return;

    const ingest = (entries: PerformanceEntryList) => {
      for (const entry of entries) {
        const timing = entry as PerformanceResourceTiming;
        if (!timing.name) continue;
        this.record(timing.name, initiatorTypeToKind(timing.initiatorType ?? ""), null);
      }
    };

    try {
      // Anything that loaded before the observer attached.
      if (typeof performance?.getEntriesByType === "function") {
        ingest(performance.getEntriesByType("resource"));
      }
      const observer = new PerformanceObserver((list) => {
        try {
          ingest(list.getEntries());
        } catch {
          // ignore
        }
      });
      observer.observe({ type: "resource", buffered: true });
      this.restore.push(() => observer.disconnect());
    } catch {
      // Older browsers without the buffered flag simply observe less.
    }
  }

  /** Records cookie and web-storage *keys*, and who set them. Never values. */
  private observeStorage() {
    try {
      const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
      if (cookieDescriptor?.set && cookieDescriptor.get) {
        const originalSet = cookieDescriptor.set;
        const self = this;
        Object.defineProperty(Document.prototype, "cookie", {
          ...cookieDescriptor,
          set(this: Document, value: string) {
            try {
              const name = String(value).split("=")[0]?.trim();
              if (name) self.recordStorage("cookie", name, attributeCaller());
            } catch {
              // ignore
            }
            return originalSet.call(this, value);
          },
        });
        this.restore.push(() => {
          Object.defineProperty(Document.prototype, "cookie", cookieDescriptor);
        });
      }
    } catch {
      // Some environments make document.cookie non-configurable.
    }

    // Cookies already present when the page loaded have no attributable writer.
    try {
      for (const pair of (document.cookie || "").split(";")) {
        const name = pair.split("=")[0]?.trim();
        if (name) this.recordStorage("cookie", name, null);
      }
    } catch {
      // Storage can be blocked outright by browser settings.
    }

    this.snapshotWebStorage("local_storage", () => window.localStorage);
    this.snapshotWebStorage("session_storage", () => window.sessionStorage);
    this.instrumentSetItem("local_storage", () => window.localStorage);
    this.instrumentSetItem("session_storage", () => window.sessionStorage);
  }

  private snapshotWebStorage(kind: StorageKind, get: () => Storage) {
    try {
      const store = get();
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key) this.recordStorage(kind, key, null);
      }
    } catch {
      // Blocked storage is not an error worth surfacing to the page.
    }
  }

  private instrumentSetItem(kind: StorageKind, get: () => Storage) {
    try {
      const store = get();
      const proto = Object.getPrototypeOf(store) as Storage;
      const original = proto.setItem;
      const self = this;

      proto.setItem = function patchedSetItem(this: Storage, key: string, value: string) {
        try {
          if (this === get()) self.recordStorage(kind, key, attributeCaller());
        } catch {
          // ignore
        }
        return original.call(this, key, value);
      };

      this.restore.push(() => {
        proto.setItem = original;
      });
    } catch {
      // ignore
    }
  }

  /**
   * Watches for tags injected after load - the common pattern where one tag
   * manager writes several vendor scripts into the DOM.
   */
  private observeInjectedNodes() {
    if (typeof MutationObserver !== "function") return;
    try {
      const observer = new MutationObserver((mutations) => {
        try {
          for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
              if (!(node instanceof HTMLElement)) continue;
              const tag = node.tagName.toLowerCase();
              if (tag === "script" && node.getAttribute("src")) {
                this.record(node.getAttribute("src") as string, "script", attributeCaller());
              } else if (tag === "iframe" && node.getAttribute("src")) {
                this.record(node.getAttribute("src") as string, "iframe", attributeCaller());
              } else if (tag === "img" && node.getAttribute("src")) {
                this.record(node.getAttribute("src") as string, "image", attributeCaller());
              }
            }
          }
        } catch {
          // ignore
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      this.restore.push(() => observer.disconnect());
    } catch {
      // ignore
    }
  }

  // ─── Delivery ─────────────────────────────────────────────────────────────

  private scheduleFlush() {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
      this.scheduleFlush();
    }, FLUSH_INTERVAL_MS);
  }

  private registerUnloadFlush() {
    const onHidden = () => {
      if (document.visibilityState === "hidden") void this.flush(true);
    };
    document.addEventListener("visibilitychange", onHidden);
    this.restore.push(() => document.removeEventListener("visibilitychange", onHidden));
  }

  /**
   * Sends what has been observed so far.
   *
   * Observations are kept after a successful send rather than cleared: the
   * server upserts by `(site, host, kind)`, so re-sending is idempotent, and
   * keeping them means a later flush still knows the page's full picture
   * instead of reporting fragments.
   */
  async flush(duringUnload = false): Promise<boolean> {
    const report = this.snapshot();
    if (
      report.destinations.length === 0 &&
      report.storage.length === 0 &&
      report.violations.length === 0
    ) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/discovery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.publicKey}`,
        },
        body: JSON.stringify(report),
        mode: "cors",
        // Survives the unload the visibilitychange handler is reacting to.
        keepalive: duringUnload,
      });

      // A rejected report is a real failure and must not be reported as a
      // success - silently returning true here hid a schema mismatch that
      // dropped every observation on the floor.
      if (!response.ok) {
        console.warn(`[rift-cmp] discovery report rejected (${response.status})`);
        return false;
      }
      return true;
    } catch {
      // A failed report is dropped rather than retried: the next page view
      // re-observes the same page and reports it again anyway.
      return false;
    }
  }
}
