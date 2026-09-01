import type { ConsentStatus } from "./consent";

/**
 * The authorisation contract.
 *
 * Authorisation is its own concern, deliberately not nested under transfers. It
 * answers "is this action permitted?"; a transfer is one action that requires an
 * answer. Keeping them separate means the same decision can gate other actions
 * later without reshaping the API.
 */

/**
 * Why a request was refused.
 *
 * Distinct rather than one generic failure: "never decided", "refused" and
 * "granted then withdrawn" are materially different, both to a caller deciding
 * what to do next and to an auditor reconstructing what happened.
 */
export const DECISION_REASONS = [
  "site_not_found",
  "principal_not_found",
  "purpose_not_found",
  "no_consent_decision",
  "consent_denied",
  "consent_withdrawn",
] as const;
export type DecisionReason = (typeof DECISION_REASONS)[number];

/**
 * The answer to "is this action currently authorised?", with no side effect.
 *
 * A permitted answer names the exact consent record it relied on, so the caller
 * can cite it and an auditor can verify it against the append-only log.
 */
export interface AuthorisationDecisionResponse {
  permitted: boolean;
  reason: DecisionReason | null;
  message: string;
  site_id: string;
  principal_external_id: string;
  purpose_code: string;
  consent_record_id: string | null;
  consent_status: ConsentStatus | null;
  /** When the principal made the decision being relied upon. */
  decided_at: string | null;
}
