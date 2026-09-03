import type {
  ConsentDecisionResponse,
  ConsentSessionResponse,
  ConsentStateResponse,
  ConsentStatus,
  EffectiveConsent,
} from "@rift-cmp/shared";
import {
  CONSENT_SESSION_HEADER,
  CONSENT_STATUSES,
  isConsentStatus,
  isPurposeGranted,
} from "@rift-cmp/shared";
import { DEFAULT_API_URL } from "./constants";
import type { SDKOptions } from "./types";

/**
 * The principal identifier outlives the analytics session on purpose: a session
 * ends after 30 minutes of inactivity, but a consent decision is meant to stand
 * across visits until the principal changes it. Hence localStorage here and
 * sessionStorage for `rift_cmp_session_id`.
 */
const PRINCIPAL_STORAGE_KEY = "rift_cmp_principal_id";
const CONSENT_STATE_STORAGE_KEY = "rift_cmp_consent_state";

/**
 * The secret that binds the principal identifier above to this browser.
 *
 * Phase 6A: the server will not record a decision for a principal unless the
 * caller proves it holds this. It is minted once, by the server, and never
 * re-sent, so losing it means this browser becomes a new principal — which is
 * the correct failure mode for an anonymous identifier kept somewhere the
 * person can clear at will.
 */
const PRINCIPAL_SECRET_STORAGE_KEY = "rift_cmp_principal_secret";

/** The short-lived session token exchanged for the secret above. */
const CONSENT_SESSION_STORAGE_KEY = "rift_cmp_consent_session";

/** Re-mint slightly early, so ordinary clock skew never produces a hard failure. */
const SESSION_RENEWAL_MARGIN_MS = 30 * 1000;

/** Everything the SDK records is a decision made by an unauthenticated visitor. */
const PRINCIPAL_KIND = "anonymous";
const DECISION_SOURCE = "sdk";

/** Optional provenance for a decision, all of which the API may also infer. */
export type ConsentRecordOptions = {
  /** The notice that was shown when the principal decided. */
  noticeId?: string;
  /** The policy version that notice pointed at. */
  policyVersionId?: string;
  /** When the principal decided, if not "now". ISO 8601. */
  decidedAt?: string;
  metadata?: Record<string, unknown>;
};

export type ConsentChangeListener = (state: EffectiveConsent[]) => void;

/**
 * The surface `analytics.consent` exposes. Declared separately so the facade can
 * hand back a safely inert stub before `init()` without duplicating the shape.
 */
export interface ConsentApi {
  getState(): Promise<EffectiveConsent[]>;
  getCachedState(): EffectiveConsent[];
  isGranted(purposeCode: string): boolean;
  record(purposeCode: string, status: ConsentStatus, options?: ConsentRecordOptions): Promise<boolean>;
  grant(purposeCode: string, options?: ConsentRecordOptions): Promise<boolean>;
  deny(purposeCode: string, options?: ConsentRecordOptions): Promise<boolean>;
  withdraw(purposeCode: string, options?: ConsentRecordOptions): Promise<boolean>;
  onChange(listener: ConsentChangeListener): () => void;
  getPrincipalId(): string | null;
  /**
   * The live consent session token, if this browser already holds one.
   *
   * Synchronous and deliberately non-minting: the analytics client attaches it
   * to event batches on sites that enforce consent server-side, and must never
   * cause a principal to be created merely so an event can be sent.
   */
  getSessionToken(): string | null;
  clear(): void;
}

/**
 * Records and reads consent decisions for an anonymous browser principal.
 *
 * This class is deliberately headless. It owns identity, transport and caching;
 * it renders nothing. A banner subscribes with `onChange()` and calls
 * `grant()`/`deny()`, which keeps every UI decision out of the SDK and lets the
 * same client back a custom banner, a preference centre, or no UI at all.
 *
 * ## Identity, after Phase 6A
 *
 * The browser no longer mints its own principal identifier. It asks
 * `POST /api/v1/consent/session`, and the server returns an identifier *and* a
 * secret, once. Every later session is opened by presenting that pair. The
 * reason is in `database/consent-sessions.ts`: while the site public key was the
 * only thing a write needed, anybody could append a permanent consent record for
 * anybody, and the append-only log made that unfixable.
 *
 * Practically, three things follow for an integrator:
 *
 *  - `record()` may make two requests on a cold start, one to open a session and
 *    one to record. It is still a single `await` from the caller's side.
 *  - Clearing `localStorage` really does make this browser a new principal. It
 *    always did; now the server agrees.
 *  - A stale or expired session is recovered from silently, once, before the
 *    call is reported as failed.
 *
 * Like `AnalyticsClient`, no public method throws: a consent library that can
 * break the host page is worse than one that quietly degrades.
 */
