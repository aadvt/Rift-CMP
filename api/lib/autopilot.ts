/**
 * The consent autopilot: generating a recommended policy.
 *
 * Takes a scan, the jurisdictions an operator says it serves, the purposes it
 * has declared and any overrides it has set, and produces one recommendation
 * per detected vendor — each carrying a reason, evidence, rule references and a
 * confidence.
 *
 * ## It recommends. It does not conclude.
 *
 * The brief is explicit that this must not silently claim legal certainty, and
 * the honest way to honour that is not a disclaimer at the bottom of a screen —
 * it is making "we do not know" a first-class outcome that appears in the data.
 * So:
 *
 *  - `consent_requirement` has four values, and `conditional` and `unknown` are
 *    two of them. Nothing flattens them into a boolean.
 *  - `recommended_action` includes `review`, and an input the engine cannot
 *    resolve produces `review` rather than `allow`. Absence never permits — the
 *    same rule the policy engine holds itself to.
 *  - Every line carries `rule_references`, so a recommendation that cites
 *    nothing is visibly a recommendation that rests on nothing.
 *
 * ## `block` is advice, not behaviour
 *
 * Rift blocks nothing. The runtime renders a banner and records decisions;
 * whether a tag actually loads is decided by the customer's own integration.
 * An action named `block` that silently did not block would be worse than no
 * recommendation at all, so the word means "we suggest you do not load this
 * yet" everywhere it appears, and the review screen says so in those words.
 *
 * ## An override always wins
 *
 * A regenerated recommendation never overwrites a considered human judgement.
 * Overrides are keyed on the detector rather than on a scan row, so they
 * survive the vendor disappearing from a scan and reapply when it returns.
 *
 * Research artifact, not legal advice. See docs/consent-autopilot.md.
 */

import {
  evaluate,
  resolveJurisdictions,
  WEBSITE_OPERATOR_ROLES,
  type DetectedLocation,
  type Jurisdiction,
} from "@rift-cmp/policy";
import type {
  RecommendationEvidence,
  RecommendedAction,
  RecommendedPolicy,
  VendorRecommendation,
} from "@rift-cmp/shared";
import type { DeclaredPurpose, ScannedTechnology } from "./consent-config";

/** An operator's standing decision about one vendor. */
export interface OverrideInput {
  detectorId: string;
  purposeCode: string | null;
  action: RecommendedAction;
  note: string | null;
}

export interface AutopilotInput {
  siteId: string;
  scanId: string | null;
  /** Technologies from the latest completed scan. */
  technologies: readonly ScannedTechnology[];
  declaredPurposes: readonly DeclaredPurpose[];
  overrides: readonly OverrideInput[];
  /** Markets the operator says it serves. Never derived from a visitor. */
  locationSignals: readonly DetectedLocation[];
  assertedJurisdictions?: readonly Jurisdiction[];
  asOf: Date;
}

/**
 * Scanner category to a suggested purpose and the data categories it implies.
 *
 * The single inference in the phase, and its standing is limited on purpose.
 * The category says what a technology is *normally used for*, which is not what
 * this operator uses it for and certainly not which of their declared purposes
 * covers it. It produces a suggestion carrying its evidence, and a human
 * decides.
 */
const CATEGORY_MAP: Record<
  string,
  { purpose: string; dataCategories: string[]; gated: boolean }
> = {
  analytics: {
    purpose: "analytics",
    dataCategories: ["device_data", "personal_data"],
    gated: true,
  },
  advertising: {
    purpose: "advertising",
    dataCategories: ["device_data", "personal_data"],
    gated: true,
  },
  marketing: {
    purpose: "marketing",
    dataCategories: ["contact_data", "personal_data"],
    gated: true,
  },
  social: {
    purpose: "social_media",
    dataCategories: ["device_data", "personal_data"],
    gated: true,
  },
  personalisation: {
    purpose: "personalisation",
    dataCategories: ["device_data"],
    gated: true,
  },
  /**
   * A consent manager is the mechanism by which consent is obtained, so gating
   * it on consent would be circular — the banner could never load to ask.
   */
  consent_management: {
    purpose: "essential",
    dataCategories: ["device_data"],
    gated: false,
  },
  security: { purpose: "essential", dataCategories: ["device_data"], gated: false },
  cdn: { purpose: "essential", dataCategories: ["device_data"], gated: false },
};

/** How the engine's consent finding maps onto a recommended action. */
function actionFor(
  requirement: VendorRecommendation["consent_requirement"],
  gated: boolean,
): RecommendedAction {
  if (!gated) return "allow";
  switch (requirement) {
    case "required":
      // "Do not load until a granted purpose exists" is the suggestion; the
      // customer's integration is what actually holds it back.
      return "block";
    case "conditional":
      // A conditional requirement turns on facts the matrix does not hold.
      // Suggesting `allow` would resolve it silently in the permissive
      // direction, which is the one that cannot be undone for a visitor.
      return "review";
    case "not_required":
      return "allow";
    case "unknown":
    default:
      return "review";
  }
}

