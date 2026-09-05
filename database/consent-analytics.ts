import type {
  ConsentAnalytics,
  ConsentBreakdownRow,
  ConsentRates,
  ConsentTrendPoint,
} from "@rift-cmp/shared";
import { UNAVAILABLE_CONSENT_DIMENSIONS } from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";
import { type AnalyticsFilter, resolveRange } from "./analytics";

/**
 * Consent, counted.
 *
 * Two different questions live here and they are answered differently.
 *
 * **Totals and breakdowns count decisions.** Every row in the log, including
 * repeats, because "how many times did somebody change their mind about
 * analytics" is a real question and averaging it away loses it.
 *
 * **Rates count people.** A person who accepts, withdraws, then accepts again
 * is one person who currently accepts. Computing acceptance from the decision
 * log would make one indecisive visitor look like three visitors, two of whom
 * refused. So rates collapse to each principal's newest decision per purpose —
 * the same "newest decision wins" rule the runtime applies, because a number on
 * a dashboard that disagrees with what the banner does is worse than no number.
 *
 * Everything is scoped to the caller's sites, resolved from the organisation
 * rather than taken from the request.
 */

/** Enough to be useful, few enough that one noisy vendor cannot fill the page. */
const BREAKDOWN_LIMIT = 25;

const EMPTY_TOTALS = {
  decisions: 0,
  granted: 0,
  denied: 0,
  withdrawn: 0,
  principals: 0,
} as const;

const EMPTY_RATES: ConsentRates = {
  acceptance_rate: null,
  rejection_rate: null,
  partial_rate: null,
  withdrawal_rate: null,
  principals: 0,
};

type DecisionRow = {
  principalId: string;
  purposeId: string;
  status: string;
  decidedAt: Date;
  siteId: string;
  policyVersionId: string | null;
  policyConfigVersion: string | null;
  mechanism: string | null;
  jurisdictions: string[];
  vendors: string[];
};

/** A share, or null when there is nothing to take a share of. */
function rate(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1000) / 1000;
}

/**
 * Turns counted groups into breakdown rows.
 *
 * `null` keys survive as `null` rather than becoming "unknown" strings, so a
 * caller can tell a decision whose jurisdiction was never recorded from one
 * recorded as the literal word "unknown".
 */
function toRows(
  counts: Map<string | null, { granted: number; denied: number; withdrawn: number }>,
  label: (key: string | null) => string,
): ConsentBreakdownRow[] {
  return [...counts]
    .map(([key, c]) => {
      const total = c.granted + c.denied + c.withdrawn;
      return {
        key,
        label: label(key),
        granted: c.granted,
        denied: c.denied,
        withdrawn: c.withdrawn,
        total,
        acceptance_rate: rate(c.granted, total),
      };
    })
    .sort((a, b) => b.total - a.total || (a.label < b.label ? -1 : 1))
    .slice(0, BREAKDOWN_LIMIT);
}

/** Adds one decision to a bucket, creating it on first sight. */
function tally(
  counts: Map<string | null, { granted: number; denied: number; withdrawn: number }>,
  key: string | null,
  status: string,
) {
  const c = counts.get(key) ?? { granted: 0, denied: 0, withdrawn: 0 };
  if (status === "GRANTED") c.granted += 1;
  else if (status === "DENIED") c.denied += 1;
  else if (status === "WITHDRAWN") c.withdrawn += 1;
  counts.set(key, c);
}

/**
 * Collapses the decision log to what each principal currently holds.
 *
 * Newest decision per (principal, purpose) wins. Rows arrive ordered oldest
 * first, so later writes simply overwrite earlier ones.
 */
function effectiveByPrincipal(rows: DecisionRow[]): Map<string, Map<string, string>> {
  const effective = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const byPurpose = effective.get(row.principalId) ?? new Map<string, string>();
    byPurpose.set(row.purposeId, row.status);
    effective.set(row.principalId, byPurpose);
  }
  return effective;
}

/**
 * Rates over people, from their effective state.
 *
 * "Partial" is the interesting one and the reason this cannot be done in SQL
 * with a GROUP BY: it is a property of a principal's whole set of decisions,
 * not of any single row. Somebody who granted analytics and refused marketing
 * is neither an acceptance nor a rejection, and counting them as either would
 * misreport the thing operators most want to know.
 */
function computeRates(rows: DecisionRow[]): ConsentRates {
  const effective = effectiveByPrincipal(rows);
  if (effective.size === 0) return EMPTY_RATES;

  let accepted = 0;
  let rejected = 0;
  let partial = 0;
  let withdrew = 0;

  for (const byPurpose of effective.values()) {
    const statuses = [...byPurpose.values()];
    const granted = statuses.filter((s) => s === "GRANTED").length;
    const refused = statuses.filter((s) => s === "DENIED" || s === "WITHDRAWN").length;

    if (statuses.includes("WITHDRAWN")) withdrew += 1;

    if (granted > 0 && refused > 0) partial += 1;
    else if (granted > 0) accepted += 1;
    else if (refused > 0) rejected += 1;
  }

  const principals = effective.size;
  return {
    acceptance_rate: rate(accepted, principals),
    rejection_rate: rate(rejected, principals),
    partial_rate: rate(partial, principals),
    withdrawal_rate: rate(withdrew, principals),
    principals,
  };
}

