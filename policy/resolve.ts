/**
 * Turning observations into jurisdictions, and jurisdictions into requirements.
 *
 * Two functions. {@link resolveJurisdictions} answers "whose law is in play?"
 * from a set of dated observations; {@link resolveContext} carries that answer
 * into the Phase 7A evaluator so a caller gets the legal reading and the
 * reasoning behind the jurisdictions in one artifact.
 *
 * ## Union, not winner-take-all
 *
 * The brief's first instruction is never to assume exactly one law applies, and
 * that is a structural property here rather than a caution: jurisdictions
 * **accumulate**. There is no ranking step, no best-signal selection and no
 * tie-break. A visitor whose address resolves to Germany, on a service whose
 * operator has decided to offer into India, is in both - and that is the
 * ordinary case, not a conflict to be resolved.
 *
 * This is why a "conflicting signals" input has no special handling. Two
 * observations naming different regions are not in conflict about the law; they
 * are two reasons the law might attach. The disagreement is recorded, and both
 * jurisdictions are returned.
 *
 * ## Confidence never removes a jurisdiction
 *
 * A weak signal is reported as weak and still contributes. Dropping a
 * jurisdiction because the evidence for it was thin is precisely the error that
 * produces an under-inclusive legal reading - the failure mode that matters, and
 * the one that looks like success. Confidence tells a reader how much to trust a
 * reason; it is not a filter, and `resolve.ts` has no threshold to tune.
 *
 * Research artifact, not legal advice.
 */

import { evaluate } from "./evaluate";
import {
  DEFAULT_JURISDICTION_RULES,
  jurisdictionsForRegion,
  looksLikeIpAddress,
  normaliseRegion,
  type JurisdictionRules,
} from "./jurisdiction-rules";
import {
  DEFAULT_SOURCE_CONFIDENCE,
  SOURCE_IS_RESIDENCE_CLAIM,
  strongest,
  type Confidence,
  type DetectedLocation,
  type ResolvedSignal,
  type VisitorContext,
} from "./location";
import { RULES } from "./rules";
import type {
  Jurisdiction,
  PolicyDecision,
  ProcessingContext,
  Regime,
  Rule,
} from "./model";

/** Why a jurisdiction is - or is not - in the answer. */
export interface ResolutionReason {
  readonly kind:
    | "signal_mapped"
    | "operator_asserted"
    | "region_unmapped"
    | "region_unrecognised"
    | "region_rejected"
    | "signals_disagree"
    | "no_signals";
  readonly detail: string;
  readonly jurisdiction?: Jurisdiction;
  readonly region?: string;
  readonly source?: DetectedLocation["source"];
  readonly confidence?: Confidence;
}

export interface JurisdictionResolution {
  /** Every observation, with defaults applied and its mapping recorded. */
  readonly signals: readonly ResolvedSignal[];
  /** The union, sorted. Empty is a valid answer and means "we do not know". */
  readonly jurisdictions: readonly Jurisdiction[];
  /**
   * Regimes the evaluator will consider for those jurisdictions by default.
   *
   * Excludes any regime whose every rule rests on `derived` authority, because
   * the evaluator holds those back unless a caller asks for them. Reporting a
   * regime here that the decision then never cites would be the resolver and the
   * evaluator disagreeing - the same self-contradiction that made a single
   * `actor` wrong.
   */
  readonly regimes: readonly Regime[];
  /**
   * Regimes in scope that rest on a research model rather than a published
   * instrument, and are evaluated only when `includeDerivedModels` is set.
   *
   * Separated rather than dropped: a Californian visitor really is covered by
   * the generic US state model, and losing that silently would be worse than
   * the contradiction it is avoiding.
   */
  readonly derivedRegimes: readonly Regime[];
  /**
   * Best confidence supporting each jurisdiction.
   *
   * Per jurisdiction rather than overall, because one answer can rest on a
   * declared residence and another on a locale header, and a single number
   * would hide which was which.
   */
  readonly confidenceByJurisdiction: Readonly<Record<string, Confidence>>;
  /** Highest confidence behind any jurisdiction, or null when there are none. */
  readonly overallConfidence: Confidence | null;
  readonly reasons: readonly ResolutionReason[];
  /** True where two observations named regions mapping to different sets. */
  readonly hasConflictingSignals: boolean;
  readonly rulesVersion: string;
  readonly legalAdvice: false;
}

