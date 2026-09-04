/**
 * The consent experience contract.
 *
 * Two artifacts with very different standing, and keeping them apart is the
 * whole design:
 *
 *   {@link ConsentRuntimeConfig} — what the banner renders. Operator-authored,
 *   served to browsers, contains no reasoning.
 *
 *   {@link ConsentProposal} — what Rift *suggests* the operator declare, with
 *   the evidence and citations behind each suggestion. Never served to a
 *   browser, never applied automatically, always marked for review.
 *
 * ## Why a proposal is not a configuration
 *
 * `api/app/dashboard/configure/page.tsx` argues that Rift cannot know which of
 * an operator's declared purposes covers a detected vendor — a purpose is
 * operator-declared free text, and a guessed mapping would be "confident,
 * unauditable and often wrong". That argument is correct and this contract does
 * not overturn it.
 *
 * What it adds is the missing half: Rift *can* say "these technologies were
 * observed, these regimes appear to apply, here is a starting point and here is
 * the evidence for each line". That is a proposal a person accepts, edits or
 * rejects. It becomes configuration only when a human declares the purposes,
 * which is the existing `POST /api/v1/purposes` flow and nothing new.
 *
 * ## The browser does no legal reasoning
 *
 * `ConsentRuntimeConfig` is deliberately inert. It carries labels, purpose
 * codes and display order. It carries no regime, no citation, no jurisdiction
 * rule and no requirement — because a banner that decided anything would put
 * legal logic in a bundle that ships to every visitor and can be read and
 * modified by anyone. Everything that needed deciding was decided server-side
 * before this was serialised.
 *
 * Research artifact, not legal advice.
 */

/**
 * Whether a purpose may be switched off by the visitor.
 *
 * `essential` renders as a locked-on row. That is a **claim the operator makes**
 * about their own processing, not a determination Rift makes for them: the
 * platform has no basis to decide that a given purpose is strictly necessary,
 * and marking one essential is exactly the decision a regulator would question.
 * It is set by the operator and reported here unchanged.
 */
export type ConsentPurposeKind = "essential" | "optional";

/** One row in the banner and the preference centre. */
export interface ConsentPurposeConfig {
  /** Matches `purposes.code`; what `analytics.consent.grant()` is called with. */
  code: string;
  name: string;
  description: string;
  kind: ConsentPurposeKind;
  /**
   * Vendors the operator has associated with this purpose, for display in the
   * preference centre. Names only — no hosts, no evidence, no classification.
   */
  vendors: string[];
  /** Stable display order, so two loads of one site never reorder the list. */
  order: number;
}

/**
 * What the runtime fetches and renders.
 *
 * Served on the browser plane under a site public key, so it must be safe to
 * hand to anyone: it describes a site's declared purposes and nothing about any
 * person.
 */
export interface ConsentRuntimeConfig {
  site_id: string;
  /**
   * Changes whenever the rendered content changes, so a runtime can cache and a
   * banner can be re-shown when the disclosure it was accepted against moves on.
   * Derived from the notice and purposes; never a timestamp, so an unchanged
   * site yields an unchanged value.
   */
  config_version: string;
  purposes: ConsentPurposeConfig[];
  /**
   * The notice this configuration discloses, when the operator has published
   * one. Consent recorded through the banner cites it.
   */
  notice: {
    notice_id: string;
    version: string;
    locale: string;
    policy_version_id: string | null;
    document_url: string | null;
  } | null;
  /**
   * Banner copy. **Every string here is operator-authored or null.**
   *
   * Null means the operator has not written it, and the runtime falls back to
   * neutral, descriptive wording that makes no legal claim — never to invented
   * legal text. See `docs/consent-experience.md`.
   */
  text: {
    title: string | null;
    body: string | null;
    accept_all: string | null;
    reject_all: string | null;
    manage: string | null;
    save: string | null;
    policy_url: string | null;
  };
  /**
   * Whether the operator has done enough for the banner to be meaningful.
   *
   * False when no purposes are declared. The runtime then renders nothing at
   * all rather than an empty banner, because a banner offering no choices is
   * worse than none — it looks like a consent mechanism and is not one.
   */
  ready: boolean;
}