export function generatePolicy(input: AutopilotInput): RecommendedPolicy {
  const resolution = resolveJurisdictions({
    signals: input.locationSignals,
    assertedJurisdictions: input.assertedJurisdictions,
  });

  const decision = evaluate({
    jurisdictions: resolution.jurisdictions,
    actors: WEBSITE_OPERATOR_ROLES,
    asOf: input.asOf,
    processingContexts: ["cookies", "terminal_equipment", "tracking"],
  });

  // Consent obligations across every regime in play. Several regimes raising a
  // consent obligation is the ordinary case, not a conflict: the recommendation
  // is the same, and all of their citations are carried so a reviewer can see
  // it rested on more than one.
  const consentObligations = decision.obligations.filter(
    (o) => o.verdict === "REQUIRE_CONSENT",
  );
  const optOutObligations = decision.obligations.filter(
    (o) => o.verdict === "REQUIRE_OPT_OUT",
  );
  const conditionalConsent = decision.openQuestions.filter(
    (q) => q.reason === "conditional_consent" || q.reason === "conditional_exemption",
  );

  /**
   * The consent finding for the jurisdictions in play.
   *
   * Conservative where regimes disagree: if any regime raises a consent
   * obligation, the answer is `required`, because satisfying the stricter one
   * satisfies the other and the reverse is not true. That is the same
   * most-restrictive-wins rule the policy engine applies, applied again here
   * rather than reimplemented differently.
   */
  const consentRequirement: VendorRecommendation["consent_requirement"] =
    resolution.jurisdictions.length === 0
      ? "unknown"
      : consentObligations.length > 0
        ? "required"
        : conditionalConsent.length > 0
          ? "conditional"
          : "unknown";

  const optOutRequirement: VendorRecommendation["opt_out_requirement"] =
    resolution.jurisdictions.length === 0
      ? "unknown"
      : optOutObligations.length > 0
        ? "required"
        : "unknown";

  const regimeEvidence: RecommendationEvidence[] = consentObligations
    .slice(0, 4)
    .map((o) => ({
      kind: "regulation",
      detail: `${o.citation.regime} raises a consent obligation (${o.citation.ruleId}).`,
      requirement_id: o.citation.ruleId,
      source_ids: [...o.citation.sourceIds],
    }));

  const ruleReferences = [
    ...new Set(
      [...consentObligations, ...optOutObligations].map((o) => o.citation.ruleId),
    ),
  ].sort();

  const overrideByDetector = new Map(
    input.overrides.map((o) => [o.detectorId, o] as const),
  );
  const observed = new Set(
    input.technologies.map((t) => t.name.toLowerCase().replace(/\s+/g, "-")),
  );

  const recommendations: VendorRecommendation[] = [];
  const seen = new Set<string>();

  for (const technology of input.technologies) {
    const detectorId = technology.name.toLowerCase().replace(/\s+/g, "-");
    seen.add(detectorId);
    recommendations.push(
      buildOne({
        detectorId,
        vendorName: technology.name,
        category: technology.category,
        scanConfidence: technology.confidence,
        observedNow: true,
        override: overrideByDetector.get(detectorId) ?? null,
        jurisdictions: resolution.jurisdictions,
        consentRequirement,
        optOutRequirement,
        regimeEvidence,
        ruleReferences,
      }),
    );
  }

  // Overrides for vendors the latest scan did not see. Carried forward rather
  // than dropped: a vendor absent from one crawl has usually not been removed,
  // and discarding the operator's judgement about it would mean re-deciding
  // from scratch the moment it reappears.
  for (const override of input.overrides) {
    if (seen.has(override.detectorId)) continue;
    recommendations.push(
      buildOne({
        detectorId: override.detectorId,
        vendorName: override.detectorId,
        category: "unclassified",
        scanConfidence: "low",
        observedNow: observed.has(override.detectorId),
        override,
        jurisdictions: resolution.jurisdictions,
        consentRequirement,
        optOutRequirement,
        regimeEvidence,
        ruleReferences,
      }),
    );
  }

  recommendations.sort((a, b) =>
    a.detector_id < b.detector_id ? -1 : a.detector_id > b.detector_id ? 1 : 0,
  );

  const declared = new Set(input.declaredPurposes.filter((p) => p.isActive).map((p) => p.code));
  const undeclared = [
    ...new Set(
      recommendations
        .map((r) => r.suggested_purpose)
        .filter((p): p is string => !!p && !declared.has(p)),
    ),
  ].sort();

  return {
    site_id: input.siteId,
    scan_id: input.scanId,
    jurisdictions: [...resolution.jurisdictions],
    regimes: [...decision.regimes],
    recommendations,
    open_questions: decision.openQuestions.map((q) => ({
      reason: q.reason,
      detail: q.detail,
    })),
    undeclared_purposes: undeclared,
    requires_approval: true,
    legal_advice: false,
  };
}

