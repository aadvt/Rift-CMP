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

/**
 * How strongly a statement is held.
 *
 * The distinction exists because a page view mixes four different kinds of
 * claim and presenting them alike is how an inference gets quoted back as a
 * measurement:
 *
 *   `observed`   — seen on this page, by the crawler or in a real browser.
 *   `configured` — the operator's approved decision about it.
 *   `inferred`   — attributed to this page by matching, not by observation.
 *                  The crawler aggregates cookies and network requests across a
 *                  site rather than per page, so anything cookie-shaped on a
 *                  page view is a match on host, not a sighting.
 *   `enforced`   — the runtime acted, or would have.
 *   `unknown`    — the question was asked and has no answer yet.
 */
export type Attribution = "observed" | "configured" | "inferred" | "enforced" | "unknown";

export interface PageComponent {
  host: string;
  vendor: string | null;
  category: string | null;
  third_party: boolean;
  confidence: "high" | "medium" | "low";
  /** Where the claim that this is on *this page* comes from. */
  attribution: Attribution;
  /** How it was seen: a script tag, a network request in a real browser… */
  observed_as: string;
  purpose: string | null;
  policy_action: string | null;
  /** The engine's answer, carried verbatim. Never flattened to a boolean. */
  consent_required: string | null;
  /** `enforce` | `observe` | `off` | null when no policy is approved. */
  enforcement: string | null;
  destination_country: string | null;
  crosses_border: boolean;
}

export interface PageCookie {
  name: string;
  domain: string;
  third_party: boolean;
  /**
   * Always `inferred`. The crawler records cookies for the whole scan, not per
   * page, so a cookie shown against a page matched a host seen on it. Saying
   * "observed" would be a stronger claim than the data supports.
   */
  attribution: Attribution;
}

export interface PageIntelligence {
  url: string;
  title: string | null;
  status: number | null;
  components: PageComponent[];
  cookies: PageCookie[];
  /** Purposes any component on this page is attached to. */
  purposes: string[];
  /** Canonical data categories the regimes in play attach to these vendors. */
  data_categories: string[];
  /** Jurisdictions the approved policy was generated under. */
  jurisdictions: string[];
  /** The approved version these judgements were made against. */
  policy_version: number | null;
  shadow_trackers: ShadowTracker[];
  drift: DriftFinding[];
  /** Components the scanner could not classify. Never called trackers. */
  unresolved: Array<{ host: string; confidence: "high" | "medium" | "low" }>;
  /**
   * Counts a person can scan before reading the detail.
   *
   * `needs_review` is the number of things on this page nobody has decided
   * about — the reason to open it.
   */
  summary: { components: number; third_party: number; needs_review: number };
}

export interface SiteIntelligenceResponse {
  intelligence: SiteIntelligence;
}

export interface PageIntelligenceResponse {
  pages: PageIntelligence[];
}

/**
 * A recommendation with everything now known about it attached.
 *
 * Deliberately a wrapper rather than a replacement. The deterministic
 * `VendorRecommendation` is carried through untouched under `recommendation`,
 * and everything the intelligence layer or a model adds sits beside it. That
 * shape is the guarantee: there is no field here through which a finding or a
 * model could alter what the engine decided.
 */
export interface EnrichedRecommendation {
  /** The deterministic recommendation, verbatim. */
  recommendation: unknown;
  /** Why this is near the top of the list, in one sentence. */
  priority_reason: string;
  /** Higher is more urgent. Derived from evidence, not from a model. */
  priority: number;
  /** Findings about this vendor, if any. */
  shadow_trackers: ShadowTracker[];
  drift: DriftFinding[];
  /** Pages this vendor was observed on, when page attribution exists. */
  observed_on_pages: string[];
  /** Advisory only. Null when no provider is configured or the reply failed validation. */
  ai: {
    provider: string;
    model: string;
    advisory: true;
    suggested_category: string | null;
    reasoning: string;
    confidence: number;
    ambiguous: boolean;
  } | null;
}

export interface AutopilotIntelligence {
  site_id: string;
  generated_at: string;
  /** Ordered: the thing most worth a person's attention first. */
  recommendations: EnrichedRecommendation[];
  /** Present only when a provider answered and passed validation. */
  ai_summary: {
    provider: string;
    model: string;
    advisory: true;
    summary: string;
    ambiguities: string[];
    confidence: number;
  } | null;
  /** True when a provider is configured, whether or not it answered. */
  ai_configured: boolean;
  /** Always true: nothing here is applied without a person approving it. */
  requires_approval: true;
  legal_advice: false;
}

export interface AutopilotIntelligenceResponse {
  autopilot: AutopilotIntelligence;
}
