/**
 * What can be said about consent decisions, and what deliberately cannot.
 *
 * ## The dimensions this contract does not have, and why
 *
 * A consent record carries the decision, the purpose, the jurisdictions the
 * resolver read at the time, the policy version in force, how it was expressed
 * and which vendors it named. It carries nothing about the person and nothing
 * about the browser.
 *
 * That is not an omission to be fixed later. `Principal` — the consent identity
 * — is deliberately never joined to analytics rows, and analytics rows are the
 * only place a device, browser or operating system is recorded. Answering
 * "acceptance rate by browser" would mean joining the two, which would make
 * every consent decision attributable to a browsing session. The question is
 * reasonable and the answer is worth less than the property it would cost.
 *
 * Country is absent for a related reason: nothing in the platform geolocates a
 * visitor. The jurisdiction resolver refuses raw IP addresses outright, and a
 * market is a statement a business makes about itself. So there is no country
 * to group by, and inventing one from a jurisdiction would be a guess wearing a
 * fact's clothing.
 *
 * `unavailable_dimensions` names these explicitly rather than leaving them out,
 * because a caller has to be able to tell "we measured this and it was zero"
 * from "this was never measurable". A chart of an empty breakdown says the
 * first when the truth is the second.
 */

/** A dimension that exists in the data and can be grouped on. */
export type ConsentDimension =
  | "purpose"
  | "jurisdiction"
  | "policy_version"
  | "mechanism"
  | "vendor"
  | "site"
  | "day";

/** A dimension a caller may reasonably ask for that this platform cannot answer. */
export interface UnavailableDimension {
  dimension: "country" | "region" | "device" | "browser" | "operating_system" | "page";
  /** One sentence, written for a person reading a dashboard. */
  reason: string;
}

/**
 * One row of a breakdown.
 *
 * `key` is `null` when the record exists but the field was never populated —
 * decisions written before the evidence fields existed, or a surface that named
 * no vendor. Rendered as "Not recorded", never merged into another bucket and
 * never dropped: a decision with no jurisdiction recorded is still a decision,
 * and hiding it would quietly change every rate computed from the total.
 */
export interface ConsentBreakdownRow {
  key: string | null;
  label: string;
  granted: number;
  denied: number;
  withdrawn: number;
  total: number;
  /** Granted as a share of decisions in this row, or null when there are none. */
  acceptance_rate: number | null;
}

export interface ConsentTotals {
  /** Every decision in range, including repeats by the same principal. */
  decisions: number;
  granted: number;
  denied: number;
  withdrawn: number;
  /** Distinct principals who decided at least once in range. */
  principals: number;
}

/**
 * Rates over the *effective* state, not the raw decision log.
 *
 * A person who accepts, withdraws, then accepts again is one person who
 * currently accepts — counting three decisions would make one indecisive
 * visitor look like three. So rates are computed from what each principal's
 * newest decision per purpose says, which is the same rule the runtime applies.
 */
export interface ConsentRates {
  /** Principals whose optional purposes are all granted. */
  acceptance_rate: number | null;
  /** Principals whose optional purposes are all denied or withdrawn. */
  rejection_rate: number | null;
  /** Principals who granted some optional purposes and refused others. */
  partial_rate: number | null;
  /** Principals holding at least one withdrawal as their newest decision. */
  withdrawal_rate: number | null;
  /** Principals counted. Every rate above is null when this is zero. */
  principals: number;
}

export interface ConsentTrendPoint {
  /** `YYYY-MM-DD`, in UTC. */
  day: string;
  granted: number;
  denied: number;
  withdrawn: number;
}

export interface ConsentAnalytics {
  range: { from: string; to: string };
  totals: ConsentTotals;
  rates: ConsentRates;
  by_purpose: ConsentBreakdownRow[];
  by_jurisdiction: ConsentBreakdownRow[];
  by_policy_version: ConsentBreakdownRow[];
  by_mechanism: ConsentBreakdownRow[];
  by_vendor: ConsentBreakdownRow[];
  by_site: ConsentBreakdownRow[];
  trend: ConsentTrendPoint[];
  unavailable_dimensions: UnavailableDimension[];
}

/**
 * The dimensions this platform will not answer, and the reason for each.
 *
 * Kept as data rather than prose so the dashboard shows the same explanation
 * the API gives, and so adding a dimension later means deleting an entry here
 * rather than hunting for the sentence that says it is impossible.
 */
export const UNAVAILABLE_CONSENT_DIMENSIONS: readonly UnavailableDimension[] = [
  {
    dimension: "country",
    reason:
      "Rift never geolocates a visitor, so no country is recorded against a decision. Jurisdictions are shown instead — they come from the markets you declared, not from where anyone was.",
  },
  {
    dimension: "region",
    reason:
      "Same as country: no visitor location is observed or stored, so there is nothing to group by.",
  },
  {
    dimension: "device",
    reason:
      "Device type is recorded on analytics events, and consent identity is deliberately never joined to those rows. Joining them would make every decision attributable to a browsing session.",
  },
  {
    dimension: "browser",
    reason:
      "Recorded on analytics events only, and kept separate from consent identity for the same reason as device.",
  },
  {
    dimension: "operating_system",
    reason:
      "Recorded on analytics events only, and kept separate from consent identity for the same reason as device.",
  },
  {
    dimension: "page",
    reason:
      "A consent decision is about a site and its purposes, not a page. The page a banner happened to appear on is not recorded.",
  },
] as const;

export interface ConsentAnalyticsResponse {
  consent: ConsentAnalytics;
}
