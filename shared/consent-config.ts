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
