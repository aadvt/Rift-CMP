import type {
  AnalyticsSummary,
  AnalyticsTotals,
  BreakdownEntry,
  PlatformOverview,
} from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";

/**
 * Analytics and operational read models.
 *
 * Everything here is aggregate. No function returns an individual event, a page
 * URL tied to a person, or anything from the consent or transfer payloads —
 * the dashboard needs counts, not records.
 *
 * Every query resolves the caller's own site ids first and filters on that list,
 * so a tenant can only ever aggregate over its own data.
 */

const DEFAULT_WINDOW_DAYS = 30;
const TOP_PAGES_LIMIT = 10;

export interface AnalyticsFilter {
  organisationId: string;
  /** Narrow to one site. Must belong to the organisation; the caller checks. */
  siteId?: string;
  from?: Date;
  to?: Date;
}

/** Resolves the range, defaulting to the last 30 days. */
export function resolveRange(filter: { from?: Date; to?: Date }): { from: Date; to: Date } {
  const to = filter.to ?? new Date();
  const from = filter.from ?? new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** The organisation's site ids, optionally narrowed to one. */
async function resolveSiteIds(
  prisma: PrismaClient,
  filter: AnalyticsFilter,
): Promise<{ ids: string[]; names: Map<string, string> }> {
  const sites = await prisma.website.findMany({
    where: {
      organisationId: filter.organisationId,
      ...(filter.siteId ? { id: filter.siteId } : {}),
    },
    select: { id: true, name: true },
  });

  return {
    ids: sites.map((site) => site.id),
    names: new Map(sites.map((site) => [site.id, site.name])),
  };
}

function toBreakdown(
  rows: Array<{ _count: { _all: number } } & Record<string, unknown>>,
  field: string,
): BreakdownEntry[] {
  return rows
    .map((row) => ({ key: String(row[field] ?? "Unknown"), events: row._count._all }))
    .sort((a, b) => b.events - a.events);
}

/** Zero totals, so an empty tenant renders the same shape as a busy one. */
const EMPTY_TOTALS: AnalyticsTotals = {
  sessions: 0,
  page_views: 0,
  custom_events: 0,
  total_events: 0,
  active_sites: 0,
};

export async function getAnalyticsSummary(
  prisma: PrismaClient,
  filter: AnalyticsFilter,
): Promise<AnalyticsSummary> {
  const { from, to } = resolveRange(filter);
  const { ids, names } = await resolveSiteIds(prisma, filter);

  const range = { from: from.toISOString(), to: to.toISOString() };

  // A tenant with no sites is a normal state, not an error.
  if (ids.length === 0) {
    return {
      range,
      totals: EMPTY_TOTALS,
      top_pages: [],
      devices: [],
      browsers: [],
      operating_systems: [],
      by_site: [],
    };
  }

  const eventWhere = { siteId: { in: ids }, eventTime: { gte: from, lt: to } };

  const [sessions, byType, topPages, devices, browsers, operatingSystems, bySiteEvents, bySiteSessions] =
    await Promise.all([
      prisma.session.count({ where: { siteId: { in: ids }, startedAt: { gte: from, lt: to } } }),
      prisma.event.groupBy({ by: ["eventType"], where: eventWhere, _count: { _all: true } }),
      prisma.event.groupBy({
        by: ["pageUrl", "pageTitle"],
        where: { ...eventWhere, eventType: "page_view" },
        _count: { _all: true },
        orderBy: { _count: { pageUrl: "desc" } },
        take: TOP_PAGES_LIMIT,
      }),
      prisma.event.groupBy({ by: ["deviceType"], where: eventWhere, _count: { _all: true } }),
      prisma.event.groupBy({ by: ["browser"], where: eventWhere, _count: { _all: true } }),
      prisma.event.groupBy({ by: ["os"], where: eventWhere, _count: { _all: true } }),
      prisma.event.groupBy({ by: ["siteId", "eventType"], where: eventWhere, _count: { _all: true } }),
      prisma.session.groupBy({
        by: ["siteId"],
        where: { siteId: { in: ids }, startedAt: { gte: from, lt: to } },
        _count: { _all: true },
      }),
    ]);

  const countOfType = (type: string) =>
    byType.find((row) => row.eventType === type)?._count._all ?? 0;
  const totalEvents = byType.reduce((sum, row) => sum + row._count._all, 0);

  const sessionsBySite = new Map(bySiteSessions.map((row) => [row.siteId, row._count._all]));
  const perSite = new Map<string, { pageViews: number; total: number }>();
  for (const row of bySiteEvents) {
    const entry = perSite.get(row.siteId) ?? { pageViews: 0, total: 0 };
    entry.total += row._count._all;
    if (row.eventType === "page_view") entry.pageViews += row._count._all;
    perSite.set(row.siteId, entry);
  }

  const by_site = ids
    .map((siteId) => ({
      site_id: siteId,
      name: names.get(siteId) ?? siteId,
      sessions: sessionsBySite.get(siteId) ?? 0,
      page_views: perSite.get(siteId)?.pageViews ?? 0,
      total_events: perSite.get(siteId)?.total ?? 0,
    }))
    .sort((a, b) => b.total_events - a.total_events);

  return {
    range,
    totals: {
      sessions,
      page_views: countOfType("page_view"),
      custom_events: countOfType("custom"),
      total_events: totalEvents,
      active_sites: by_site.filter((site) => site.total_events > 0).length,
    },
    top_pages: topPages.map((row) => ({
      url: row.pageUrl,
      title: row.pageTitle,
      views: row._count._all,
    })),
    devices: toBreakdown(devices, "deviceType"),
    browsers: toBreakdown(browsers, "browser"),
    operating_systems: toBreakdown(operatingSystems, "os"),
    by_site,
  };
}

/**
 * Counts across every domain, for the operational overview.
 *
 * Reads the three domains independently and assembles the result here, rather
 * than joining them in SQL — the same reason the audit trail does.
 */
export async function getPlatformOverview(
  prisma: PrismaClient,
  filter: AnalyticsFilter,
): Promise<PlatformOverview> {
  const { from, to } = resolveRange(filter);

  // Two kinds of count live in this response and they scope differently.
  //
  // Sites and principals are *current state*: how many exist right now. A date
  // range does not apply to them - a site does not stop existing because you
  // looked at last week - so they take the site filter only.
  //
  // Consent decisions, authorisations and transfers are *events*: they happened
  // at a time, so they take both the site filter and the range. Before this,
  // every block ignored both filters, and the endpoint accepted `site_id`,
  // `from` and `to` while silently applying them to nothing but activity.
  const currentState = {
    organisationId: filter.organisationId,
    ...(filter.siteId ? { id: filter.siteId } : {}),
  };
  const siteScope = filter.siteId ? { siteId: filter.siteId } : {};
  const occurred = { organisationId: filter.organisationId, ...siteScope };

  const [
    sitesTotal,
    sitesActive,
    consentByStatus,
    principals,
    authorisationsByStatus,
    transfersByStatus,
    activity,
  ] = await Promise.all([
    prisma.website.count({ where: currentState }),
    prisma.website.count({ where: { ...currentState, isActive: true } }),
    prisma.consentRecord.groupBy({
      by: ["status"],
      where: { ...occurred, decidedAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.principal.count({
      where: {
        website: { organisationId: filter.organisationId },
        ...siteScope,
      },
    }),
    prisma.transferAuthorisation.groupBy({
      by: ["status"],
      where: { ...occurred, createdAt: { gte: from, lt: to } },
      _count: { _all: true },
    }),
    prisma.transferRecord.groupBy({
      by: ["status"],
      where: {
        organisationId: filter.organisationId,
        recordedAt: { gte: from, lt: to },
        ...(filter.siteId ? { authorisation: { siteId: filter.siteId } } : {}),
      },
      _count: { _all: true },
    }),
    getAnalyticsSummary(prisma, filter),
  ]);

  const countBy = (
    rows: Array<{ status: string; _count: { _all: number } }>,
    status: string,
  ): number => rows.find((row) => row.status === status)?._count._all ?? 0;

  const sum = (rows: Array<{ _count: { _all: number } }>) =>
    rows.reduce((total, row) => total + row._count._all, 0);

  return {
    sites: { total: sitesTotal, active: sitesActive },
    consent: {
      total_decisions: sum(consentByStatus),
      granted: countBy(consentByStatus, "GRANTED"),
      denied: countBy(consentByStatus, "DENIED"),
      withdrawn: countBy(consentByStatus, "WITHDRAWN"),
      principals,
    },
    authorisations: {
      total: sum(authorisationsByStatus),
      authorised: countBy(authorisationsByStatus, "AUTHORISED"),
      consumed: countBy(authorisationsByStatus, "CONSUMED"),
      expired: countBy(authorisationsByStatus, "EXPIRED"),
    },
    transfers: {
      total: sum(transfersByStatus),
      recorded: countBy(transfersByStatus, "RECORDED"),
      delivered: countBy(transfersByStatus, "DELIVERED"),
      failed: countBy(transfersByStatus, "FAILED"),
    },
    activity: activity.totals,
  };
}
