/**
 * Consent domain contract, shared by the API, the database package and the SDK.
 *
 * These types describe *structure* only - who decided what, about which purpose,
 * under which notice, and when. They encode no legal rules: no retention
 * periods, no jurisdiction logic, no "analytics requires consent" policy. A
 * compliance engine for any particular regulation is expected to sit above this
 * vocabulary later, reading it rather than being embedded in it.
 */

/**
 * The decision a principal made.
 *
 * A string union rather than a database enum so new decision types can be added
 * without a type migration; the API validates against this list. `WITHDRAWN` is
 * distinct from `DENIED` on purpose: refusing up front and revoking a previously
 * given consent are different events, and the audit trail must tell them apart.
 */
export const CONSENT_STATUSES = ["GRANTED", "DENIED", "WITHDRAWN"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export function isConsentStatus(value: unknown): value is ConsentStatus {
  return typeof value === "string" && (CONSENT_STATUSES as readonly string[]).includes(value);
}

/** Statuses that mean "processing is currently permitted for this purpose". */
const PERMISSIVE_STATUSES: readonly ConsentStatus[] = ["GRANTED"];

// ─── Reference data ──────────────────────────────────────────────────────────

export interface PurposeSummary {
  purpose_id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface PolicyVersionSummary {
  policy_version_id: string;
  policy_id: string;
  policy_code: string;
  version: string;
  document_url: string | null;
  content_hash: string | null;
  published_at: string;
}

export interface PolicySummary {
  policy_id: string;
  code: string;
  name: string;
  created_at: string;
  versions: PolicyVersionSummary[];
}

export interface NoticeSummary {
  notice_id: string;
  version: string;
  locale: string;
  policy_version_id: string;
  published_at: string;
  /** Purpose codes this notice disclosed. */
  purpose_codes: string[];
}

// ─── Decisions ───────────────────────────────────────────────────────────────

export interface ConsentRecordSummary {
  consent_record_id: string;
  site_id: string;
  principal_external_id: string;
  purpose_code: string;
  status: ConsentStatus;
  notice_id: string | null;
  policy_version_id: string | null;
  source: string;
  /** When the principal decided. */
  decided_at: string;
  /** When we durably stored the decision. */
  recorded_at: string;
  metadata: Record<string, unknown> | null;
}

/** The decision currently in force for one purpose. Derived, never stored. */
export interface EffectiveConsent {
  purpose_code: string;
  status: ConsentStatus;
  decided_at: string;
  consent_record_id: string;
  notice_id: string | null;
  policy_version_id: string | null;
}

export interface ConsentStateResponse {
  site_id: string;
  principal_external_id: string;
  purposes: EffectiveConsent[];
}

export interface ConsentHistoryResponse {
  records: ConsentRecordSummary[];
}

export interface ConsentDecisionResponse {
  record: ConsentRecordSummary;
  /** The state after applying this decision, so a caller needs only one call. */
  effective: EffectiveConsent[];
}

// ─── Derivation ──────────────────────────────────────────────────────────────

/**
 * Reduces an append-only decision log to the decision currently in force for
 * each purpose.
 *
 * This is the single definition of "effective consent" in the codebase - the API
 * and the SDK both call it, so the two can never disagree. It is a pure function
 * over records, which is what keeps consent auditable: current state is always
 * recomputable from history rather than maintained as a mutable flag that could
 * drift away from the log.
 *
 * Ordering is by `decided_at`, then `recorded_at`, then `consent_record_id`, so
 * the result is deterministic even when two decisions share a timestamp.
 */
export function resolveEffectiveConsent(
  records: readonly ConsentRecordSummary[],
): EffectiveConsent[] {
  const latest = new Map<string, ConsentRecordSummary>();

  for (const record of records) {
    const current = latest.get(record.purpose_code);
    if (!current || comparePrecedence(record, current) > 0) {
      latest.set(record.purpose_code, record);
    }
  }

  return [...latest.values()]
    .sort((a, b) => a.purpose_code.localeCompare(b.purpose_code))
    .map((record) => ({
      purpose_code: record.purpose_code,
      status: record.status,
      decided_at: record.decided_at,
      consent_record_id: record.consent_record_id,
      notice_id: record.notice_id,
      policy_version_id: record.policy_version_id,
    }));
}

function comparePrecedence(a: ConsentRecordSummary, b: ConsentRecordSummary): number {
  const byDecided = Date.parse(a.decided_at) - Date.parse(b.decided_at);
  if (byDecided !== 0) return byDecided;

  const byRecorded = Date.parse(a.recorded_at) - Date.parse(b.recorded_at);
  if (byRecorded !== 0) return byRecorded;

  return a.consent_record_id.localeCompare(b.consent_record_id);
}

/**
 * Whether processing is currently permitted for a purpose.
 *
 * Absence of a decision is *not* permission: an unknown purpose returns false.
 */
export function isPurposeGranted(
  effective: readonly EffectiveConsent[],
  purposeCode: string,
): boolean {
  const decision = effective.find((entry) => entry.purpose_code === purposeCode);
  return decision ? PERMISSIVE_STATUSES.includes(decision.status) : false;
}

// --- Consent sessions (Phase 6A) --------------------------------------------

/**
 * Prefix of the opaque token a browser presents to prove a consent decision is
 * its own. Only its SHA-256 digest is ever stored, exactly like `sk_` and `rk_`.
 */
export const CONSENT_SESSION_PREFIX = "cs_";

/**
 * Prefix of the secret that binds a principal identifier to one browser.
 *
 * This is the durable half of the mechanism. The session token expires; the
 * principal secret is what lets the same browser open the next session and stops
 * anyone else opening one for that principal. It lives in `localStorage`
 * alongside the identifier it protects.
 */
export const PRINCIPAL_SECRET_PREFIX = "ps_";

/** How long a consent session stays usable. Short: it is re-minted silently. */
export const CONSENT_SESSION_TTL_SECONDS = 30 * 60;

/**
 * How many decisions one session may record.
 *
 * Generous enough for a preference centre with many purposes, toggled a few
 * times, and low enough that a stolen token cannot be used to bury a decision
 * log under thousands of fabricated entries.
 */
export const CONSENT_SESSION_MAX_DECISIONS = 50;

/** The HTTP header a consent session token travels in. */
export const CONSENT_SESSION_HEADER = "x-rift-consent-session";

/** Request body of `POST /api/v1/consent/session`. */
export interface ConsentSessionRequest {
  /** Omit on a browser's first visit; the server mints one. */
  principal_external_id?: string;
  /** Required whenever `principal_external_id` is sent. */
  principal_secret?: string;
}

/** Response body of `POST /api/v1/consent/session`. */
export interface ConsentSessionResponse {
  site_id: string;
  principal_external_id: string;
  /**
   * Returned only when the secret was minted (or bound) by this call. Store it:
   * it is the only way to open a later session for this principal, and it is
   * never shown again.
   */
  principal_secret: string | null;
  session_token: string;
  expires_at: string;
  max_decisions: number;
}
