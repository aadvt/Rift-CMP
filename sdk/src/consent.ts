import type { ConsentDecisionResponse, ConsentStateResponse, ConsentStatus, EffectiveConsent } from "@rift-cmp/shared";
import { CONSENT_STATUSES, isConsentStatus, isPurposeGranted } from "@rift-cmp/shared";
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
 * Like `AnalyticsClient`, no public method throws: a consent library that can
 * break the host page is worse than one that quietly degrades.
 */
export class ConsentClient implements ConsentApi {
  private siteId: string | null = null;
  private publicKey: string | null = null;
  private apiUrl: string;
  private principalId: string | null = null;
  private cachedState: EffectiveConsent[] = [];
  private listeners = new Set<ConsentChangeListener>();
  private readonly principalStorageKey = PRINCIPAL_STORAGE_KEY;
  private readonly stateStorageKey = CONSENT_STATE_STORAGE_KEY;

  constructor(siteId: string, publicKey: string, options: SDKOptions = {}) {
    this.siteId = siteId;
    this.publicKey = publicKey;
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.principalId = this.readPrincipalId();
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

      const principalId = this.ensurePrincipalId();
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

      const principalId = this.ensurePrincipalId();
      if (!principalId) {
        throw new Error("Could not establish a principal id for this browser.");
      }

      const response = await fetch(`${this.apiUrl}/api/v1/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.publicKey}`,
        },
        body: JSON.stringify({
          principal_external_id: principalId,
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

      if (!response.ok) {
        throw new Error(`Consent decision failed (${response.status}): ${response.statusText}`);
      }

      // The API returns the recomputed state with the decision, so there is no
      // read-after-write round trip and no window where the cache disagrees.
      const body = (await response.json()) as ConsentDecisionResponse;
      this.setState(sanitiseState(body?.effective));
      return true;
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
      return this.principalId ?? this.readPrincipalId();
    } catch (error) {
      console.warn("[rift-cmp] consent.getPrincipalId() failed", error);
      return null;
    }
  }

  /**
   * Forgets the cached state and the principal id locally.
   *
   * Local only: the decision log on the server is append-only and must stay
   * that way for audit. This is "this browser forgets who it was", not erasure.
   */
  clear(): void {
    try {
      this.principalId = null;
      this.cachedState = [];

      const storage = this.getStorage();
      if (storage) {
        try {
          storage.removeItem(this.principalStorageKey);
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

  private ensurePrincipalId(): string | null {
    if (this.principalId) {
      return this.principalId;
    }

    const stored = this.readPrincipalId();
    if (stored) {
      this.principalId = stored;
      return stored;
    }

    try {
      const generated = crypto.randomUUID();
      this.principalId = generated;
      this.persistPrincipalId(generated);
      return generated;
    } catch (error) {
      console.warn("[rift-cmp] could not generate a principal id", error);
      return null;
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

  private readPrincipalId(): string | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    try {
      const raw = storage.getItem(this.principalStorageKey);
      return raw && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }

  private persistPrincipalId(principalId: string) {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(this.principalStorageKey, principalId);
    } catch {
      // Ignore localStorage failures; an in-memory id still works for this page.
    }
  }

  private readCachedState(): EffectiveConsent[] {
    const storage = this.getStorage();
    if (!storage) {
      return [];
    }

    try {
      const raw = storage.getItem(this.stateStorageKey);
      if (!raw) {
        return [];
      }

      return sanitiseState(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  private persistCachedState(state: EffectiveConsent[]) {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(this.stateStorageKey, JSON.stringify(state));
    } catch {
      // Ignore localStorage failures; the cache is an optimisation, not a source
      // of truth - the API still holds the decision log.
    }
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
