/**
 * Building the consent runtime configuration, and the proposal behind it.
 *
 * This is the only module in `api/` that imports `@rift-cmp/policy`, and that
 * import is the point of Phase 8B: the brief requires the UI to consume
 * policy-engine output, and until now nothing did — a test in
 * `policy-boundary.test.ts` failed the build if anything in `api/app` or
 * `api/lib` reached for it. That test now permits exactly this file and still
 * fails for any other, so the boundary moved deliberately rather than eroded.
 *
 * ## What the engine is allowed to decide here: nothing
 *
 * The engine annotates. It names the regimes that appear to apply and the
 * obligations they raise, each carrying the requirement id and sources behind
 * it, and it lists everything it would not decide. All of that goes onto the
 * **proposal**, which a person reads.
 *
 * None of it reaches {@link buildRuntimeConfig}. The banner's behaviour — which
 * purposes exist, which are essential, what the copy says — comes entirely from
 * what the operator has declared. A regime cannot switch a toggle on, and the
 * engine's output never crosses into the browser, because a platform that
 * refused or permitted live traffic on the strength of a research artifact
 * whose own coverage document lists `consent` as populated on 34 of 102 records
 * would be overstating what it knows.
 *
 * ## What is derived, and what is stored
 *
 * Nothing here is stored. The runtime config is *derived* on read from the
 * purposes and notice the operator already declared, so "activate" is not a new
 * concept with its own table and its own opportunity to disagree with the
 * consent domain — it is the act of declaring a purpose, which already exists.
 *
 * Research artifact, not legal advice. See docs/consent-experience.md.
 */

import { createHash } from "node:crypto";
import {
  evaluate,
  resolveJurisdictions,
  WEBSITE_OPERATOR_ROLES,
  type DetectedLocation,
  type Jurisdiction,
} from "@rift-cmp/policy";
import {
  CONSENT_FALLBACK_TEXT,
  type ConsentProposal,
  type EnforcementConfig,
  type EnforcementRule,
  type ConsentPurposeConfig,
  type ConsentRuntimeConfig,
  type ProposalEvidence,
  type ProposedPurpose,
} from "@rift-cmp/shared";

/** A purpose as the consent domain holds it. */
export interface DeclaredPurpose {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

/** The notice in force, when one is published. */
export interface ActiveNotice {
  noticeId: string;
  version: string;
  locale: string;
  policyVersionId: string | null;
  documentUrl: string | null;
}

/** A technology the scanner reported. */
export interface ScannedTechnology {
  name: string;
  category: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Purpose codes an operator may declare as essential.
 *
 * Deliberately tiny, and deliberately *not* a judgement about necessity. A
 * purpose is essential because the operator says so; this list only decides
 * which codes the builder will accept that claim for without the operator
 * having to spell it out on every read. Anything else is `optional`, which is
 * the conservative default: rendering a purpose as switchable when it should
 * have been locked costs the operator a toggle, while the reverse denies a
 * visitor a choice they were entitled to.
 */
const CONVENTIONALLY_ESSENTIAL = new Set(["essential", "strictly_necessary", "necessary"]);

/**
 * A stable version for a rendered configuration.
 *
 * Hashes the content that is actually displayed, so an unchanged site yields an
 * unchanged value on every read — a timestamp would invalidate every cache and
 * re-prompt every visitor on each deploy, which is both wasteful and, since
 * re-prompting looks like a fresh consent request, misleading.
 */
export function configVersion(
  purposes: readonly ConsentPurposeConfig[],
  notice: ActiveNotice | null,
  enforcement?: EnforcementConfig | null,
): string {
  const material = JSON.stringify({
    purposes: purposes.map((p) => [p.code, p.name, p.description, p.kind, p.vendors]),
    notice: notice ? [notice.noticeId, notice.version, notice.locale] : null,
    // Included, or approving a policy would leave every cached config serving
    // the old rules for its full lifetime - enforcement silently a minute
    // behind the thing an operator just pressed a button to change.
    enforcement: enforcement
      ? [enforcement.mode, enforcement.unknown_host, enforcement.rules]
      : null,
  });
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}

/**
 * The configuration a browser renders.
 *
 * Takes only what the operator declared. No scan, no engine, no jurisdiction.
 */
export function buildRuntimeConfig(input: {
  siteId: string;
  purposes: readonly DeclaredPurpose[];
  notice: ActiveNotice | null;
  vendorsByPurpose?: Readonly<Record<string, string[]>>;
  text?: Partial<ConsentRuntimeConfig["text"]>;
  enforcement?: EnforcementConfig | null;
}): ConsentRuntimeConfig {
  const purposes: ConsentPurposeConfig[] = input.purposes
    .filter((p) => p.isActive)
    // Sorted by code so the rendered order is stable across reads; the database
    // makes no ordering promise and a banner whose rows move between loads is
    // one a visitor cannot form a habit with.
    .slice()
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
    .map((p, index) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      kind: CONVENTIONALLY_ESSENTIAL.has(p.code) ? "essential" : "optional",
      vendors: input.vendorsByPurpose?.[p.code] ?? [],
      order: index,
    }));

