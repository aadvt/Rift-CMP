import type {
  ExperimentComparison,
  PolicyVersionComparison,
  VariantMetrics,
  VariantPosture,
} from "@rift-cmp/shared/experiment-analytics";
import {
  COMPARISON_CAVEATS,
  POLICY_COMPARISON_CAVEATS,
  compareProportions,
} from "@rift-cmp/shared/experiment-analytics";
import type { PrismaClient } from "./generated/client";

/**
 * Reading an experiment out of the decision log.
 *
 * ## Rates count people, exactly as everywhere else
 *
 * The definitions here are lifted from `consent-analytics.ts` rather than
 * reinvented, and that matters more than it sounds: if "acceptance" meant one
 * thing on the consent page and a slightly different thing on the experiment
 * page, an operator would compare the two and conclude something about their
 * site from an artefact of two implementations.
 *
 * So "partial" is still a property of a person's whole set of decisions — granted
 * one purpose, refused another — which is why this cannot be a `GROUP BY` and
 * why the rows are folded in memory.
 *
 * ## Impressions come from a different table on purpose
 *
 * A banner shown and ignored leaves no consent record. Without impressions, an
 * acceptance rate is a percentage of the people who already chose something,
 * which is not the number anybody means and is systematically flattering: the
 * visitors who close a banner without answering are exactly the ones a bad
 * variant produces more of.
 */

function rate(part: number, whole: number): number | null {
  // Null rather than zero. "Nobody accepted" and "nobody has been asked" are
  // different findings, and a zero would be read as the first.
  return whole === 0 ? null : Math.round((part / whole) * 10000) / 10000;
}

interface DecisionRow {
  principalId: string;
  purposeId: string;
  purposeCode: string;
  status: string;
  variantKey: string | null;
}

/** The status in force per purpose, per person. Newest decision wins. */
function effectiveByPrincipal(rows: readonly DecisionRow[]) {
  const effective = new Map<string, Map<string, { status: string; code: string }>>();
  for (const row of rows) {
    const byPurpose = effective.get(row.principalId) ?? new Map();
    byPurpose.set(row.purposeId, { status: row.status, code: row.purposeCode });
    effective.set(row.principalId, byPurpose);
  }
  return effective;
}

function metricsFor(
  rows: readonly DecisionRow[],
  impressions: number,
  variant: { key: string; name: string; isControl: boolean; allocation: number },
): VariantMetrics {
  const effective = effectiveByPrincipal(rows);

  let accepted = 0;
  let rejected = 0;
  let partial = 0;
  let withdrew = 0;

  const purposeCounts = new Map<string, { granted: number; denied: number }>();

  for (const byPurpose of effective.values()) {
    const entries = [...byPurpose.values()];
    const granted = entries.filter((e) => e.status === "GRANTED").length;
    const refused = entries.filter((e) => e.status === "DENIED" || e.status === "WITHDRAWN").length;

    if (entries.some((e) => e.status === "WITHDRAWN")) withdrew += 1;

    if (granted > 0 && refused > 0) partial += 1;
    else if (granted > 0) accepted += 1;
    else if (refused > 0) rejected += 1;

    for (const entry of entries) {
      const count = purposeCounts.get(entry.code) ?? { granted: 0, denied: 0 };
      if (entry.status === "GRANTED") count.granted += 1;
      else count.denied += 1;
      purposeCounts.set(entry.code, count);
    }
  }

  const deciders = effective.size;

  return {
    variant_key: variant.key,
    variant_name: variant.name,
    is_control: variant.isControl,
    allocation: variant.allocation,
    impressions,
    deciders,
    accepted_all: accepted,
    rejected_all: rejected,
    partial,
    withdrew,
    acceptance_rate: rate(accepted, deciders),
    rejection_rate: rate(rejected, deciders),
    partial_rate: rate(partial, deciders),
    withdrawal_rate: rate(withdrew, deciders),
    // The number a bad variant hurts first: people who saw the banner and never
    // answered it.
    completion_rate: rate(deciders, impressions),
    by_purpose: [...purposeCounts.entries()]
      .map(([purpose_code, count]) => ({
        purpose_code,
        granted: count.granted,
        denied: count.denied,
        rate: rate(count.granted, count.granted + count.denied),
      }))
      .sort((a, b) => (a.purpose_code < b.purpose_code ? -1 : 1)),
  };
}

