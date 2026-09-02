import type {
  ClassifiedComponent,
  ComponentKind,
  DiscoveredStorageItem,
  DiscoveredViolation,
  DiscoveryInventory,
  DiscoveryReport,
  DiscoveryReportResponse,
  StorageKind,
} from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";
import { classifyHost } from "./tracker-catalogue";

/**
 * Persistence and read models for the discovery domain.
 *
 * Writes are upserts keyed on `(site, host, kind)` so a site with steady traffic
 * converges on one row per destination instead of one row per page view. That
 * makes the SDK free to re-report the same picture on every flush — which is
 * what lets it forget nothing without the table growing without bound.
 *
 * Reads are site-scoped and always resolved from the caller's own site list, in
 * the same shape as `analytics.ts`, so a tenant can only ever see its own
 * inventory.
 */

const MAX_COMPONENTS_PER_REPORT = 200;
const MAX_STORAGE_PER_REPORT = 200;
const MAX_VIOLATIONS_PER_REPORT = 100;

export interface RecordDiscoveryInput {
  siteId: string;
  report: DiscoveryReport;
}

/**
 * Persists one report.
 *
 * Classification happens here rather than in the browser: the catalogue is
 * server-side data, and re-classifying on every write means an existing row
 * picks up a newly-added vendor the next time the site is visited, with no
 * backfill.
 */
export async function recordDiscoveryReport(
  prisma: PrismaClient,
  { siteId, report }: RecordDiscoveryInput,
): Promise<DiscoveryReportResponse> {
  const now = new Date();
  const destinations = report.destinations.slice(0, MAX_COMPONENTS_PER_REPORT);
  const storage = report.storage.slice(0, MAX_STORAGE_PER_REPORT);
  const violations = report.violations.slice(0, MAX_VIOLATIONS_PER_REPORT);

  const componentWrites = destinations.map((destination) => {
    const classification = classifyHost(destination.host);
    const firstSeen = safeDate(destination.first_seen, now);

    return prisma.discoveredComponent.upsert({
      where: {
        siteId_host_kind: { siteId, host: destination.host, kind: destination.kind },
      },
      // A repeat sighting accumulates the count and refreshes classification,
      // but never moves `first_seen` — that is the point of first_seen.
      update: {
        requestCount: { increment: Math.max(1, destination.request_count) },
        lastSeen: now,
        initiator: destination.initiator ?? undefined,
        samplePath: destination.sample_path ?? undefined,
        pageUrl: report.page_url,
        vendor: classification.vendor,
        category: classification.category,
        destinationCountry: classification.destination_country,
        crossesBorder: classification.crosses_border,
      },
      create: {
        siteId,
        host: destination.host,
        kind: destination.kind,
        initiator: destination.initiator,
        samplePath: destination.sample_path,
        pageUrl: report.page_url,
        isThirdParty: destination.third_party,
        requestCount: Math.max(1, destination.request_count),
        vendor: classification.vendor,
        category: classification.category,
        destinationCountry: classification.destination_country,
        crossesBorder: classification.crosses_border,
        firstSeen,
        lastSeen: now,
      },
    });
  });

  const storageWrites = storage.map((item) =>
    prisma.discoveredStorage.upsert({
      where: { siteId_kind_name: { siteId, kind: item.kind, name: item.name } },
      update: { lastSeen: now, writer: item.writer ?? undefined },
      create: {
        siteId,
        kind: item.kind,
        name: item.name,
        writer: item.writer,
        firstSeen: safeDate(item.first_seen, now),
        lastSeen: now,
      },
    }),
  );

  // Violations are appended, never upserted: each one is a distinct observation
  // at a distinct moment, and collapsing them would destroy the evidence.
  const violationWrites = violations.map((violation) =>
    prisma.discoveryViolation.create({
      data: {
        siteId,
        host: violation.host,
        purposeCode: violation.purpose_code,
        consentStatus: violation.consent_status,
        pageUrl: report.page_url,
        observedAt: safeDate(violation.observed_at, now),
      },
    }),
  );

  await prisma.$transaction([...componentWrites, ...storageWrites, ...violationWrites]);

  return {
    destinations_recorded: destinations.length,
    storage_recorded: storage.length,
    violations_recorded: violations.length,
  };
}

function safeDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  // A client clock running fast must not stamp rows into the future.
  return parsed > fallback ? fallback : parsed;
}

export interface DiscoveryInventoryFilter {
  organisationId: string;
  siteId: string;
  /** Only report violations at least this recent. Defaults to all. */
  since?: Date;
}

/**
 * The operator-facing inventory for one site.
 *
 * The site is re-resolved against the organisation here rather than trusted
 * from the caller, so a valid secret key for tenant A cannot read tenant B's
 * inventory by passing B's site id.
 */
export async function getDiscoveryInventory(
  prisma: PrismaClient,
  { organisationId, siteId, since }: DiscoveryInventoryFilter,
): Promise<DiscoveryInventory | null> {
  const site = await prisma.website.findFirst({
    where: { id: siteId, organisationId },
    select: { id: true },
  });
  if (!site) return null;

  const [components, storage, violations] = await Promise.all([
    prisma.discoveredComponent.findMany({
      where: { siteId },
      orderBy: [{ isThirdParty: "desc" }, { requestCount: "desc" }, { host: "asc" }],
    }),
    prisma.discoveredStorage.findMany({
      where: { siteId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.discoveryViolation.findMany({
      where: { siteId, ...(since ? { observedAt: { gte: since } } : {}) },
      orderBy: { observedAt: "desc" },
      take: 200,
    }),
  ]);

  const mappedComponents: ClassifiedComponent[] = components.map((component) => ({
    host: component.host,
    kind: component.kind as ComponentKind,
    initiator: component.initiator,
    sample_path: component.samplePath,
    third_party: component.isThirdParty,
    request_count: component.requestCount,
    first_seen: component.firstSeen.toISOString(),
    last_seen: component.lastSeen.toISOString(),
    page_url: component.pageUrl,
    vendor: component.vendor,
    category: component.category,
    destination_country: component.destinationCountry,
    crosses_border: component.crossesBorder,
  }));

  const mappedStorage: DiscoveredStorageItem[] = storage.map((item) => ({
    kind: item.kind as StorageKind,
    name: item.name,
    writer: item.writer,
    first_seen: item.firstSeen.toISOString(),
  }));

  const mappedViolations: DiscoveredViolation[] = violations.map((violation) => ({
    host: violation.host,
    purpose_code: violation.purposeCode,
    consent_status: violation.consentStatus,
    observed_at: violation.observedAt.toISOString(),
  }));

  return {
    site_id: siteId,
    generated_at: new Date().toISOString(),
    totals: {
      destinations: mappedComponents.length,
      third_party: mappedComponents.filter((c) => c.third_party).length,
      // Unclassified third parties are the operator's real work queue: a known
      // vendor can be reasoned about, an unknown one cannot.
      unclassified: mappedComponents.filter((c) => c.third_party && !c.vendor).length,
      cross_border: mappedComponents.filter((c) => c.crosses_border).length,
      storage_items: mappedStorage.length,
      open_violations: mappedViolations.length,
    },
    components: mappedComponents,
    storage: mappedStorage,
    violations: mappedViolations,
  };
}