  return {
    site_id: input.siteId,
    config_version: configVersion(purposes, input.notice, input.enforcement ?? null),
    purposes,
    notice: input.notice
      ? {
          notice_id: input.notice.noticeId,
          version: input.notice.version,
          locale: input.notice.locale,
          policy_version_id: input.notice.policyVersionId,
          document_url: input.notice.documentUrl,
        }
      : null,
    text: {
      title: input.text?.title ?? null,
      body: input.text?.body ?? null,
      accept_all: input.text?.accept_all ?? null,
      reject_all: input.text?.reject_all ?? null,
      manage: input.text?.manage ?? null,
      save: input.text?.save ?? null,
      policy_url: input.text?.policy_url ?? input.notice?.documentUrl ?? null,
    },
    enforcement: input.enforcement ?? null,
    // A banner with no purposes offers no choices. Rendering one would present
    // a consent mechanism that cannot record a decision.
    ready: purposes.length > 0,
  };
}

/**
 * Vendors to show against each purpose, taken from an approved policy version.
 *
 * This is what approval actually changes for a visitor. Before a version is
 * approved the preference centre lists purposes with no vendors, because the
 * platform has no basis to say which vendor serves which of an operator's
 * purposes — only the operator does, and approving is where they say so.
 *
 * Only vendors the operator did not mark `ignore` are listed, and an `ignore`
 * is a statement that the vendor is out of scope rather than a way to hide it
 * from visitors — a hidden vendor that still loads is the failure this whole
 * product exists to surface, so it is worth being explicit that `ignore`
 * removes it from *this* list and from nothing else.
 */
export function vendorsByPurposeFrom(
  recommendations: readonly {
    suggested_purpose: string | null;
    vendor_name: string;
    recommended_action: string;
  }[],
): Record<string, string[]> {
  const byPurpose: Record<string, string[]> = {};
  for (const recommendation of recommendations) {
    const purpose = recommendation.suggested_purpose;
    if (!purpose || recommendation.recommended_action === "ignore") continue;
    const existing = byPurpose[purpose] ?? [];
    if (!existing.includes(recommendation.vendor_name)) {
      existing.push(recommendation.vendor_name);
    }
    byPurpose[purpose] = existing;
  }
  for (const key of Object.keys(byPurpose)) byPurpose[key].sort();
  return byPurpose;
}

/**
 * Turn an approved policy into rules a browser can apply.
 *
 * The vendor-to-host resolution happens here, using the same catalogue that
 * classified the vendor in the first place. Two different matching rules would
 * mean a vendor classified one way and enforced another - a discrepancy nobody
 * would see until a tag that should have been gated was not.
 *
 * `ignore` and `review` produce no rule. `ignore` is the operator saying the
 * vendor is out of scope; `review` is the autopilot saying it does not know,
 * and acting on "I do not know" by blocking would take down a site on the
 * strength of an absence.
 */