/**
 * Everything an experiment comparison shows.
 *
 * Scoped by organisation *and* experiment id in one query, so an experiment in
 * another tenant is indistinguishable from one that does not exist.
 */
export async function getExperimentComparison(
  prisma: PrismaClient,
  filter: { organisationId: string; experimentId: string; from?: Date; to?: Date },
): Promise<ExperimentComparison | null> {
  const experiment = await prisma.experiment.findFirst({
    where: { id: filter.experimentId, organisationId: filter.organisationId },
    include: { variants: true },
  });
  if (!experiment) return null;

  const from = filter.from ?? experiment.startsAt ?? experiment.createdAt;
  const to = filter.to ?? new Date();

  const [decisions, impressionRows, enforcement] = await Promise.all([
    prisma.consentRecord.findMany({
      where: {
        organisationId: filter.organisationId,
        siteId: experiment.siteId,
        experimentId: experiment.id,
        decidedAt: { gte: from, lte: to },
      },
      orderBy: [{ decidedAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }],
      select: {
        principalId: true,
        purposeId: true,
        status: true,
        variantKey: true,
        purpose: { select: { code: true } },
      },
    }),
    prisma.experimentEvent.groupBy({
      by: ["variantId"],
      where: { experimentId: experiment.id, kind: "impression", occurredAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.enforcementEvent.groupBy({
      by: ["decision"],
      where: { siteId: experiment.siteId, occurredAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
  ]);

  const impressionsByVariantId = new Map(
    impressionRows.map((row) => [row.variantId, row._count._all]),
  );

  const rows: DecisionRow[] = decisions.map((d) => ({
    principalId: d.principalId,
    purposeId: d.purposeId,
    purposeCode: d.purpose.code,
    status: d.status,
    variantKey: d.variantKey,
  }));

  const ordered = [...experiment.variants].sort((a, b) => (a.key < b.key ? -1 : 1));

  const variants = ordered.map((variant) =>
    metricsFor(
      rows.filter((row) => row.variantKey === variant.key),
      impressionsByVariantId.get(variant.id) ?? 0,
      {
        key: variant.key,
        name: variant.name,
        isControl: variant.isControl,
        allocation: variant.allocation,
      },
    ),
  );

  // Site-wide, and reported as such. Scans and enforcement do not run per
  // visitor, so attributing a finding to the arm somebody happened to see would
  // be inventing an attribution the data cannot support.
  const enforcementTotal = enforcement.reduce((sum, row) => sum + row._count._all, 0);
  const enforcementBlocked = enforcement
    .filter((row) => row.decision === "BLOCK" || row.decision === "REQUIRE_CONSENT")
    .reduce((sum, row) => sum + row._count._all, 0);

  const posture: Record<string, VariantPosture> = {};
  for (const variant of ordered) {
    posture[variant.key] = {
      shadow_trackers: 0,
      drift_findings: 0,
      enforcement_events: enforcementTotal,
      enforcement_blocked: enforcementBlocked,
      attributable_to_variant: false,
    };
  }

  const control = variants.find((v) => v.is_control) ?? null;
  const significance: ExperimentComparison["significance"] = {};

  if (control) {
    for (const variant of variants) {
      if (variant.is_control) continue;
      significance[variant.variant_key] = {
        acceptance: compareProportions(
          { successes: control.accepted_all, total: control.deciders },
          { successes: variant.accepted_all, total: variant.deciders },
        ),
        rejection: compareProportions(
          { successes: control.rejected_all, total: control.deciders },
          { successes: variant.rejected_all, total: variant.deciders },
        ),
        partial: compareProportions(
          { successes: control.partial, total: control.deciders },
          { successes: variant.partial, total: variant.deciders },
        ),
        completion: compareProportions(
          { successes: control.deciders, total: control.impressions },
          { successes: variant.deciders, total: variant.impressions },
        ),
      };
    }
  }

  return {
    experiment_id: experiment.id,
    name: experiment.name,
    status: experiment.status,
    site_id: experiment.siteId,
    policy_version_id: experiment.policyVersionId,
    range: { from: from.toISOString(), to: to.toISOString() },
    control_key: control?.variant_key ?? null,
    variants,
    posture,
    significance,
    caveats: [...COMPARISON_CAVEATS],
    legal_advice: false,
  };
}

/**
 * How consent behaviour differs between approved configurations.
 *
 * Described only as observed. A version change coincides with everything else
 * that happened that week — a campaign, a season, a redesign — and nothing in
 * this data separates them. An experiment can support a causal claim because it
 * randomises; a before-and-after cannot, and saying otherwise would be the most
 * consequential wrong sentence on the screen.
 */
export async function getPolicyVersionComparison(
  prisma: PrismaClient,
  filter: { organisationId: string; siteId: string; limit?: number },
): Promise<PolicyVersionComparison> {
  const versions = await prisma.consentPolicyVersion.findMany({
    where: { organisationId: filter.organisationId, siteId: filter.siteId },
    orderBy: { version: "desc" },
    take: Math.min(Math.max(filter.limit ?? 5, 2), 20),
    select: { id: true, version: true, approvedAt: true },
  });

  const rows = await Promise.all(
    versions.map(async (version) => {
      const decisions = await prisma.consentRecord.findMany({
        where: {
          organisationId: filter.organisationId,
          siteId: filter.siteId,
          // Matched on the configuration the visitor was actually served, which
          // is the snapshot on the record - not on when the decision happened.
          // A record written a minute after approval was still served the old
          // banner, and dating it into the new version would attribute somebody
          // else's copy to this one.
          policyConfigVersion: String(version.version),
        },
        orderBy: [{ decidedAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }],
        select: {
          principalId: true,
          purposeId: true,
          status: true,
          variantKey: true,
          purpose: { select: { code: true } },
        },
      });

      const metrics = metricsFor(
        decisions.map((d) => ({
          principalId: d.principalId,
          purposeId: d.purposeId,
          purposeCode: d.purpose.code,
          status: d.status,
          variantKey: d.variantKey,
        })),
        0,
        { key: String(version.version), name: `v${version.version}`, isControl: false, allocation: 0 },
      );

      return {
        policy_version_id: version.id,
        version: version.version,
        approved_at: version.approvedAt?.toISOString() ?? null,
        decisions: decisions.length,
        principals: metrics.deciders,
        acceptance_rate: metrics.acceptance_rate,
        rejection_rate: metrics.rejection_rate,
        partial_rate: metrics.partial_rate,
        withdrawal_rate: metrics.withdrawal_rate,
        // Site-wide intelligence is not versioned, so there is nothing honest to
        // put here yet. Null says "not measured", which a zero would not.
        shadow_trackers: null,
        drift_findings: null,
      };
    }),
  );

  const ascending = [...rows].sort((a, b) => a.version - b.version);
  const changes: PolicyVersionComparison["changes"] = [];

  for (let i = 1; i < ascending.length; i += 1) {
    const before = ascending[i - 1]!;
    const after = ascending[i]!;

    for (const metric of [
      "acceptance_rate",
      "rejection_rate",
      "partial_rate",
      "withdrawal_rate",
    ] as const) {
      const from = before[metric];
      const to = after[metric];
      changes.push({
        from_version: before.version,
        to_version: after.version,
        metric,
        from,
        to,
        // Null where either side has no data, rather than a change from an
        // imagined zero.
        observed_change:
          from === null || to === null ? null : Math.round((to - from) * 10000) / 10000,
      });
    }
  }

  return {
    site_id: filter.siteId,
    versions: rows,
    changes,
    caveats: [...POLICY_COMPARISON_CAVEATS],
    legal_advice: false,
  };
}