// ─── The proposal ────────────────────────────────────────────────────────────

/** Why a suggestion was made, in terms a person can check. */
export interface ProposalEvidence {
  /** `scan_technology` | `scan_cookie` | `declared_purpose` | `regulation` */
  kind: string;
  /** What was observed, verbatim where it came from an observation. */
  detail: string;
  /** Requirement id where this line came from the policy engine. */
  requirement_id?: string;
  /** Source ids behind that requirement, so a reader can reach the instrument. */
  source_ids?: string[];
}

/** One suggested purpose, and the case for it. */
export interface ProposedPurpose {
  /** Suggested code. Editable — the operator owns their own vocabulary. */
  suggested_code: string;
  suggested_name: string;
  /** Descriptive, never a legal characterisation. */
  suggested_description: string;
  /** True when a purpose with this code already exists on the organisation. */
  already_declared: boolean;
  /** Technologies the scan attributed to this purpose, by display name. */
  technologies: string[];
  evidence: ProposalEvidence[];
  /**
   * How strongly the observations support this suggestion. Carried from the
   * scanner's own confidence, never upgraded by the act of proposing.
   */
  confidence: "high" | "medium" | "low";
}

/**
 * What Rift suggests, and everything a reviewer needs to disagree with it.
 */
export interface ConsentProposal {
  site_id: string;
  /** The scan this was derived from, when one was used. */
  scan_id: string | null;
  /** Jurisdictions the resolver produced, and how confident it was. */
  jurisdictions: string[];
  jurisdiction_confidence: Record<string, string>;
  /**
   * Regimes the policy engine considered applicable. Advisory: they annotate
   * the proposal for a human, and nothing in the runtime reads them.
   */
  regimes: string[];
  /** Obligations the engine raised, as a summary a reviewer can act on. */
  obligations: Array<{
    verdict: string;
    requirement_id: string;
    regime: string;
    summary: string;
  }>;
  /** Everything the engine would not decide. Usually the longer list. */
  open_questions: Array<{ reason: string; detail: string }>;
  purposes: ProposedPurpose[];
  /**
   * Technologies the scan found that no suggestion covers.
   *
   * Surfaced rather than hidden: an unclassified third party is the row an
   * operator most needs to look at, and quietly dropping it would make the
   * proposal look more complete than it is.
   */
  unmapped_technologies: Array<{ name: string; category: string; confidence: string }>;
  /**
   * Always true. A proposal is a starting point for a person, never a
   * configuration, and nothing in the platform applies one automatically.
   */
  requires_review: true;
  /** Always false. This is a product artifact, not legal advice. */
  legal_advice: false;
}

export interface ConsentConfigResponse extends ConsentRuntimeConfig {}

export interface ConsentProposalResponse {
  proposal: ConsentProposal;
}

/**
 * Neutral fallback copy.
 *
 * Used only where the operator has authored nothing. Every string is
 * descriptive — it says what the buttons do and what the site uses — and none
 * asserts a legal basis, a right, or that the visitor is required to choose.
 * Inventing legal text on an operator's behalf is the one thing this phase must
 * not do, so the fallback is deliberately dull.
 */
export const CONSENT_FALLBACK_TEXT = {
  title: "Your choices on this site",
  body:
    "This site uses technologies that store or read information in your browser. " +
    "You can choose which of them to allow. Your choice is recorded and you can " +
    "change it at any time.",
  accept_all: "Accept all",
  reject_all: "Reject all",
  manage: "Manage preferences",
  save: "Save choices",
} as const;

// ─── Phase 9A: recommendations ───────────────────────────────────────────────

/**
 * What the autopilot suggests be done about one detected vendor.
 *
 * `require_consent` and `block` are **recommendations to the operator**, not
 * behaviours the platform performs. Rift does not block anything: the runtime
 * renders a banner and records decisions, and whether a tag actually loads is
 * decided by the site's own integration. Naming an action `block` and then
 * silently not blocking would be the worst of both, so the distinction is
 * stated on the type and repeated in the review screen.
 */
