import type { Prisma, PrismaClient } from "./generated/client";

/**
 * The enforcement log: what the firewall decided, and nothing else.
 *
 * ## What is deliberately not stored
 *
 * No request bodies, no full URLs, no principal reference, no headers. Each
 * omission is load-bearing rather than an oversight:
 *
 *  - **Bodies** would make this table a copy of every payload the firewall
 *    inspected, including the fields redaction was configured to remove. The
 *    redaction metadata records which rule matched which path; the value it
 *    matched is exactly what must not survive.
 *  - **Full URLs** carry query strings, and query strings carry those same
 *    values. A host is enough to say which vendor was involved.
 *  - **A principal** would rebuild, on the enforcement side, the identity link
 *    that consent analytics deliberately does not have. Knowing that a request
 *    to a vendor was blocked is useful; knowing whose it was is a different
 *    product with different consequences.
 *
 * ## Volume
 *
 * A busy site produces a lot of allowed requests, and writing one row per
 * allowed request would make this the largest table in the schema within a week
 * while telling an operator nothing they wanted. `recordEnforcementEvents`
 * therefore takes a batch and the caller decides what is worth keeping — the
 * client SDK reports blocks and reviews, not every permitted fetch.
 */

export interface EnforcementEventInput {
  organisationId: string;
  siteId: string;
  occurredAt?: Date;
  source: "client" | "server";
  /** Host only. Callers pass a host; a URL here would be a bug. */
  destinationHost: string | null;
  vendor: string | null;
  purpose: string | null;
  decision: string;
  effect: "allow" | "block";
  observedOnly: boolean;
  policyVersion: string | null;
  matchedRule: Prisma.InputJsonValue | null;
  reason: string;
  severity: string;
  /** Rule ids and paths. Never values. */
  redactions: Prisma.InputJsonValue | null;
}

export interface EnforcementEventSummary {
  id: string;
  site_id: string;
  occurred_at: string;
  source: string;
  destination_host: string | null;
  vendor: string | null;
  purpose: string | null;
  decision: string;
  effect: string;
  observed_only: boolean;
  policy_version: string | null;
  matched_rule: unknown;
  reason: string;
  severity: string;
  redactions: unknown;
}

/** Guard against a caller passing a URL where a host belongs. */
function hostOnly(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    // A parseable absolute URL is a caller mistake, not a host. Reducing it here
    // rather than rejecting keeps a logging bug from failing a real request,
    // while making sure the query string never lands in the table.
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed.toLowerCase().split("/")[0] ?? null;
  }
}

export async function recordEnforcementEvents(
  prisma: PrismaClient,
  events: readonly EnforcementEventInput[],
): Promise<number> {
  if (events.length === 0) return 0;

  const result = await prisma.enforcementEvent.createMany({
    data: events.map((event) => ({
      organisationId: event.organisationId,
      siteId: event.siteId,
      ...(event.occurredAt ? { occurredAt: event.occurredAt } : {}),
      source: event.source,
      destinationHost: hostOnly(event.destinationHost),
      vendor: event.vendor,
      purpose: event.purpose,
      decision: event.decision,
      effect: event.effect,
      observedOnly: event.observedOnly,
      policyVersion: event.policyVersion,
      ...(event.matchedRule === null ? {} : { matchedRule: event.matchedRule }),
      reason: event.reason,
      severity: event.severity,
      ...(event.redactions === null ? {} : { redactions: event.redactions }),
    })),
  });

  return result.count;
}

function toSummary(row: {
  id: string;
  siteId: string;
  occurredAt: Date;
  source: string;
  destinationHost: string | null;
  vendor: string | null;
  purpose: string | null;
  decision: string;
  effect: string;
  observedOnly: boolean;
  policyVersion: string | null;
  matchedRule: unknown;
  reason: string;
  severity: string;
  redactions: unknown;
}): EnforcementEventSummary {
  return {
    id: row.id,
    site_id: row.siteId,
    occurred_at: row.occurredAt.toISOString(),
    source: row.source,
    destination_host: row.destinationHost,
    vendor: row.vendor,
    purpose: row.purpose,
    decision: row.decision,
    effect: row.effect,
    observed_only: row.observedOnly,
    policy_version: row.policyVersion,
    matched_rule: row.matchedRule ?? null,
    reason: row.reason,
    severity: row.severity,
    redactions: row.redactions ?? null,
  };
}

/**
 * Recent enforcement events for one tenant.
 *
 * Always scoped by `organisationId`. The optional site filter narrows within
 * that scope and can never widen beyond it — the same shape every other query
 * in this package uses, because a filter that could widen is a tenant leak one
 * typo away.
 */
export async function listEnforcementEvents(
  prisma: PrismaClient,
  filter: {
    organisationId: string;
    siteId?: string;
    decision?: string;
    since?: Date;
    limit?: number;
  },
): Promise<EnforcementEventSummary[]> {
  const rows = await prisma.enforcementEvent.findMany({
    where: {
      organisationId: filter.organisationId,
      ...(filter.siteId ? { siteId: filter.siteId } : {}),
      ...(filter.decision ? { decision: filter.decision } : {}),
      ...(filter.since ? { occurredAt: { gte: filter.since } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
  });

  return rows.map(toSummary);
}

export interface EnforcementSummary {
  /** Counts by classification, over the window asked for. */
  by_decision: Record<string, number>;
  /** How many were recorded rather than applied, because the mode was observe. */
  observed_only: number;
  blocked: number;
  redacted: number;
  needs_review: number;
  total: number;
  /** Distinct destinations, which is the number an operator actually reads. */
  destinations: number;
}

/** Counts for the dashboard. One grouped query rather than five. */
export async function summariseEnforcement(
  prisma: PrismaClient,
  filter: { organisationId: string; siteId?: string; since?: Date },
): Promise<EnforcementSummary> {
  const where = {
    organisationId: filter.organisationId,
    ...(filter.siteId ? { siteId: filter.siteId } : {}),
    ...(filter.since ? { occurredAt: { gte: filter.since } } : {}),
  };

  const [grouped, observed, hosts] = await Promise.all([
    prisma.enforcementEvent.groupBy({ by: ["decision"], where, _count: { _all: true } }),
    prisma.enforcementEvent.count({ where: { ...where, observedOnly: true } }),
    prisma.enforcementEvent.findMany({
      where,
      select: { destinationHost: true },
      distinct: ["destinationHost"],
    }),
  ]);

  const byDecision: Record<string, number> = {};
  let total = 0;
  for (const row of grouped) {
    byDecision[row.decision] = row._count._all;
    total += row._count._all;
  }

  return {
    by_decision: byDecision,
    observed_only: observed,
    blocked: (byDecision.BLOCK ?? 0) + (byDecision.REQUIRE_CONSENT ?? 0),
    redacted: byDecision.REDACT ?? 0,
    needs_review: byDecision.REVIEW ?? 0,
    total,
    destinations: hosts.filter((h) => h.destinationHost !== null).length,
  };
}
