/**
 * Comparing two consent experiences without overstating what the comparison
 * shows.
 *
 * ## An observed difference is not a result
 *
 * Two arms will always produce different numbers. Most of those differences are
 * noise, and a dashboard that renders every one of them as though it meant
 * something teaches an operator to ship changes on the strength of forty
 * visitors. So every comparison carries an explicit reading, and the default
 * reading is `observed_difference` — a statement about the sample and nothing
 * more.
 *
 * A two-proportion z-test is computed where the sample supports one. It is a
 * real test with a stated method, a stated confidence level and a real interval;
 * where its own preconditions fail, it declines to produce a number rather than
 * producing one that looks the same and means less. There are no invented
 * p-values here, and nothing ever says "variant B wins".
 *
 * ## Acceptance is not the score
 *
 * The comparison deliberately puts acceptance next to enforcement coverage,
 * shadow trackers and drift. An arm can lift acceptance by asking less clearly,
 * and an arm that lifts acceptance while leaving more trackers unaccounted for
 * has made the site worse by the only measure this product actually holds. The
 * Consent Quality Score does not take acceptance as an input, and this surface
 * must not smuggle it back in by presenting acceptance as the outcome.
 */

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface VariantMetrics {
  variant_key: string;
  variant_name: string;
  is_control: boolean;
  allocation: number;

  /** Banner displays. The denominator every rate below is taken over. */
  impressions: number;
  /** People who made any decision. Not decisions — a person is counted once. */
  deciders: number;

  accepted_all: number;
  rejected_all: number;
  partial: number;
  withdrew: number;

  /**
   * Rates over `deciders`, or null when nobody has decided.
   *
   * Null rather than zero: "nobody accepted" and "nobody has been asked" are
   * different findings, and a zero here would be read as the first.
   */
  acceptance_rate: number | null;
  rejection_rate: number | null;
  partial_rate: number | null;
  withdrawal_rate: number | null;
  /** Deciders over impressions. How many people the banner got an answer from. */
  completion_rate: number | null;

  /** Purpose code to the number of people who granted it. */
  by_purpose: Array<{ purpose_code: string; granted: number; denied: number; rate: number | null }>;
}

/**
 * What an arm did to the site, as distinct from what it did to the numbers.
 *
 * Present so a lift in acceptance cannot be read on its own. These come from the
 * existing intelligence subsystems unchanged — an experiment does not compute
 * its own view of drift or shadow trackers, it reports theirs.
 */