export function enforcementFrom(
  recommendations: readonly {
    vendor_name: string;
    suggested_purpose: string | null;
    recommended_action: string;
  }[],
  hostsForVendor: (vendor: string) => string[],
  options: { mode?: EnforcementConfig["mode"]; unknownHost?: EnforcementConfig["unknown_host"] } = {},
): EnforcementConfig {
  const rules: EnforcementRule[] = [];

  for (const recommendation of recommendations) {
    const action = recommendation.recommended_action;
    if (action !== "allow" && action !== "require_consent" && action !== "block") {
      continue;
    }
    for (const host of hostsForVendor(recommendation.vendor_name)) {
      rules.push({
        host,
        vendor: recommendation.vendor_name,
        purpose: recommendation.suggested_purpose,
        action,
      });
    }
  }

  rules.sort((a, b) => (a.host < b.host ? -1 : a.host > b.host ? 1 : 0));

  return {
    // `observe` unless an operator has deliberately chosen otherwise. Turning
    // enforcement on is the most dangerous thing they can do to their own site.
    mode: options.mode ?? "observe",
    rules,
    unknown_host: options.unknownHost ?? "allow",
  };
}

// ─── The proposal ────────────────────────────────────────────────────────────

/**
 * Scanner categories mapped to a suggested purpose.
 *
 * This is the only inference in the phase, and its status matters. It is a
 * **starting point for a human**, not a classification: the category comes from
 * the scanner's catalogue and says what a technology is *normally used for*,
 * which is not the same as what this operator uses it for, and certainly not
 * the same as which of their declared purposes covers it.
 *
 * The dashboard's configure page refuses to make this mapping automatic, for
 * good reasons. Nothing here overrides that — the output is labelled
 * `requires_review`, is never written anywhere, and every line carries the
 * evidence that produced it so a reviewer can disagree with it specifically
 * rather than in general.
 */
const CATEGORY_TO_PURPOSE: Record<
  string,
  { code: string; name: string; description: string }
> = {
  analytics: {
    code: "analytics",
    name: "Analytics",
    description:
      "Measuring how visitors use the site, such as which pages are viewed and how people arrive.",
  },
  advertising: {
    code: "advertising",
    name: "Advertising",
    description:
      "Selecting and measuring advertising, which may involve sharing information with advertising partners.",
  },
  marketing: {
    code: "marketing",
    name: "Marketing",
    description:
      "Marketing activity such as campaign measurement and audience building.",
  },
  social: {
    code: "social_media",
    name: "Social media",
    description: "Embedded social media features and sharing tools.",
  },
  personalisation: {
    code: "personalisation",
    name: "Personalisation",
    description: "Remembering preferences and tailoring what the site shows.",
  },
  consent_management: {
    code: "essential",
    name: "Essential",
    description:
      "Technologies the site reports as needed for it to work, including recording your consent choices.",
  },
};

