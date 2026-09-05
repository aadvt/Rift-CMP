import type {
  ExperimentRuntimeConfig,
  ExperimentStatus,
  ExperimentSummary,
  ExperimentText,
  ExperimentVariantInput,
  ExperimentVariantSummary,
} from "@rift-cmp/shared/experiment";
import { isServing } from "@rift-cmp/shared/experiment";
import type { Prisma, PrismaClient } from "./generated/client";

/**
 * Experiment storage.
 *
 * Every query is scoped by `organisationId`, and the site filter narrows within
 * that scope rather than replacing it — a filter that could widen is a tenant
 * leak one typo away, and this table describes what a competitor's banner says.
 *
 * ## Retention
 *
 * `experiment_events` holds impressions and carries no principal, no session and
 * no address: a row says "an arm was shown", not who saw it. It is therefore not
 * personal data and inherits no deletion obligation, which is deliberate —
 * counting how many people saw a banner does not require knowing which people.
 *
 * Rows are removed with the site (`onDelete: Cascade`) and with the experiment.
 * There is no independent expiry, and the volume is bounded by page views on
 * sites with a running experiment rather than by all traffic.
 */

type VariantRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  allocation: number;
  text: Prisma.JsonValue | null;
  isControl: boolean;
};

type ExperimentRow = {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  policyVersionId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  variants: VariantRow[];
};

function toVariantSummary(row: VariantRow): ExperimentVariantSummary {
  return {
    variant_id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    allocation: row.allocation,
    text: (row.text as ExperimentText | null) ?? null,
    is_control: row.isControl,
  };
}

export function toExperimentSummary(row: ExperimentRow, now = new Date()): ExperimentSummary {
  const status = row.status as ExperimentStatus;
  return {
    experiment_id: row.id,
    site_id: row.siteId,
    name: row.name,
    description: row.description,
    status,
    starts_at: row.startsAt?.toISOString() ?? null,
    ends_at: row.endsAt?.toISOString() ?? null,
    policy_version_id: row.policyVersionId,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    // Sorted by key so the dashboard's row order is stable between reads, for
    // the same reason the banner's purposes are.
    variants: [...row.variants]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map(toVariantSummary),
    serving: isServing(status, { startsAt: row.startsAt, endsAt: row.endsAt }, now),
  };
}

const INCLUDE = { variants: true } as const;

export async function createExperiment(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    name: string;
    description?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    policyVersionId?: string | null;
    createdBy?: string | null;
    variants: readonly ExperimentVariantInput[];
  },
): Promise<ExperimentSummary> {
  const row = await prisma.experiment.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId,
      name: input.name,
      description: input.description ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      policyVersionId: input.policyVersionId ?? null,
      createdBy: input.createdBy ?? null,
      variants: {
        create: input.variants.map((variant) => ({
          organisationId: input.organisationId,
          key: variant.key,
          name: variant.name,
          description: variant.description ?? null,
          allocation: variant.allocation,
          isControl: variant.isControl === true,
          ...(variant.text ? { text: variant.text as Prisma.InputJsonValue } : {}),
        })),
      },
    },
    include: INCLUDE,
  });

  return toExperimentSummary(row);
}

