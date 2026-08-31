import type { AnalyticsEvent } from "@rift-cmp/shared";
import { getDeviceInfo } from "./device";
import { getPageContext } from "./page";
import type { ConsentCheck, SDKOptions, SessionState } from "./types";

const DEFAULT_API_URL = "http://127.0.0.1:3000";
// Envelope `source` per docs/event-schema.md: SDK identifier and version.
const SDK_SOURCE = "rift-cmp-sdk/0.1.0";
const SESSION_TTL_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 10;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_PERSISTED_EVENTS = 50;
const PENDING_EVENTS_STORAGE_KEY = "rift_cmp_pending_events";

export class AnalyticsClient {
  private siteId: string | null = null;
  private publicKey: string | null = null;
  private apiUrl: string;
  private sessionState: SessionState | null = null;
  private consentCheck: ConsentCheck = () => true;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: number | null = null;
  private retryCounts = new Map<string, number>();
  private isFlushing = false;
  private readonly flushIntervalMs = FLUSH_INTERVAL_MS;
  private readonly maxBatchSize = MAX_BATCH_SIZE;
  private readonly maxRetryAttempts = MAX_RETRY_ATTEMPTS;
  private readonly maxPersistedEvents = MAX_PERSISTED_EVENTS;
  private readonly storageKey = PENDING_EVENTS_STORAGE_KEY;

  constructor(siteId: string, publicKey: string, options: SDKOptions = {}) {
    this.siteId = siteId;
    this.publicKey = publicKey;
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.sessionState = this.loadSession();
    this.eventQueue = this.loadPersistedQueue();
    this.registerUnloadHooks();
  }

  init() {
    try {
      if (!this.siteId) {
        throw new Error("analytics.init(siteId, publicKey) must be called with a siteId.");
      }

      if (!this.publicKey) {
        throw new Error("analytics.init(siteId, publicKey) must be called with a publicKey.");
      }

      const currentSession = this.ensureSession();
      const sessionStarted = currentSession.isNewSession;

      if (sessionStarted) {
        void this.trackInternal("session_start");
      }

      void this.trackInternal("page_view");

      if (this.eventQueue.length > 0) {
        void this.flushQueue();
      }

      return {
        siteId: this.siteId,
        publicKey: this.publicKey,
        sessionId: currentSession.session.sessionId,
        apiUrl: this.apiUrl,
      };
    } catch (error) {
      console.warn("[rift-cmp] analytics.init() failed", error);
      return {
        siteId: this.siteId,
        publicKey: this.publicKey,
        sessionId: this.sessionState?.sessionId ?? null,
        apiUrl: this.apiUrl,
      };
    }
  }

  setConsentCheck(fn: ConsentCheck) {
    try {
      this.consentCheck = fn;
      return true;
    } catch (error) {
      console.warn("[rift-cmp] setConsentCheck() failed", error);
      return false;
    }
  }

  canSend(purpose: string): boolean {
    try {
      return this.consentCheck(purpose);
    } catch (error) {
      console.warn("[rift-cmp] canSend() failed", error);
      return false;
    }
  }

  getSessionId(): string | null {
    try {
      if (!this.sessionState) {
        this.init();
      }
      return this.sessionState?.sessionId ?? null;
    } catch (error) {
      console.warn("[rift-cmp] getSessionId() failed", error);
      return this.sessionState?.sessionId ?? null;
    }
  }

  async track(name: string, properties?: Record<string, unknown>) {
    try {
      if (!this.siteId) {
        return false;
      }

      if (!this.canSend("analytics")) {
        return false;
      }

      const event = this.buildEvent("custom", name, { properties });
      this.queueEvent(event);
      return true;
    } catch (error) {
      console.warn("[rift-cmp] track() failed", error);
      return false;
    }
  }

  private async trackInternal(
    eventType: "page_view" | "session_start" | "custom",
    name?: string,
    options: { properties?: Record<string, unknown> } = {},
  ) {
    try {
      if (!this.siteId) {
        return;
      }

      if (!this.canSend("analytics")) {
        return;
      }

      const event = this.buildEvent(eventType, name, options);
      this.queueEvent(event);
    } catch (error) {
      console.warn("[rift-cmp] trackInternal() failed", error);
    }
  }