/** Build the review artifact. Pure: no I/O, no writes, no clock beyond `asOf`. */
export function buildProposal(input: {
  siteId: string;
  scanId: string | null;
  technologies: readonly ScannedTechnology[];
  declaredPurposes: readonly DeclaredPurpose[];
  /** Location observations the caller already holds. Never gathered for this. */
  locationSignals: readonly DetectedLocation[];
  /** Jurisdictions the operator asserts outright, if any. */
  assertedJurisdictions?: readonly Jurisdiction[];
  asOf: Date;
}): ConsentProposal {
  const resolution = resolveJurisdictions({
    signals: input.locationSignals,
    assertedJurisdictions: input.assertedJurisdictions,
  });

  const decision = evaluate({
    jurisdictions: resolution.jurisdictions,
    // A company running its own site decides the purposes *and* operates the
    // service; asking as only the first loses every terminal-equipment
    // requirement, which is most of what a consent banner exists for.
    actors: WEBSITE_OPERATOR_ROLES,
    asOf: input.asOf,
    processingContexts: ["cookies", "terminal_equipment", "tracking"],
  });

  const declared = new Set(input.declaredPurposes.map((p) => p.code));

  // Group technologies by the purpose their category suggests.
  const grouped = new Map<string, ScannedTechnology[]>();
  const unmapped: ConsentProposal["unmapped_technologies"] = [];
  for (const technology of input.technologies) {
    const target = CATEGORY_TO_PURPOSE[technology.category];
    if (!target) {
      unmapped.push({
        name: technology.name,
        category: technology.category,
        confidence: technology.confidence,
      });
      continue;
    }
    grouped.set(target.code, [...(grouped.get(target.code) ?? []), technology]);
  }

  // Regime-level evidence, attached to every suggestion: the same obligations
  // bear on each purpose, and repeating them per row is what lets a reviewer
  // read one line without holding the whole page in their head.
  const regimeEvidence: ProposalEvidence[] = decision.obligations
    .filter((o) => o.verdict === "REQUIRE_CONSENT")
    .slice(0, 5)
    .map((o) => ({
      kind: "regulation",
      detail: `${o.citation.regime} raises a consent obligation (${o.citation.ruleId}).`,
      requirement_id: o.citation.ruleId,
      source_ids: [...o.citation.sourceIds],
    }));

  const purposes: ProposedPurpose[] = [...grouped.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([code, technologies]) => {
      const template = Object.values(CATEGORY_TO_PURPOSE).find((t) => t.code === code)!;
      const confidences = technologies.map((t) => t.confidence);
      // The weakest observation sets the tone. Proposing at `high` because one
      // of five technologies was certain would overstate the case.
      const confidence = confidences.includes("low")
        ? "low"
        : confidences.includes("medium")
          ? "medium"
          : "high";

      return {
        suggested_code: template.code,
        suggested_name: template.name,
        suggested_description: template.description,
        already_declared: declared.has(template.code),
        technologies: technologies.map((t) => t.name).sort(),
        confidence,
        evidence: [
          ...technologies.map((t) => ({
            kind: "scan_technology",
            detail: `${t.name} was observed and classified as ${t.category} with ${t.confidence} confidence.`,
          })),
          ...regimeEvidence,
        ],
      };
    });

  return {
    site_id: input.siteId,
    scan_id: input.scanId,
    jurisdictions: [...resolution.jurisdictions],
    jurisdiction_confidence: { ...resolution.confidenceByJurisdiction },
    regimes: [...decision.regimes],
    obligations: decision.obligations.map((o) => ({
      verdict: o.verdict,
      requirement_id: o.citation.ruleId,
      regime: o.citation.regime,
      summary: o.citation.text,
    })),
    // Carried in full rather than summarised. The engine returns REVIEW far
    // more often than it returns an obligation, and hiding that would make the
    // proposal look more settled than the research behind it is.
    open_questions: decision.openQuestions.map((q) => ({
      reason: q.reason,
      detail: q.detail,
    })),
    purposes,
    unmapped_technologies: unmapped.sort((a, b) => (a.name < b.name ? -1 : 1)),
    requires_review: true,
    legal_advice: false,
  };
}

export { CONSENT_FALLBACK_TEXT };

/**
 * Re-exported so route handlers never import `@rift-cmp/policy` themselves.
 *
 * A type-only import is harmless at runtime, but the boundary is easier to hold
 * when it is "no file under `api/app` mentions the engine at all" than when it
 * is "only for types". `policy-boundary.test.ts` enforces the strict form.
 */
export type { DetectedLocation, Jurisdiction } from "@rift-cmp/policy";