export class ConsentClient implements ConsentApi {
  private siteId: string | null = null;
  private publicKey: string | null = null;
  private apiUrl: string;
  private principalId: string | null = null;
  private principalSecret: string | null = null;
  private sessionToken: string | null = null;
  private sessionExpiresAt = 0;
  private cachedState: EffectiveConsent[] = [];
  private listeners = new Set<ConsentChangeListener>();
  /** De-duplicates concurrent session opens, so one banner cannot mint two. */
  private pendingSession: Promise<string | null> | null = null;
  private readonly principalStorageKey = PRINCIPAL_STORAGE_KEY;
  private readonly principalSecretStorageKey = PRINCIPAL_SECRET_STORAGE_KEY;
  private readonly sessionStorageKey = CONSENT_SESSION_STORAGE_KEY;
  private readonly stateStorageKey = CONSENT_STATE_STORAGE_KEY;

  constructor(siteId: string, publicKey: string, options: SDKOptions = {}) {
    this.siteId = siteId;
    this.publicKey = publicKey;
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.principalId = this.readStored(this.principalStorageKey);
    this.principalSecret = this.readStored(this.principalSecretStorageKey);
    this.restoreSession();
    this.cachedState = this.readCachedState();
  }

  /**
   * Fetches the decisions currently in force and refreshes the cache.
   *
   * On failure the last known state is returned rather than an empty list:
   * a dropped network request is not evidence that consent was revoked.
   */
  async getState(): Promise<EffectiveConsent[]> {
    try {
      if (!this.siteId || !this.publicKey) {
        return this.getCachedState();
      }

      // Reading state does not mint a principal. A browser that has never
      // decided anything has nothing to read, and creating an identity for it
      // would be exactly the tracking this product exists to avoid.
      const principalId = this.principalId;
      if (!principalId) {
        return this.getCachedState();
      }

      const url = `${this.apiUrl}/api/v1/consent?principal_external_id=${encodeURIComponent(principalId)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.publicKey}`,
        },
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`Consent state request failed (${response.status}): ${response.statusText}`);
      }

      const body = (await response.json()) as ConsentStateResponse;
      this.setState(sanitiseState(body?.purposes));
      return this.getCachedState();
    } catch (error) {
      console.warn("[rift-cmp] consent.getState() failed", error);
      return this.getCachedState();
    }
  }

  /**
   * The last known state, without a network call.
   *
   * Reads from localStorage so a returning visitor's choice is available on the
   * first paint, before any request has resolved.
   */
  getCachedState(): EffectiveConsent[] {
    try {
      return [...this.cachedState];
    } catch (error) {
      console.warn("[rift-cmp] consent.getCachedState() failed", error);
      return [];
    }
  }

  /**
   * Whether processing is currently permitted for a purpose, per the cache.
   *
   * Synchronous by design: this is what a consent gate calls on every event, so
   * it must never await. An unknown purpose is not permission - see
   * `isPurposeGranted` in `@rift-cmp/shared`, which owns that rule.
   */
  isGranted(purposeCode: string): boolean {
    try {
      return isPurposeGranted(this.cachedState, purposeCode);
    } catch (error) {
      console.warn("[rift-cmp] consent.isGranted() failed", error);
      return false;
    }
  }

  /** Records a decision and adopts the effective state the API returns. */
  async record(purposeCode: string, status: ConsentStatus, options: ConsentRecordOptions = {}): Promise<boolean> {
    try {
      if (!this.siteId || !this.publicKey) {
        throw new Error("analytics.init(siteId, publicKey) must be called before recording consent.");
      }

      if (typeof purposeCode !== "string" || purposeCode.length === 0) {
        throw new Error("consent.record(purposeCode, status) requires a purpose code.");
      }

      // Validated locally as well as server-side so a typo fails loudly in the
      // console instead of costing a round trip.
      if (!isConsentStatus(status)) {
        throw new Error(`consent status must be one of ${CONSENT_STATUSES.join(", ")}.`);
      }

      const sent = await this.postDecision(purposeCode, status, options);
      if (sent) return true;

      // One retry, from scratch. A session can expire between page load and the
      // moment somebody finally clicks Accept, and a person should not have to
      // click twice because a token aged out while they were reading.
      this.forgetSession();
      return await this.postDecision(purposeCode, status, options);
    } catch (error) {
      console.warn("[rift-cmp] consent.record() failed", error);
      return false;
    }
  }

  grant(purposeCode: string, options?: ConsentRecordOptions): Promise<boolean> {
    return this.record(purposeCode, "GRANTED", options);
  }

  deny(purposeCode: string, options?: ConsentRecordOptions): Promise<boolean> {
    return this.record(purposeCode, "DENIED", options);
  }

  withdraw(purposeCode: string, options?: ConsentRecordOptions): Promise<boolean> {
    return this.record(purposeCode, "WITHDRAWN", options);
  }

  /**
   * Subscribes to state changes and returns an unsubscribe function.
   *
   * This is the seam a consent banner attaches to: the SDK never imports UI
   * code, the UI only ever observes state it did not have to model.
   */
  onChange(listener: ConsentChangeListener): () => void {
    try {
      if (typeof listener !== "function") {
        throw new Error("consent.onChange(listener) requires a function.");
      }

      this.listeners.add(listener);
      return () => {
        try {
          this.listeners.delete(listener);
        } catch (error) {
          console.warn("[rift-cmp] consent.onChange() unsubscribe failed", error);
        }
      };
    } catch (error) {
      console.warn("[rift-cmp] consent.onChange() failed", error);
      return () => {};
    }
  }

  /**
   * The persisted principal id, or null if this browser has never made one.
   *
   * Purely a read - it does not mint an id, so `clear()` genuinely leaves no
   * identifier behind until the next decision is recorded.
   */
  getPrincipalId(): string | null {
    try {
      return this.principalId ?? this.readStored(this.principalStorageKey);
    } catch (error) {
      console.warn("[rift-cmp] consent.getPrincipalId() failed", error);
      return null;
    }
  }

  /** The live session token, or null. Never opens one — see `ConsentApi`. */
  getSessionToken(): string | null {
    try {
      if (!this.sessionToken) return null;
      if (this.sessionExpiresAt - SESSION_RENEWAL_MARGIN_MS <= Date.now()) return null;
      return this.sessionToken;
    } catch (error) {
      console.warn("[rift-cmp] consent.getSessionToken() failed", error);
      return null;
    }
  }

  /**
   * Opens a session for the principal this browser already has, renewing an
   * expired one. Returns null when this browser has no principal yet.
   *
   * This is what the analytics client awaits before a flush on a
   * consent-enforcing site: it refreshes an aged token, and refuses to invent an
   * identity for a visitor who has never decided anything.
   */
  async ensureSessionForKnownPrincipal(): Promise<string | null> {
    try {
      const live = this.getSessionToken();
      if (live) return live;
      if (!this.principalId || !this.principalSecret) return null;
      return await this.openSession();
    } catch (error) {
      console.warn("[rift-cmp] consent.ensureSessionForKnownPrincipal() failed", error);
      return null;
    }
  }

  /**
   * Forgets the cached state, the principal id and its secret, locally.
   *
   * Local only: the decision log on the server is append-only and must stay
   * that way for audit. This is "this browser forgets who it was", not erasure.
   * The session token goes too, because a token that outlived the identity it
   * speaks for would let the next visitor keep writing as the last one.
   */
  clear(): void {
    try {
      this.principalId = null;
      this.principalSecret = null;
      this.cachedState = [];
      this.forgetSession();

      const storage = this.getStorage();
      if (storage) {
        try {
          storage.removeItem(this.principalStorageKey);
          storage.removeItem(this.principalSecretStorageKey);
          storage.removeItem(this.stateStorageKey);
        } catch {
          // Ignore localStorage failures; the SDK must remain resilient.
        }
      }

      this.notify();
    } catch (error) {
      console.warn("[rift-cmp] consent.clear() failed", error);
    }
  }

  // --- Sessions --------------------------------------------------------------

  /**
   * Opens a session, minting a principal when this browser has none.
   *
   * Concurrent callers share one in-flight request. Without that, a banner that
   * grants three purposes at once on a first visit would open three sessions and
   * create three principals, of which two would be orphans.
   */
  private openSession(): Promise<string | null> {
    if (this.pendingSession) return this.pendingSession;

    this.pendingSession = this.requestSession().finally(() => {
      this.pendingSession = null;
    });
    return this.pendingSession;
  }

  private async requestSession(): Promise<string | null> {
    if (!this.siteId || !this.publicKey) return null;

    const claim =
      this.principalId && this.principalSecret
        ? { principal_external_id: this.principalId, principal_secret: this.principalSecret }
        : {};

    const response = await fetch(`${this.apiUrl}/api/v1/consent/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.publicKey}`,
      },
      body: JSON.stringify(claim),
      mode: "cors",
    });

    if (response.status === 401 && this.principalId) {
      // The stored identity is no longer accepted — the principal was deleted,
      // or the secret does not match. Start again as a new principal rather than
      // leaving the browser permanently unable to record a decision.
      console.warn("[rift-cmp] stored principal was rejected; starting a new one");
      this.principalId = null;
      this.principalSecret = null;
      this.removeStored(this.principalStorageKey);
      this.removeStored(this.principalSecretStorageKey);
      return this.requestSession();
    }

    if (!response.ok) {
      throw new Error(`Consent session request failed (${response.status}): ${response.statusText}`);
    }

    const body = (await response.json()) as ConsentSessionResponse;
    if (!body?.session_token || !body?.principal_external_id) {
      throw new Error("Consent session response was malformed.");
    }

    this.principalId = body.principal_external_id;
    this.writeStored(this.principalStorageKey, body.principal_external_id);

    // Returned only when it was minted or bound by this call. A returning
    // browser keeps the one it already has.
    if (body.principal_secret) {
      this.principalSecret = body.principal_secret;
      this.writeStored(this.principalSecretStorageKey, body.principal_secret);
    }

    this.sessionToken = body.session_token;
    this.sessionExpiresAt = Date.parse(body.expires_at) || 0;
    this.persistSession();

    return this.sessionToken;
  }

  private async postDecision(
    purposeCode: string,
    status: ConsentStatus,
    options: ConsentRecordOptions,
  ): Promise<boolean> {
    const token = this.getSessionToken() ?? (await this.openSession());
    if (!token || !this.principalId) {
      throw new Error("Could not open a consent session for this browser.");
    }

    const response = await fetch(`${this.apiUrl}/api/v1/consent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.publicKey}`,
        [CONSENT_SESSION_HEADER]: token,
      },
      body: JSON.stringify({
        principal_external_id: this.principalId,
        principal_kind: PRINCIPAL_KIND,
        purpose_code: purposeCode,
        status,
        ...(options.noticeId ? { notice_id: options.noticeId } : {}),
        ...(options.policyVersionId ? { policy_version_id: options.policyVersionId } : {}),
        ...(options.decidedAt ? { decided_at: options.decidedAt } : {}),
        ...(options.metadata ? { metadata: options.metadata } : {}),
        source: DECISION_SOURCE,
      }),
      mode: "cors",
    });

    // Recoverable by opening a fresh session; the caller retries once.
    if (response.status === 401 || response.status === 429) {
      return false;
    }

    if (!response.ok) {
      throw new Error(`Consent decision failed (${response.status}): ${response.statusText}`);
    }

    // The API returns the recomputed state with the decision, so there is no
    // read-after-write round trip and no window where the cache disagrees.
    const body = (await response.json()) as ConsentDecisionResponse;
    this.setState(sanitiseState(body?.effective));
    return true;
  }

  private forgetSession() {
    this.sessionToken = null;
    this.sessionExpiresAt = 0;
    this.removeStored(this.sessionStorageKey);
  }

  private persistSession() {
    if (!this.sessionToken) return;
    this.writeStored(
      this.sessionStorageKey,
      JSON.stringify({ token: this.sessionToken, expiresAt: this.sessionExpiresAt }),
    );
  }

  private restoreSession() {
    const raw = this.readStored(this.sessionStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown };
      if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") return;
      if (parsed.expiresAt <= Date.now()) {
        this.removeStored(this.sessionStorageKey);
        return;
      }
      this.sessionToken = parsed.token;
      this.sessionExpiresAt = parsed.expiresAt;
    } catch {
      this.removeStored(this.sessionStorageKey);
    }
  }

  // --- State and storage -----------------------------------------------------

  private setState(state: EffectiveConsent[]) {
    this.cachedState = state;
    this.persistCachedState(state);
    this.notify();
  }

  private notify() {
    // A throwing listener is the host page's bug, not ours, and must not stop
    // the remaining subscribers from being told.
    for (const listener of [...this.listeners]) {
      try {
        listener(this.getCachedState());
      } catch (error) {
        console.warn("[rift-cmp] consent change listener failed", error);
      }
    }
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

  private readStored(key: string): string | null {
    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(key);
      return raw && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }

  private writeStored(key: string, value: string) {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.setItem(key, value);
    } catch {
      // Ignore localStorage failures; the in-memory copy still works for this
      // page, and the identity is simply not durable in this browser.
    }
  }

  private removeStored(key: string) {
    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.removeItem(key);
    } catch {
      // Ignore: nothing here is load-bearing enough to fail a page over.
    }
  }

  private readCachedState(): EffectiveConsent[] {
    const raw = this.readStored(this.stateStorageKey);
    if (!raw) return [];

    try {
      return sanitiseState(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  private persistCachedState(state: EffectiveConsent[]) {
    // The cache is an optimisation, not a source of truth - the API still holds
    // the decision log.
    this.writeStored(this.stateStorageKey, JSON.stringify(state));
  }
}

/**
 * Keeps only entries that are shaped like decisions.
 *
 * Both the network and localStorage are untrusted inputs here: a stale cache
 * written by an older SDK version, or a partial response, must not surface as a
 * malformed status that silently reads as "not granted" in confusing ways.
 */
function sanitiseState(value: unknown): EffectiveConsent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is EffectiveConsent => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const candidate = entry as Partial<EffectiveConsent>;
    return typeof candidate.purpose_code === "string" && isConsentStatus(candidate.status);
  });
}