function toTrend(rows: DecisionRow[]): ConsentTrendPoint[] {
  const days = new Map<string, { granted: number; denied: number; withdrawn: number }>();
  for (const row of rows) {
    const day = row.decidedAt.toISOString().slice(0, 10);
    const c = days.get(day) ?? { granted: 0, denied: 0, withdrawn: 0 };
    if (row.status === "GRANTED") c.granted += 1;
    else if (row.status === "DENIED") c.denied += 1;
    else if (row.status === "WITHDRAWN") c.withdrawn += 1;
    days.set(day, c);
  }
  return [...days]
    .map(([day, c]) => ({ day, ...c }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export async function getConsentAnalytics(
  prisma: PrismaClient,
  filter: AnalyticsFilter,
): Promise<ConsentAnalytics> {
  const { from, to } = resolveRange(filter);
  const range = { from: from.toISOString(), to: to.toISOString() };

  const sites = await prisma.website.findMany({
    where: {
      organisationId: filter.organisationId,
      ...(filter.siteId ? { id: filter.siteId } : {}),
    },
    select: { id: true, name: true },
  });
  const siteNames = new Map(sites.map((s) => [s.id, s.name]));
  const siteIds = sites.map((s) => s.id);

  const empty: ConsentAnalytics = {
    range,
    totals: { ...EMPTY_TOTALS },
    rates: { ...EMPTY_RATES },
    by_purpose: [],
    by_jurisdiction: [],
    by_policy_version: [],
    by_mechanism: [],
    by_vendor: [],
    by_site: [],
    trend: [],
    unavailable_dimensions: [...UNAVAILABLE_CONSENT_DIMENSIONS],
  };

  // A tenant with no sites is an ordinary state, not an error.
  if (siteIds.length === 0) return empty;

  const rows = (await prisma.consentRecord.findMany({
    where: {
      organisationId: filter.organisationId,
      siteId: { in: siteIds },
      decidedAt: { gte: from, lt: to },
    },
    // Oldest first, so "newest wins" is a plain overwrite while folding.
    orderBy: { decidedAt: "asc" },
    select: {
      principalId: true,
      purposeId: true,
      status: true,
      decidedAt: true,
      siteId: true,
      policyVersionId: true,
      policyConfigVersion: true,
      mechanism: true,
      jurisdictions: true,
      vendors: true,
    },
  })) as DecisionRow[];

  if (rows.length === 0) return empty;

  const purposes = await prisma.purpose.findMany({
    where: { organisationId: filter.organisationId },
    select: { id: true, code: true, name: true },
  });
  const purposeNames = new Map(purposes.map((p) => [p.id, p.name || p.code]));

  const byPurpose = new Map<string | null, { granted: number; denied: number; withdrawn: number }>();
  const byJurisdiction = new Map<string | null, { granted: number; denied: number; withdrawn: number }>();
  const byPolicy = new Map<string | null, { granted: number; denied: number; withdrawn: number }>();
  const byMechanism = new Map<string | null, { granted: number; denied: number; withdrawn: number }>();
  const byVendor = new Map<string | null, { granted: number; denied: number; withdrawn: number }>();
  const bySite = new Map<string | null, { granted: number; denied: number; withdrawn: number }>();

  const principals = new Set<string>();
  let granted = 0;
  let denied = 0;
  let withdrawn = 0;

  for (const row of rows) {
    principals.add(row.principalId);
    if (row.status === "GRANTED") granted += 1;
    else if (row.status === "DENIED") denied += 1;
    else if (row.status === "WITHDRAWN") withdrawn += 1;

    tally(byPurpose, row.purposeId, row.status);
    tally(byPolicy, row.policyConfigVersion ?? row.policyVersionId, row.status);
    tally(byMechanism, row.mechanism, row.status);
    tally(bySite, row.siteId, row.status);

    // A decision can name several jurisdictions and several vendors, and it
    // counts once under each. The rows therefore sum to more than the decision
    // count, which is correct: these are "decisions touching X", not a
    // partition of the total.
    if (row.jurisdictions.length === 0) tally(byJurisdiction, null, row.status);
    else for (const j of row.jurisdictions) tally(byJurisdiction, j, row.status);

    if (row.vendors.length === 0) tally(byVendor, null, row.status);
    else for (const v of row.vendors) tally(byVendor, v, row.status);
  }

  const notRecorded = (what: string) => (key: string | null) =>
    key === null ? `Not recorded (${what})` : key;

  return {
    range,
    totals: {
      decisions: rows.length,
      granted,
      denied,
      withdrawn,
      principals: principals.size,
    },
    rates: computeRates(rows),
    by_purpose: toRows(byPurpose, (k) => (k === null ? "Not recorded" : (purposeNames.get(k) ?? k))),
    by_jurisdiction: toRows(byJurisdiction, notRecorded("decided before jurisdictions were captured")),
    by_policy_version: toRows(byPolicy, notRecorded("no policy version in force")),
    by_mechanism: toRows(byMechanism, notRecorded("surface did not say")),
    by_vendor: toRows(byVendor, notRecorded("decision named no vendor")),
    by_site: toRows(bySite, (k) => (k === null ? "Not recorded" : (siteNames.get(k) ?? k))),
    trend: toTrend(rows),
    unavailable_dimensions: [...UNAVAILABLE_CONSENT_DIMENSIONS],
  };
}