export async function listExperiments(
  prisma: PrismaClient,
  filter: { organisationId: string; siteId?: string; status?: ExperimentStatus; limit?: number },
): Promise<ExperimentSummary[]> {
  const rows = await prisma.experiment.findMany({
    where: {
      organisationId: filter.organisationId,
      ...(filter.siteId ? { siteId: filter.siteId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(filter.limit ?? 50, 1), 200),
  });

  return rows.map((row) => toExperimentSummary(row));
}

/**
 * One experiment, scoped to a tenant.
 *
 * Returns null for an experiment in another organisation, which is the same
 * answer as for one that does not exist — a distinguishable "exists but
 * forbidden" would let somebody enumerate ids.
 */
export async function getExperiment(
  prisma: PrismaClient,
  organisationId: string,
  experimentId: string,
): Promise<ExperimentSummary | null> {
  const row = await prisma.experiment.findFirst({
    where: { id: experimentId, organisationId },
    include: INCLUDE,
  });
  return row ? toExperimentSummary(row) : null;
}

/**
 * Replace an experiment's definition.
 *
 * Variants are deleted and recreated rather than merged. A merge would have to
 * decide what an edited allocation means for visitors already assigned under the
 * old one, and the honest answer is that it reassigns some of them — so editing
 * is confined to states where nobody has been assigned yet, and the caller
 * enforces that.
 */
export async function updateExperiment(
  prisma: PrismaClient,
  organisationId: string,
  experimentId: string,
  input: {
    name?: string;
    description?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    policyVersionId?: string | null;
    variants?: readonly ExperimentVariantInput[];
  },
): Promise<ExperimentSummary | null> {
  const existing = await prisma.experiment.findFirst({
    where: { id: experimentId, organisationId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    if (input.variants) {
      await tx.experimentVariant.deleteMany({ where: { experimentId } });
    }

    return tx.experiment.update({
      where: { id: experimentId },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.startsAt === undefined ? {} : { startsAt: input.startsAt }),
        ...(input.endsAt === undefined ? {} : { endsAt: input.endsAt }),
        ...(input.policyVersionId === undefined
          ? {}
          : { policyVersionId: input.policyVersionId }),
        ...(input.variants
          ? {
              variants: {
                create: input.variants.map((variant) => ({
                  organisationId,
                  key: variant.key,
                  name: variant.name,
                  description: variant.description ?? null,
                  allocation: variant.allocation,
                  isControl: variant.isControl === true,
                  ...(variant.text ? { text: variant.text as Prisma.InputJsonValue } : {}),
                })),
              },
            }
          : {}),
      },
      include: INCLUDE,
    });
  });

  return toExperimentSummary(row);
}

export async function setExperimentStatus(
  prisma: PrismaClient,
  organisationId: string,
  experimentId: string,
  status: ExperimentStatus,
): Promise<ExperimentSummary | null> {
  const existing = await prisma.experiment.findFirst({
    where: { id: experimentId, organisationId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.experiment.update({
    where: { id: experimentId },
    data: { status },
    include: INCLUDE,
  });
  return toExperimentSummary(row);
}

/**
 * The experiment a browser should run on this site, if any.
 *
 * At most one serving experiment per site. Two overlapping experiments on the
 * same banner would interact — a visitor in arm B of one and arm A of the other
 * sees a combination neither was designed to test — and untangling that after
 * the fact is not possible from the data.
 *
 * Carries copy and allocation only. No status, no dates, no policy id: a browser
 * needs to render an arm, not to reason about an experiment.
 */
export async function getServingExperiment(
  prisma: PrismaClient,
  siteId: string,
  now = new Date(),
): Promise<ExperimentRuntimeConfig | null> {
  const rows = await prisma.experiment.findMany({
    where: {
      siteId,
      status: "RUNNING",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    include: INCLUDE,
    orderBy: { createdAt: "asc" },
    take: 1,
  });

  const row = rows[0];
  if (!row || row.variants.length === 0) return null;

  return {
    experiment_id: row.id,
    variants: [...row.variants]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((variant) => ({
        key: variant.key,
        allocation: variant.allocation,
        text: (variant.text as ExperimentText | null) ?? null,
      })),
  };
}

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * Record impressions.
 *
 * Only what a consent decision cannot already record. An acceptance is a row in
 * `consent_records`, attributed there by column; this exists so an acceptance
 * rate has a denominator — without impressions, "62% accepted" is a percentage
 * of the people who chose something, which is not the number anybody means.
 */
export async function recordExperimentEvents(
  prisma: PrismaClient,
  events: ReadonlyArray<{
    organisationId: string;
    siteId: string;
    experimentId: string;
    variantId: string;
    kind: string;
    occurredAt?: Date;
  }>,
): Promise<number> {
  if (events.length === 0) return 0;
  const result = await prisma.experimentEvent.createMany({ data: events.map((e) => ({ ...e })) });
  return result.count;
}

/** Resolve a variant key to its row id, within one experiment. */
export async function findVariant(
  prisma: PrismaClient,
  experimentId: string,
  key: string,
): Promise<{ id: string; organisationId: string } | null> {
  return prisma.experimentVariant.findFirst({
    where: { experimentId, key },
    select: { id: true, organisationId: true },
  });
}