function buildOne(input: {
  detectorId: string;
  vendorName: string;
  category: string;
  scanConfidence: "high" | "medium" | "low";
  observedNow: boolean;
  override: OverrideInput | null;
  jurisdictions: readonly Jurisdiction[];
  consentRequirement: VendorRecommendation["consent_requirement"];
  optOutRequirement: VendorRecommendation["opt_out_requirement"];
  regimeEvidence: readonly RecommendationEvidence[];
  ruleReferences: readonly string[];
}): VendorRecommendation {
  const mapping = CATEGORY_MAP[input.category];
  const evidence: RecommendationEvidence[] = [
    {
      kind: "scan_technology",
      detail: input.observedNow
        ? `${input.vendorName} was observed and classified as ${input.category} with ${input.scanConfidence} confidence.`
        : `${input.vendorName} is not in the latest scan. This line is carried forward from an operator override.`,
    },
    ...(mapping
      ? [
          {
            kind: "catalogue",
            detail: `The catalogue treats ${input.category} as ${mapping.gated ? "consent-gated" : "not consent-gated"} and suggests the purpose "${mapping.purpose}".`,
          },
        ]
      : []),
    ...input.regimeEvidence,
  ];

  // An unclassified vendor cannot be assigned a purpose, and guessing one would
  // be the confident-and-wrong failure the whole design avoids.
  const engineAction: RecommendedAction = mapping
    ? actionFor(input.consentRequirement, mapping.gated)
    : "review";

  const engineReason = mapping
    ? input.consentRequirement === "required" && mapping.gated
      ? `A consent obligation was found for the jurisdictions you selected, and ${input.category} is treated as consent-gated. Suggest not loading it until the purpose is granted.`
      : input.consentRequirement === "conditional" && mapping.gated
        ? "A consent requirement was found, but it turns on facts the matrix does not hold. This needs a person."
        : !mapping.gated
          ? `${input.category} is treated as not consent-gated, so no gate is suggested. You decide whether that is right for your site.`
          : "No consent obligation was found for the jurisdictions you selected. That is not a finding that none applies."
    : `${input.vendorName} was not matched to a known category, so nothing can be recommended for it. An unknown third party is the row worth looking at first.`;

  const confidence: VendorRecommendation["confidence"] = !mapping
    ? "low"
    : input.consentRequirement === "required" && input.scanConfidence === "high"
      ? "high"
      : input.scanConfidence === "low" || input.consentRequirement === "unknown"
        ? "low"
        : "medium";

  if (input.override) {
    return {
      detector_id: input.detectorId,
      vendor_name: input.vendorName,
      category: input.category,
      suggested_purpose: input.override.purposeCode,
      data_categories: mapping?.dataCategories ?? [],
      jurisdictions: [...input.jurisdictions],
      consent_requirement: input.consentRequirement,
      opt_out_requirement: input.optOutRequirement,
      recommended_action: input.override.action,
      reason:
        "Set by you, not generated. Regenerating the policy does not change it.",
      // An override is a human decision and is reported at high confidence in
      // *itself* - not because the underlying detection improved.
      confidence: "high",
      evidence: [
        {
          kind: "override",
          detail: input.override.note
            ? `Operator override: ${input.override.action}. "${input.override.note}"`
            : `Operator override: ${input.override.action}.`,
        },
        ...evidence,
      ],
      rule_references: [...input.ruleReferences],
      overridden: true,
      override_note: input.override.note,
      observed_in_latest_scan: input.observedNow,
    };
  }

  return {
    detector_id: input.detectorId,
    vendor_name: input.vendorName,
    category: input.category,
    suggested_purpose: mapping?.purpose ?? null,
    data_categories: mapping?.dataCategories ?? [],
    jurisdictions: [...input.jurisdictions],
    consent_requirement: input.consentRequirement,
    opt_out_requirement: input.optOutRequirement,
    recommended_action: engineAction,
    reason: engineReason,
    confidence,
    evidence,
    rule_references: [...input.ruleReferences],
    overridden: false,
    override_note: null,
    observed_in_latest_scan: input.observedNow,
  };
}

/**
 * Re-exported so route handlers never import `@rift-cmp/policy` themselves.
 * The boundary held in `policy-boundary.test.ts` is the strict form: no file
 * under `api/app` mentions the engine at all, not even for a type.
 */
export type { DetectedLocation, Jurisdiction } from "@rift-cmp/policy";
