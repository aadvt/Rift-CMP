/**
 * A posture score, and everything needed to argue with it.
 *
 * ## What this is not
 *
 * It is not a compliance certification and does not claim one. No number can
 * tell an operator whether they comply with a law, because compliance turns on
 * facts about their business that this platform does not hold and on judgement
 * it is not entitled to make. `legal_advice: false` is on the contract for the
 * same reason it is on the policy engine's output.
 *
 * What it *can* say is whether the operational scaffolding is in place: is a
 * configuration approved, is the scan recent enough to be worth trusting, are
 * observed trackers accounted for, does the runtime enforce anything, do the
 * decisions carry the evidence that makes them provable later. Those are facts
 * about the deployment and they are worth a number.
 *
 * ## Why acceptance rate is not in it
 *
 * A site that shows no banner and records nothing has a 100% acceptance rate.
 * A site with a well-built preference centre and an honest reject button has a
 * lower one. Scoring acceptance would reward the first and punish the second,
 * which is precisely backwards, and an operator who optimised for the score
 * would end up with a worse consent experience. Acceptance is reported in
 * analytics, where it belongs, and kept out of here.
 *
 * ## Why every component carries its own evidence
 *
 * A score somebody cannot argue with is a score they cannot act on. Each
 * component states what was measured, out of what, and what would move it —
 * so "78/100" is never the whole answer and never has to be taken on trust.
 */

export type QualityComponentId =
  | "consent_coverage"
  | "policy_completeness"
  | "enforcement_coverage"
  | "tracker_resolution"
  | "shadow_trackers"
  | "scanner_freshness"
  | "drift_risk"
  | "jurisdiction_coverage"
  | "proof_completeness";

/** How much a component is worth. Weights sum to 100 across the set. */
export interface QualityComponent {
  id: QualityComponentId;
  label: string;
  /** 0–1, or null when the input for this component does not exist yet. */
  ratio: number | null;
  /** Points available for this component. */
  weight: number;
  /** Points earned. Zero when `ratio` is null and the component is penalised. */
  earned: number;
  /**
   * Whether a missing input costs points or is set aside.
   *
   * Not everything absent is a failure. A site with no scan has no tracker
   * resolution to measure, and scoring that as zero would say "you have
   * unresolved trackers" when the truth is "nobody has looked yet" — a
   * different problem with a different fix. Those components are excluded and
   * the score is taken over what remains, which is stated rather than hidden.
   */
  applicable: boolean;
  /** What was measured, in one sentence a person can check. */
  detail: string;
  /** What would raise it. Null when the component is already full marks. */
  remedy: string | null;
}

export interface ConsentQualityScore {
  site_id: string;
  /** 0–100, rounded, over applicable components only. */
  score: number;
  /** `strong` ≥ 85, `fair` ≥ 65, `weak` below. Bands, not verdicts. */
  band: "strong" | "fair" | "weak";
  components: QualityComponent[];
  /** Components set aside because their input does not exist yet. */
  not_applicable: QualityComponentId[];
  /** Points available across applicable components. */
  weight_considered: number;
  computed_at: string;
  /** Always false. This is an operational posture score. */
  legal_advice: false;
}

export interface ConsentQualityResponse {
  quality: ConsentQualityScore;
}

/**
 * The model, as data.
 *
 * Weights live here rather than being scattered through the computation, so
 * the scoring model can be read in one place and changed without hunting.
 * Documented in `docs/consent-quality.md`.
 */
export const QUALITY_WEIGHTS: Record<QualityComponentId, number> = {
  consent_coverage: 15,
  policy_completeness: 15,
  enforcement_coverage: 12,
  tracker_resolution: 15,
  shadow_trackers: 15,
  scanner_freshness: 10,
  drift_risk: 8,
  jurisdiction_coverage: 5,
  proof_completeness: 5,
};

export function bandFor(score: number): ConsentQualityScore["band"] {
  if (score >= 85) return "strong";
  if (score >= 65) return "fair";
  return "weak";
}