/**
 * Which regimes the matrix carries for a set of jurisdictions.
 *
 * Read off the rule set rather than hard-coded, so a matrix that gains a regime
 * is reflected here without an edit.
 */
function regimesFor(
  jurisdictions: readonly Jurisdiction[],
  rules: readonly Rule[],
): { regimes: readonly Regime[]; derivedRegimes: readonly Regime[] } {
  const wanted = new Set(jurisdictions);
  const inScope = new Map<Regime, boolean>();
  for (const rule of rules) {
    if (!rule.regions.some((r) => wanted.has(r))) continue;
    // A regime counts as derived only when *every* rule reaching these
    // jurisdictions is derived. One statutory rule is enough to make the regime
    // something the evaluator will consider without being asked.
    const derived = rule.authorityLevel === "derived";
    const previous = inScope.get(rule.regime);
    inScope.set(rule.regime, previous === undefined ? derived : previous && derived);
  }
  const regimes: Regime[] = [];
  const derivedRegimes: Regime[] = [];
  for (const [regime, derived] of inScope) {
    (derived ? derivedRegimes : regimes).push(regime);
  }
  return { regimes: regimes.sort(), derivedRegimes: derivedRegimes.sort() };
}

/**
 * Resolve observations into jurisdictions.
 *
 * Pure, and deterministic given the same context and rule set.
 */