  private buildEvent(
    eventType: "page_view" | "session_start" | "custom",
    name?: string,
    options: { properties?: Record<string, unknown> } = {},
  ): AnalyticsEvent {
    if (!this.siteId) {
      throw new Error("analytics.init(siteId) must be called before analytics.track().");
    }

    if (!this.publicKey) {
      throw new Error("analytics.init(siteId, publicKey) must be called before sending events.");
    }

    const session = this.ensureSession();
    const device = getDeviceInfo();
    const page = getPageContext();

    return {
      event_id: crypto.randomUUID(),
      site_id: this.siteId,
      session_id: session.session.sessionId,
      event_type: eventType,
      name: eventType === "custom" ? name : eventType,
      event_time: new Date().toISOString(),
      schema_version: 1,
      source: SDK_SOURCE,
      payload: {
        page: {
          url: typeof window !== "undefined" ? window.location.href : "unknown",
          title: typeof document !== "undefined" ? document.title : "unknown",
        },
        device: {
          type: device.type,
          browser: device.browser,
          os: device.os,
        },
        referrer: page.initialReferrer,
        properties: options.properties ?? {},
      },
    };
  }

  private queueEvent(event: AnalyticsEvent) {
    const existing = this.eventQueue.some((queued) => queued.event_id === event.event_id);
    if (!existing) {
      this.eventQueue.push(event);
    }

    this.persistQueue(this.eventQueue);

    if (this.eventQueue.length >= this.maxBatchSize) {
      this.cancelScheduledFlush();
      void this.flushQueue();
    }

    // Always leave a scheduled drain behind. flushQueue() is a no-op while
    // another flush is already in flight, so without this the size-triggered
    // path above could cancel the pending timer, do nothing, and strand the
    // queue until some later event happened to schedule a new one.
    this.scheduleFlush();
  }

