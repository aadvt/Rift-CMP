/**
 * `@rift-cmp/policy` - the policy and regulation engine.
 *
 * Answers one question: *given this processing activity and this context, what
 * requirements apply?* It reads the Phase 6B requirement matrix and nothing
 * else, holds no legal content of its own, and is not wired into any route.
 *
 * That last point is deliberate. The engine can answer questions about consent,
 * and the platform already enforces a rule about consent - "the decision in
 * force must be `GRANTED`" - but they are not the same rule and this phase does
 * not join them. The existing gate is a fact about a recorded decision; this
 * engine is a statement about what a regime requires. Wiring the second into the
 * first would mean the platform starts refusing traffic on the strength of a
 * research artifact, which is a product decision and a separate phase.
 *
 * ```ts
 * import { evaluate } from "@rift-cmp/policy";
 *
 * const decision = evaluate({
 *   jurisdictions: ["EU"],
 *   actors: WEBSITE_OPERATOR_ROLES,
 *   asOf: new Date("2026-09-04"),
 *   processingContexts: ["cookies"],
 * });
 *
 * decision.outcome;      // "REQUIRE_CONSENT"
 * decision.obligations;  // each carrying the requirement that imposed it
 * decision.openQuestions // everything it would not decide for you
 * ```
 *
 * Research artifact, not legal advice. See docs/policy-engine.md.
 */

export { evaluate } from "./evaluate";
export {
  resolveJurisdictions,
  resolveContext,
  type ActivityContext,
  type JurisdictionResolution,
  type ResolutionReason,
  type ResolvedContext,
} from "./resolve";
export {
  DEFAULT_JURISDICTION_RULES,
  jurisdictionsForRegion,
  looksLikeIpAddress,
  mappedRegions,
  normaliseRegion,
  type JurisdictionRules,
} from "./jurisdiction-rules";
export {
  CONFIDENCE_ORDER,
  DEFAULT_SOURCE_CONFIDENCE,
  SOURCE_IS_RESIDENCE_CLAIM,
  strongest,
  weakest,
  type Confidence,
  type DetectedLocation,
  type LocationSource,
  type ResolvedSignal,
  type VisitorContext,
} from "./location";
export {
  RULES,
  REGIMES,
  POPULATED_TOPICS,
  POPULATED_LEGAL_BASES,
  MATRIX_PROVENANCE,
  selectRules,
  type ExclusionReason,
  type Selection,
} from "./rules";
export {
  TOPIC_DISPOSITION,
  GATE_TOPICS,
  type Disposition,
  type TopicDisposition,
} from "./disposition";
export {
  VERDICT_SEVERITY,
  WEBSITE_OPERATOR_ROLES,
  type ActorRole,
  type AuthorityLevel,
  type CanonicalDataCategory,
  type ChildrenRequirement,
  type Citation,
  type ConsentRequirement,
  type Jurisdiction,
  type LegalBasis,
  type Obligation,
  type OpenQuestion,
  type OptOutRequirement,
  type Permission,
  type PolicyDecision,
  type ProcessingContext,
  type Purpose,
  type Regime,
  type Region,
  type RequirementType,
  type Rule,
  type Topic,
  type Vendor,
  type Verdict,
} from "./model";