export type RecommendedAction =
  /** No consent gate suggested. */
  | "allow"
  /** Suggest gating on a granted purpose before the vendor loads. */
  | "require_consent"
  /** Suggest not loading it at all until the operator decides otherwise. */
  | "block"
  /** Operator has said this vendor is out of scope. Only ever set by a human. */
  | "ignore"
  /** The inputs do not support a recommendation. Never a default to "allow". */
  | "review";

/** Where a line in the recommendation came from. */
export interface RecommendationEvidence {
  /** `scan_technology` | `scan_cookie` | `catalogue` | `regulation` | `override` */
  kind: string;
  detail: string;
  /** Requirement id, when the line rests on the requirement matrix. */
  requirement_id?: string;
  source_ids?: string[];
}

/** One vendor, and everything the autopilot can say about it. */
export interface VendorRecommendation {
  detector_id: string;
  vendor_name: string;
  /** What the technology is normally used for. Not a legal category. */
  category: string;
  /** Purpose code suggested for it, or null where none could be. */
  suggested_purpose: string | null;
  /** Canonical data categories the regimes in play attach to this. */
  data_categories: string[];
  /** Jurisdictions this recommendation was computed under. */
  jurisdictions: string[];
  /**
   * Whether a consent requirement was found, as the engine reports it.
   * `"conditional"` and `"unknown"` are real answers and are never flattened.
   */
  consent_requirement: "required" | "not_required" | "conditional" | "unknown";
  /** Whether an opt-out mechanism was found to be required. */
  opt_out_requirement: "required" | "not_required" | "unknown";
  recommended_action: RecommendedAction;
  /** Plain-language why, for a person who will not read a citation. */
  reason: string;
  confidence: "high" | "medium" | "low";
  evidence: RecommendationEvidence[];
  /** Requirement ids behind the recommendation, for an auditor who will. */
  rule_references: string[];
  /** True when an operator override produced this line instead of the engine. */
  overridden: boolean;
  /** The operator's note, where they left one. */
  override_note: string | null;
  /**
   * Whether the current scan still sees this vendor.
   *
   * False for a vendor carried forward from an override or an earlier approved
   * version but absent from the latest scan. It is reported rather than dropped:
   * a vendor vanishing from a scan is usually a crawl that reached fewer pages,
   * not a vendor that was removed.
   */
  observed_in_latest_scan: boolean;
}

/** The generated policy, before anybody has approved it. */
export interface RecommendedPolicy {
  site_id: string;
  scan_id: string | null;
  jurisdictions: string[];
  regimes: string[];
  recommendations: VendorRecommendation[];
  /** Everything the policy engine would not decide. Usually the longer list. */
  open_questions: Array<{ reason: string; detail: string }>;
  /** Purpose codes referenced that the organisation has not declared. */
  undeclared_purposes: string[];
  /** Always true for MVP: nothing activates without a human approving it. */
  requires_approval: true;
  legal_advice: false;
}

export interface ConsentPolicyVersionSummary {
  policy_version_id: string;
  site_id: string;
  version: number;
  status: "draft" | "approved" | "superseded";
  scan_id: string | null;
  jurisdictions: string[];
  regimes: string[];
  approval_note: string | null;
  created_at: string;
  approved_at: string | null;
  recommendations: VendorRecommendation[];
}

export interface RecommendedPolicyResponse {
  policy: RecommendedPolicy;
  /** The approved version currently serving the runtime, if any. */
  active_version: ConsentPolicyVersionSummary | null;
}

export interface ConsentPolicyVersionListResponse {
  versions: ConsentPolicyVersionSummary[];
}

export interface OverrideSummary {
  detector_id: string;
  purpose_code: string | null;
  action: RecommendedAction;
  note: string | null;
  updated_at: string;
}

export interface OverrideListResponse {
  overrides: OverrideSummary[];
}