  private scheduleFlush(delayMs: number = this.flushIntervalMs) {
    if (this.flushTimer !== null || this.eventQueue.length === 0) {
      return;
    }

    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flushQueue();
    }, delayMs);
  }

  private cancelScheduledFlush() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.isFlushing || this.eventQueue.length === 0) {
      return;
    }

    const batch = this.eventQueue.slice();
    this.eventQueue = [];
    this.cancelScheduledFlush();
    this.isFlushing = true;

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.publicKey}`,
        },
        body: JSON.stringify({ events: batch }),
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`Event submission failed (${response.status}): ${response.statusText}`);
      }

      this.clearPersistedQueue();
    } catch (error) {
      const retryable = batch.filter((event) => {
        const attempts = (this.retryCounts.get(event.event_id) ?? 0) + 1;
        this.retryCounts.set(event.event_id, attempts);
        return attempts <= this.maxRetryAttempts;
      });

      const exhausted = batch.filter((event) => !retryable.some((candidate) => candidate.event_id === event.event_id));

      if (retryable.length > 0) {
        this.eventQueue = [...retryable, ...this.eventQueue];
        const highestAttempts = Math.max(...retryable.map((event) => this.retryCounts.get(event.event_id) ?? 0), 1);
        const nextDelay = 250 * 2 ** Math.max(0, highestAttempts - 1);
        this.persistQueue(this.eventQueue);
        this.cancelScheduledFlush();
        this.scheduleFlush(nextDelay);
      }

      if (exhausted.length > 0) {
        const persisted = this.readPersistedQueue();
        this.persistQueue([...persisted, ...exhausted]);
      }

      console.warn("[rift-cmp] queue flush failed; events kept for retry", error);
    } finally {
      this.isFlushing = false;
      // Anything queued while this flush was in flight still needs a drain.
      this.scheduleFlush();
    }
  }

  private registerUnloadHooks() {
    if (typeof window === "undefined") {
      return;
    }

    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") {
        this.flushBeacon();
      }
    };

    document.addEventListener("visibilitychange", flushOnHidden);
    window.addEventListener("beforeunload", () => this.flushBeacon());
  }

  // Flush on tab close / hidden. `navigator.sendBeacon` cannot set request
  // headers, so it can never send `Authorization: Bearer <public_key>` and the
  // API rejects every beacon with 401. `fetch(..., { keepalive: true })` also
  // survives page unload but does support headers, so it is used instead.
  //
  // The queue is deliberately NOT cleared here: this request cannot be awaited
  // during unload, so delivery is unknowable. Events stay in localStorage and
  // are re-sent on the next page load, where the API deduplicates them by
  // event_id. Losing the queue on an assumed success is worse than sending a
  // duplicate the API already ignores.
  private flushBeacon() {
    if (typeof fetch === "undefined") {
      return;
    }

    const payload = this.getPendingEvents();
    if (payload.length === 0) {
      return;
    }

    this.persistQueue(payload);

    try {
      void fetch(`${this.apiUrl}/api/v1/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.publicKey}`,
        },
        body: JSON.stringify({ events: payload }),
        mode: "cors",
        // The fetch spec caps keepalive request bodies at 64 KB. The queue is
        // capped at MAX_PERSISTED_EVENTS, which keeps it well under that.
        keepalive: true,
      }).catch(() => {
        // Unload is in progress; nothing can be reported. The persisted queue
        // above is the recovery path.
      });
    } catch {
      // Ignore: events remain persisted for the next page load.
    }
  }

  private getPendingEvents(): AnalyticsEvent[] {
    const queued = [...this.eventQueue];
    const persisted = this.readPersistedQueue();
    return this.dedupeEvents([...persisted, ...queued]).slice(-this.maxPersistedEvents);
  }

  private dedupeEvents(events: AnalyticsEvent[]): AnalyticsEvent[] {
    const seen = new Map<string, AnalyticsEvent>();
    for (const event of events) {
      seen.set(event.event_id, event);
    }
    return Array.from(seen.values());
  }

  private getStorage(): Storage | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private loadPersistedQueue(): AnalyticsEvent[] {
    const storage = this.getStorage();
    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as AnalyticsEvent[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return this.dedupeEvents(parsed).slice(-this.maxPersistedEvents);
    } catch {
      return [];
    }
  }

  private persistQueue(events: AnalyticsEvent[]) {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      const merged = this.dedupeEvents([...this.readPersistedQueue(), ...events]).slice(-this.maxPersistedEvents);
      storage.setItem(this.storageKey, JSON.stringify(merged));
    } catch {
      // Ignore localStorage failures; the SDK must remain resilient.
    }
  }

  private readPersistedQueue(): AnalyticsEvent[] {
    const storage = this.getStorage();
    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as AnalyticsEvent[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return this.dedupeEvents(parsed).slice(-this.maxPersistedEvents);
    } catch {
      return [];
    }
  }

  private clearPersistedQueue() {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(this.storageKey);
    } catch {
      // Ignore localStorage failures.
    }
  }

  private ensureSession(): { session: SessionState; isNewSession: boolean } {
    const now = Date.now();

    if (!this.sessionState) {
      const session: SessionState = { sessionId: crypto.randomUUID(), lastActivity: now };
      this.sessionState = session;
      this.persistSession(session);
      return { session, isNewSession: true };
    }

    const elapsed = now - this.sessionState.lastActivity;
    if (elapsed > SESSION_TTL_MS) {
      const session: SessionState = { sessionId: crypto.randomUUID(), lastActivity: now };
      this.sessionState = session;
      this.persistSession(session);
      return { session, isNewSession: true };
    }

    this.sessionState.lastActivity = now;
    this.persistSession(this.sessionState);
    return { session: this.sessionState, isNewSession: false };
  }

  private loadSession(): SessionState | null {
    if (typeof window === "undefined") {
      return null;
    }

    const value = window.sessionStorage.getItem("rift_cmp_session_id");
    if (!value) return null;

    const lastActivity = Number(window.sessionStorage.getItem("rift_cmp_session_last_activity") ?? Date.now());
    if (!Number.isFinite(lastActivity)) {
      return { sessionId: value, lastActivity: Date.now() };
    }

    return { sessionId: value, lastActivity };
  }

  private persistSession(session: SessionState) {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem("rift_cmp_session_id", session.sessionId);
    window.sessionStorage.setItem("rift_cmp_session_last_activity", String(session.lastActivity));
  }
}
