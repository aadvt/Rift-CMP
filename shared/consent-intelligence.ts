/**
 * Findings about a site, each carrying the evidence that produced it.
 *
 * Two kinds of finding live here and they answer different questions:
 *
 *   A **shadow tracker** is something running that the configuration does not
 *   account for. "This is happening and nobody decided it should."
 *
 *   A **drift finding** is a difference between two points in time. "This
 *   changed and the configuration did not."
 *
 * ## Evidence is not optional
 *
 * Every finding names where it came from — which scan, which page, which
 * runtime report — because a privacy finding an operator cannot verify is one
 * they cannot act on, and one they will eventually learn to ignore. A finding
 * with no evidence is a rumour, and this platform's whole claim is that it
 * reports observations.
 *
 * ## Uncertainty is a value, not a rounding error
 *
 * `confidence` carries the scanner's own certainty and is never upgraded by the
 * act of reporting. An unclassified host is reported as unclassified — it is
 * never promoted to "tracker" because it looked suspicious, and never quietly
 * treated as requiring consent. Unknown is not permission, and it is not
 * accusation either.
 */

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ShadowTrackerReason =
  /** Observed, and no approved recommendation covers it. */
  | "not_configured"
  /** Approved, but no purpose is attached, so nothing gates it. */
  | "no_purpose"
  /** Policy says gate it on consent; it ran without a granted decision. */
  | "consent_required_without_consent"
  /** Policy says do not load it; it was observed anyway. */
  | "blocked_but_observed"
  /** The scanner could not classify it. Reported as uncertain, never as proven. */
  | "unclassified_behaviour";

export interface FindingEvidence {
  /** `scan` | `runtime` | `policy` — what observed this. */
  source: "scan" | "runtime" | "policy";
  detail: string;
  /** The scan this came from, when it came from one. */
  scan_id?: string;
  /** When it was observed. */
  observed_at?: string;
}

export interface ShadowTracker {
  /** Detector id where one exists, else the host. Stable across scans. */
  id: string;
  host: string;
  vendor: string | null;
  /** What the technology is normally used for. Never a legal category. */
  category: string | null;
  reason: ShadowTrackerReason;
  severity: FindingSeverity;
  /** Pages it was seen on. Empty when only runtime evidence exists. */
  pages: string[];
  destination_country: string | null;
  crosses_border: boolean;
  /** Scanner confidence, carried across unchanged. */
  confidence: "high" | "medium" | "low";
  /** Whether an approved policy version covers it at all. */
  approved: boolean;
  /** Purpose the policy attaches, when it attaches one. */
  purpose: string | null;
  /** What the policy says should happen: allow, require_consent, block… */
  policy_action: string | null;
  evidence: FindingEvidence[];
  /** One sentence naming what a person can do about it. */
  recommended_action: string;
  first_seen: string | null;
  last_seen: string | null;
}

export type DriftKind =
  | "tracker_added"
  | "tracker_removed"
  | "tracker_changed"
  | "vendor_added"
  | "blocked_still_active"
  | "consent_required_unconfigured"
  | "policy_ahead_of_site"
  | "site_ahead_of_policy";

export interface DriftFinding {
  id: string;
  kind: DriftKind;
  severity: FindingSeverity;
  host: string | null;
  vendor: string | null;
  page: string | null;
  /** What was true before, in words. Null when there was no before. */
  previous_state: string | null;
  current_state: string;
  /** The approved policy version this was judged against, when there is one. */
  policy_version: number | null;
  evidence: FindingEvidence[];
  recommended_action: string;
}

export interface SiteIntelligence {
  site_id: string;
  generated_at: string;
  /** The scan this was computed from, and the one before it. */
  scan_id: string | null;
  baseline_scan_id: string | null;
  shadow_trackers: ShadowTracker[];
  drift: DriftFinding[];
  /** Always false. Findings are observations, not legal determinations. */
  legal_advice: false;
}

export interface PageIntelligence {
  url: string;
  title: string | null;
  /** Trackers and services observed on this page. */
  components: Array<{
    host: string;
    vendor: string | null;
    category: string | null;
    third_party: boolean;
    confidence: "high" | "medium" | "low";
    purpose: string | null;
    policy_action: string | null;
    consent_required: string | null;
    destination_country: string | null;
    crosses_border: boolean;
  }>;
  cookies: Array<{ name: string; domain: string; third_party: boolean }>;
  /** Purposes any component on this page is attached to. */
  purposes: string[];
  /** Canonical data categories the regimes in play attach to these vendors. */
  data_categories: string[];
  /** Jurisdictions the approved policy was generated under. */
  jurisdictions: string[];
  shadow_trackers: ShadowTracker[];
  drift: DriftFinding[];
  /** Components the scanner could not classify. Never called trackers. */
  unresolved: Array<{ host: string; confidence: "high" | "medium" | "low" }>;
}

export interface SiteIntelligenceResponse {
  intelligence: SiteIntelligence;
}

export interface PageIntelligenceResponse {
  pages: PageIntelligence[];
}