export interface VariantPosture {
  /** Technologies observed and not covered by the approved configuration. */
  shadow_trackers: number;
  /** Differences from the approved configuration. */
  drift_findings: number;
  /** Enforcement decisions recorded while this arm was serving. */
  enforcement_events: number;
  /** Of those, ones that blocked or gated something. */
  enforcement_blocked: number;
  /**
   * Whether these are attributable to the arm at all.
   *
   * Usually false, and stated rather than implied: scans and enforcement are
   * site-wide, so a shadow tracker found during an experiment belongs to the
   * site, not to the arm a particular visitor happened to see. Presenting
   * site-wide findings per arm would invent an attribution the data cannot
   * support.
   */
  attributable_to_variant: boolean;
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export type ComparisonReading =
  /** The sample cannot support a test. Numbers are descriptive only. */
  | "observed_difference"
  /** A test ran and found the difference unlikely to be noise. */
  | "significant"
  /** A test ran and did not. */
  | "not_significant";

export interface SignificanceResult {
  reading: ComparisonReading;
  /** Named so a reader can check it, or object to it. */
  method: "two-proportion z-test" | null;
  confidence_level: 0.95 | null;
  /** The test statistic, where one was computed. */
  z: number | null;
  p_value: number | null;
  /** Difference in the metric, variant minus control. */
  difference: number | null;
  /** 95% interval on that difference. Null when no test ran. */
  interval: { lower: number; upper: number } | null;
  /** Smallest arm's sample, so a reader can judge the test for themselves. */
  sample: { control: number; variant: number };
  /** Why no test ran, when none did. */
  note: string | null;
}

/**
 * The normal CDF, via a numerical approximation of erf.
 *
 * Abramowitz & Stegun 7.1.26 — accurate to about 1.5e-7, which is far beyond
 * what a p-value shown to three decimals needs. Implemented here rather than
 * pulled in because this module is imported by the browser bundle and a
 * statistics dependency for one function is not a trade worth making.
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;

  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/**
 * The minimum each arm needs before a test is meaningful.
 *
 * The normal approximation behind a z-test needs roughly five expected successes
 * and five expected failures per arm. Thirty is a deliberately conservative
 * stand-in that also rules out the case an operator most wants to over-read: a
 * freshly started experiment with a handful of visitors and a 100% acceptance
 * rate in one arm.
 */
export const MINIMUM_SAMPLE = 30;

/**
 * Two-proportion z-test on a rate.
 *
 * Returns `observed_difference` with a reason whenever the test's own
 * preconditions are not met. That is the honest failure: declining to compute a
 * p-value is a statement a reader can act on, and computing one from twelve
 * visitors is a statement that looks identical and is not.
 */
export function compareProportions(
  control: { successes: number; total: number },
  variant: { successes: number; total: number },
): SignificanceResult {
  const sample = { control: control.total, variant: variant.total };

  const insufficient =
    control.total < MINIMUM_SAMPLE || variant.total < MINIMUM_SAMPLE;

  if (insufficient) {
    return {
      reading: "observed_difference",
      method: null,
      confidence_level: null,
      z: null,
      p_value: null,
      difference:
        control.total > 0 && variant.total > 0
          ? variant.successes / variant.total - control.successes / control.total
          : null,
      interval: null,
      sample,
      note: `Each arm needs at least ${MINIMUM_SAMPLE} decisions before a test says anything. These have ${control.total} and ${variant.total}.`,
    };
  }

  const p1 = control.successes / control.total;
  const p2 = variant.successes / variant.total;
  const difference = p2 - p1;

  const pooled = (control.successes + variant.successes) / (control.total + variant.total);
  const standardError = Math.sqrt(
    pooled * (1 - pooled) * (1 / control.total + 1 / variant.total),
  );

  if (standardError === 0) {
    // Both arms at 0% or both at 100%. There is no difference to test, and
    // dividing would produce an infinity that renders as a result.
    return {
      reading: "observed_difference",
      method: null,
      confidence_level: null,
      z: null,
      p_value: null,
      difference,
      interval: null,
      sample,
      note: "Both arms produced the same rate, so there is nothing to test.",
    };
  }

  const z = difference / standardError;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));

  // Unpooled standard error for the interval — the pooled one assumes the null
  // hypothesis, which is exactly what an interval on the difference does not.
  const intervalError = Math.sqrt(
    (p1 * (1 - p1)) / control.total + (p2 * (1 - p2)) / variant.total,
  );
  const margin = 1.959964 * intervalError;

  return {
    reading: pValue < 0.05 ? "significant" : "not_significant",
    method: "two-proportion z-test",
    confidence_level: 0.95,
    z: Math.round(z * 1000) / 1000,
    p_value: Math.round(pValue * 10000) / 10000,
    difference: Math.round(difference * 10000) / 10000,
    interval: {
      lower: Math.round((difference - margin) * 10000) / 10000,
      upper: Math.round((difference + margin) * 10000) / 10000,
    },
    sample,
    note: null,
  };
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface ExperimentComparison {
  experiment_id: string;
  name: string;
  status: string;
  site_id: string;
  policy_version_id: string | null;
  range: { from: string; to: string };

  control_key: string | null;
  variants: VariantMetrics[];
  posture: Record<string, VariantPosture>;

  /** Keyed by variant, then by metric. Control is absent from its own comparison. */
  significance: Record<string, Record<string, SignificanceResult>>;

  /**
   * What the platform will not tell you from this data.
   *
   * Served with the numbers for the same reason the enforcement log ships its
   * coverage note: a comparison table reads as a verdict unless something says
   * otherwise.
   */
  caveats: string[];
  legal_advice: false;
}

export interface PolicyVersionComparison {
  site_id: string;
  versions: Array<{
    policy_version_id: string;
    version: number;
    approved_at: string | null;
    decisions: number;
    principals: number;
    acceptance_rate: number | null;
    rejection_rate: number | null;
    partial_rate: number | null;
    withdrawal_rate: number | null;
    shadow_trackers: number | null;
    drift_findings: number | null;
  }>;
  /**
   * Differences between consecutive versions, always described as observed.
   *
   * Never "the policy caused". A version change coincides with everything else
   * that happened that week — a campaign, a season, a redesign — and nothing in
   * this data separates them. An experiment can support a causal claim; a
   * before-and-after cannot.
   */
  changes: Array<{
    from_version: number;
    to_version: number;
    metric: string;
    from: number | null;
    to: number | null;
    observed_change: number | null;
  }>;
  caveats: string[];
  legal_advice: false;
}

export const COMPARISON_CAVEATS = [
  "Rates count people, not decisions. Somebody who accepted, withdrew and accepted again is one visitor who currently accepts.",
  "Acceptance is not a quality measure. An arm can lift it by asking less clearly, which is why enforcement coverage and unaccounted-for trackers are shown beside it.",
  "Shadow tracker and drift counts are site-wide. Scans do not run per visitor, so a finding during an experiment belongs to the site rather than to an arm.",
  "Visitors are bucketed by a key held in their own browser. Clearing site data reassigns a browser, and a visitor using two browsers may see both arms.",
];

export const POLICY_COMPARISON_CAVEATS = [
  "These are observed changes, not effects. A configuration change coincides with everything else that happened at the same time, and nothing here separates them.",
  "Rates count people, not decisions.",
  "A version with few decisions will move a long way on very little evidence. Read the decision count beside every rate.",
];