export function resolveJurisdictions(
  visitor: VisitorContext,
  rules: JurisdictionRules = DEFAULT_JURISDICTION_RULES,
  ruleSet: readonly Rule[] = RULES,
): JurisdictionResolution {
  const signals: ResolvedSignal[] = [];
  const reasons: ResolutionReason[] = [];
  const confidenceByJurisdiction: Record<string, Confidence> = {};

  const record = (jurisdiction: Jurisdiction, confidence: Confidence) => {
    const existing = confidenceByJurisdiction[jurisdiction];
    confidenceByJurisdiction[jurisdiction] = existing
      ? strongest(existing, confidence)
      : confidence;
  };

  for (const signal of visitor.signals) {
    const confidence = signal.confidence ?? DEFAULT_SOURCE_CONFIDENCE[signal.source];
    const base = {
      source: signal.source,
      confidence,
      isResidenceClaim: SOURCE_IS_RESIDENCE_CLAIM[signal.source],
      observedAt: signal.observedAt ?? null,
      note: signal.note ?? null,
    };

    // An address is refused outright rather than ignored, so a caller that has
    // misunderstood the boundary finds out.
    if (looksLikeIpAddress(signal.region)) {
      signals.push({ ...base, region: signal.region, jurisdictions: [] });
      reasons.push({
        kind: "region_rejected",
        detail:
          `"${signal.region}" looks like a network address. This resolver takes a ` +
          "derived region code and never an address: geolocation happens before it, " +
          "on the caller's side, and an address is personal data it will not accept.",
        region: signal.region,
        source: signal.source,
      });
      continue;
    }

    const region = normaliseRegion(signal.region);
    if (region === null) {
      signals.push({ ...base, region: signal.region, jurisdictions: [] });
      reasons.push({
        kind: "region_unrecognised",
        detail: `"${signal.region}" is not a recognisable ISO 3166 region code, so nothing was inferred from it.`,
        region: signal.region,
        source: signal.source,
      });
      continue;
    }

    const mapped = jurisdictionsForRegion(region, rules);
    signals.push({ ...base, region, jurisdictions: mapped });

    if (mapped.length === 0) {
      reasons.push({
        kind: "region_unmapped",
        detail: rules.unmappedRegions.includes(region)
          ? `${region} is recognised, and rule set ${rules.version} deliberately maps it to no jurisdiction: the matrix carries no requirements for it.`
          : `${region} is a well-formed region code that rule set ${rules.version} does not map. Treat this as "not carried", never as "nothing applies".`,
        region,
        source: signal.source,
        confidence,
      });
      continue;
    }

    for (const jurisdiction of mapped) {
      record(jurisdiction, confidence);
      reasons.push({
        kind: "signal_mapped",
        detail:
          `${region} maps to ${jurisdiction} under rule set ${rules.version}, from a ` +
          `${signal.source} observation of ${confidence} confidence` +
          (SOURCE_IS_RESIDENCE_CLAIM[signal.source]
            ? "."
            : " - which is evidence about a connection or a business decision, not about where this person lives."),
        jurisdiction,
        region,
        source: signal.source,
        confidence,
      });
    }
  }

  for (const jurisdiction of visitor.assertedJurisdictions ?? []) {
    record(jurisdiction, "high");
    reasons.push({
      kind: "operator_asserted",
      detail: `${jurisdiction} was asserted by the operator and applies regardless of any observation. This is an override, not a finding.`,
      jurisdiction,
      confidence: "high",
    });
  }

  // Signals disagree when two of them map to different, non-identical sets.
  // Recorded, never resolved: both jurisdictions stay in the answer.
  const mappedSets = signals
    .filter((s) => s.jurisdictions.length > 0)
    .map((s) => [...s.jurisdictions].sort().join(","));
  const hasConflictingSignals = new Set(mappedSets).size > 1;
  if (hasConflictingSignals) {
    reasons.push({
      kind: "signals_disagree",
      detail:
        "Observations point at different jurisdictions: " +
        signals
          .filter((s) => s.jurisdictions.length > 0)
          .map((s) => `${s.region} (${s.source}, ${s.confidence})`)
          .join("; ") +
        ". Both are kept. Signals disagreeing about a location is not a disagreement about the law, and discarding the weaker one would narrow the reading on no authority.",
    });
  }

  const jurisdictions = (Object.keys(confidenceByJurisdiction) as Jurisdiction[]).sort();

  if (jurisdictions.length === 0) {
    reasons.push({
      kind: "no_signals",
      detail:
        visitor.signals.length === 0
          ? "No observations were given and no jurisdiction was asserted, so none could be resolved. Declaring the markets the business targets is what makes this answerable without learning anything about the visitor."
          : "No observation mapped to a jurisdiction this rule set carries.",
    });
  }

  const overallConfidence =
    jurisdictions.length === 0
      ? null
      : jurisdictions
          .map((j) => confidenceByJurisdiction[j])
          .reduce((a, b) => strongest(a, b));

  return {
    signals,
    jurisdictions,
    ...regimesFor(jurisdictions, ruleSet),
    confidenceByJurisdiction,
    overallConfidence,
    reasons,
    hasConflictingSignals,
    rulesVersion: rules.version,
    legalAdvice: false,
  };
}

/** What the caller wants to do, minus the jurisdictions the resolver supplies. */
export type ActivityContext = Omit<ProcessingContext, "jurisdictions">;

export interface ResolvedContext {
  readonly resolution: JurisdictionResolution;
  readonly decision: PolicyDecision;
}

/**
 * The end-to-end call: observations in, legal reading out.
 *
 * The two halves stay separate in the result. A caller can see that a
 * `REVIEW` came from having no idea where the visitor is, rather than from the
 * matrix being silent about an activity - and those are very different problems
 * with very different fixes.
 *
 * When nothing resolves, the empty jurisdiction list is passed to the evaluator
 * unchanged, which returns `REVIEW` for `no_jurisdiction_given`. That chaining is
 * the point: neither half has to special-case the other, and "we do not know
 * where they are" cannot turn into "nothing is required" at the seam.
 */
export function resolveContext(
  visitor: VisitorContext,
  activity: ActivityContext,
  rules: JurisdictionRules = DEFAULT_JURISDICTION_RULES,
  ruleSet: readonly Rule[] = RULES,
): ResolvedContext {
  const resolution = resolveJurisdictions(visitor, rules, ruleSet);
  const decision = evaluate(
    { ...activity, jurisdictions: resolution.jurisdictions },
    ruleSet,
  );
  return { resolution, decision };
}
