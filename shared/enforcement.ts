/**
 * Wire contracts for enforcement, redaction and proof.
 *
 * Kept apart from the decision logic in `consent-firewall.ts` for the same
 * reason every other contract in this package is: a route's response shape is a
 * promise to a client, and changing one should be a deliberate act rather than a
 * side effect of refactoring an evaluator.
 */

import type { FirewallDecision, FirewallEffect, FirewallSeverity } from "./consent-firewall";
import type { RedactionApplication } from "./redaction";

// ─── Firewall evaluation ─────────────────────────────────────────────────────

export interface FirewallEvaluationRequest {
  /** URL or host being requested. */
  destination: string;
  /** The visitor, where the caller acts for one. Omitting it blocks gated vendors. */
  principal_external_id?: string;
  vendor?: string | null;
  purpose?: string | null;
  data_categories?: string[];
  /** A payload to test redaction against. Never stored, never logged. */
  payload?: unknown;
  /** Rules to apply for this evaluation. */
  redaction?: {
    rules: Array<{
      id: string;
      field: string;
      match: "name" | "path";
      locations?: Array<"body" | "query" | "header">;
      strategy: "remove" | "mask" | "hash";
      case_sensitive?: boolean;
    }>;
    mask_token?: string;
    hash_salt?: string;
  };
}

export interface FirewallEvaluationResponse {
  decision: {
    decision: FirewallDecision;
    effect: FirewallEffect;
    destination_host: string | null;
    vendor: string | null;
    purpose: string | null;
    user_state: string;
    matched_rule: { host: string; vendor: string; purpose: string | null; action: string } | null;
    policy_version: string | null;
    reason: string;
    severity: FirewallSeverity;
    evidence: Array<{ source: string; detail: string }>;
    /** Rule ids that matched. Never a value. */
    redactions: string[];
    observed_only: boolean;
    source: string;
  };
  /**
   * What redaction did, as structure only.
   *
   * Paths and rule ids. Never the values, and never the redacted payload — an
   * evaluation endpoint that echoed the payload back would be a way to launder
   * sensitive data through the audit surface.
   */
  redaction_applied: RedactionApplication[];
  /** True when the request would be sent after redaction. */
  would_send: boolean;
  config_problems: string[];
  legal_advice: false;
}

// ─── Client-reported enforcement ─────────────────────────────────────────────

export interface EnforcementReportRequest {
  decisions: Array<{
    /** Host only. A full URL is reduced to its host before storage. */
    resource: string;
    vendor?: string | null;
    purpose?: string | null;
    decision: string;
    reason: string;
    observed_only: boolean;
    at?: string;
  }>;
}

export interface EnforcementReportResponse {
  accepted: number;
  /** How many were dropped, and why, so a silent loss is visible. */
  rejected: number;
}

// ─── Enforcement history ─────────────────────────────────────────────────────

export interface EnforcementEventView {
  id: string;
  site_id: string;
  occurred_at: string;
  source: string;
  destination_host: string | null;
  vendor: string | null;
  purpose: string | null;
  decision: string;
  effect: string;
  observed_only: boolean;
  policy_version: string | null;
  matched_rule: unknown;
  reason: string;
  severity: string;
  redactions: unknown;
}

export interface EnforcementHistoryResponse {
  events: EnforcementEventView[];
  summary: {
    by_decision: Record<string, number>;
    observed_only: number;
    blocked: number;
    redacted: number;
    needs_review: number;
    total: number;
    destinations: number;
  };
  /**
   * What this log does and does not cover.
   *
   * Served with the data rather than documented elsewhere, because a count of
   * blocked requests reads as completeness unless something says otherwise.
   */
  coverage: {
    client_enforcement: string;
    server_enforcement: string;
    not_covered: string[];
  };
  legal_advice: false;
}

// ─── Proof ───────────────────────────────────────────────────────────────────

export interface ConsentProofResponse {
  /** The signed proof document, exactly as it can be verified. */
  proof: unknown;
  /** The evidence the proof covers, so a holder can recompute it themselves. */
  evidence: {
    site_id: string;
    principal_external_id: string;
    purpose_code: string;
    status: string;
    decided_at: string;
    notice_id: string | null;
    policy_version_id: string | null;
    policy_config_version: string | null;
    jurisdictions: string[];
    vendors: string[];
    mechanism: string | null;
    source: string;
  };
  /** Public key id only. Never key material of any kind. */
  key_id: string | null;
  caveat: string;
  legal_advice: false;
}

export interface ProofVerificationResponse {
  result: {
    ok: boolean;
    version: string;
    malformed: string | null;
    unsupported_version: boolean;
    integrity: "valid" | "invalid" | null;
    signature: "valid" | "invalid" | "unsigned" | "unknown_key" | "revoked_key" | null;
    key_id: string | null;
    chain: "valid" | "broken" | "unverifiable" | null;
    findings: string[];
  };
  caveat: string;
  legal_advice: false;
}
