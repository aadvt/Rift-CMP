import { Prisma, type PrismaClient } from "./index";

/**
 * Scan persistence.
 *
 * Everything written here is an **observation**, never a legal determination.
 * There is no "requires consent" column to set and no place to put one, which
 * is the architecture rather than an omission: the compliance layer reads these
 * rows and decides. See `docs/crawler.md`.
 *
 * Two invariants this module is responsible for:
 *
 *  - **Tenant scoping is in the WHERE clause, never in application logic.**
 *    Every read takes an `organisationId` and filters on it in SQL, matching
 *    how `findOwnedWebsite` and the consent domain already work.
 *  - **A scan's writes are bounded.** The crawler caps what it collects, and
 *    `persistScanResult` caps again on the way in, so a crawler bug cannot turn
 *    into unbounded rows.
 */

/** Hard ceilings applied at persistence, independent of the crawler's own. */
const PERSIST_CAPS = {
  pages: 200,
  cookies: 500,
  scripts: 1_000,
  requests: 2_000,
  storage: 500,
  technologies: 300,
} as const;

export type ScanStatusValue = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface CreateScanInput {
  organisationId: string;
  siteId: string;
  startUrl: string;
  mode?: string;
  config?: Record<string, unknown>;
}

/**
 * Queues a scan.
 *
 * The caller must already have proved the site belongs to the organisation;
 * `organisationId` is stored denormalised so every later read filters on one
 * indexed column rather than joining through `websites`.
 */
export async function createScan(prisma: PrismaClient, input: CreateScanInput) {
  return prisma.scan.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId,
      startUrl: input.startUrl,
      mode: input.mode ?? "baseline",
      status: "queued",
      config: (input.config ?? {}) as Prisma.InputJsonValue,
    },
  });
}

/**
 * Claims the oldest queued scan for a worker.
 *
 * `updateMany` with `status: "queued"` in the WHERE clause is the whole
 * concurrency control: two workers racing for the same row means one of them
 * updates zero rows and moves on. That is enough for the single-process worker
 * this phase ships, and it does not become wrong when a real queue is
 * introduced later — it just stops being the only thing preventing double work.
 */
export async function claimNextScan(prisma: PrismaClient) {
  const candidate = await prisma.scan.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return null;

  const claimed = await prisma.scan.updateMany({
    where: { id: candidate.id, status: "queued" },
    data: { status: "running", startedAt: new Date() },
  });
  if (claimed.count === 0) return null; // another worker took it

  return prisma.scan.findUnique({ where: { id: candidate.id } });
}

export async function markScanFailed(
  prisma: PrismaClient,
  scanId: string,
  code: string,
  message: string,
) {
  return prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "failed",
      errorCode: code,
      // Truncated, and never a stack trace: an error string from a hostile site
      // is untrusted input that an operator will read in a dashboard.
      errorMessage: message.slice(0, 500),
      completedAt: new Date(),
    },
  });
}

/**
 * Cancels a scan that has not finished.
 *
 * Scoped by organisation in the WHERE clause, so this cannot cancel another
 * tenant's scan even if given its id.
 */
export async function cancelScan(prisma: PrismaClient, organisationId: string, scanId: string) {
  const result = await prisma.scan.updateMany({
    where: { id: scanId, organisationId, status: { in: ["queued", "running"] } },
    data: { status: "cancelled", completedAt: new Date() },
  });
  return result.count > 0;
}

/** Shape the crawler produces. Structural, so `database` need not import it. */
export interface PersistableScanResult {
  crawlerVersion: string;
  startedAt: string;
  completedAt: string;
  /** Opaque to this layer; stored verbatim as the config JSON. */
  limits: unknown;
  robots: { source: string; crawlDelaySeconds: number | null; disallowedSkipped: number };
  consentUi: { detected: boolean; signals: Array<{ kind: string; detail: string }> };
  pages: Array<{
    url: string;
    finalUrl: string | null;
    status: number | null;
    title: string | null;
    contentType: string | null;
    depth: number;
    redirectChain: string[];
    rendered: boolean;
    error: string | null;
    durationMs: number;
    startedAt: string;
  }>;
  cookies: Array<{
    name: string;
    domain: string;
    path: string;
    expires: string | null;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string | null;
    isThirdParty: boolean;
    firstSeenOn: string;
  }>;
  scripts: Array<{
    url: string | null;
    host: string | null;
    inline: boolean;
    isThirdParty: boolean;
    observedOn: string;
  }>;
  requests: Array<{
    url: string;
    host: string;
    method: string;
    resourceType: string;
    status: number | null;
    isThirdParty: boolean;
    failed: boolean;
  }>;
  storage: Array<{ kind: string; name: string; origin: string; observedOn: string }>;
  technologies: Array<{
    detectorId: string;
    name: string;
    category: string;
    confidence: string;
    evidence: Array<{ type: string; value: string }>;
    destinationCountry: string | null;
    crossesBorder: boolean;
  }>;
  summary: {
    pagesDiscovered: number;
    pagesScanned: number;
    pagesFailed: number;
    cookiesFound: number;
    scriptsFound: number;
    requestsObserved: number;
    storageItemsFound: number;
    thirdPartyDomains: number;
    technologiesDetected: number;
    consentUiDetected: boolean;
    limitReached: string | null;
  };
}

/** Aggregates raw requests into one row per (host, resourceType, method). */
function aggregateRequests(requests: PersistableScanResult["requests"]) {
  const byKey = new Map<
    string,
    {
      host: string;
      resourceType: string;
      method: string;
      samplePath: string | null;
      isThirdParty: boolean;
      requestCount: number;
      failedCount: number;
      status: number | null;
    }
  >();

  for (const request of requests) {
    const key = `${request.host}|${request.resourceType}|${request.method}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.requestCount += 1;
      if (request.failed) existing.failedCount += 1;
      if (existing.status === null) existing.status = request.status;
      continue;
    }
    byKey.set(key, {
      host: request.host,
      resourceType: request.resourceType,
      method: request.method,
      // Already stripped of query and fragment by the crawler.
      samplePath: request.url.slice(0, 500),
      isThirdParty: request.isThirdParty,
      requestCount: 1,
      failedCount: request.failed ? 1 : 0,
      status: request.status,
    });
  }

  return [...byKey.values()];
}

/**
 * Writes a completed scan's observations and marks it complete.
 *
 * One transaction: a scan that is `completed` but missing half its child rows
 * would be read by the onboarding UI as a site with no trackers, which is the
 * most dangerous wrong answer this system can give.
 */
export async function persistScanResult(
  prisma: PrismaClient,
  scanId: string,
  result: PersistableScanResult,
) {
  const uniquePages = dedupe(result.pages, (page) => page.url).slice(0, PERSIST_CAPS.pages);
  const uniqueCookies = dedupe(
    result.cookies,
    (cookie) => `${cookie.name}|${cookie.domain}|${cookie.path}`,
  ).slice(0, PERSIST_CAPS.cookies);
  const uniqueScripts = dedupe(
    result.scripts.filter((script) => !script.inline),
    (script) => `${script.url}`,
  ).slice(0, PERSIST_CAPS.scripts);
  const inlineScripts = result.scripts.filter((script) => script.inline).slice(0, 1);
  const uniqueStorage = dedupe(
    result.storage,
    (item) => `${item.kind}|${item.name}|${item.origin}`,
  ).slice(0, PERSIST_CAPS.storage);
  const aggregated = aggregateRequests(result.requests).slice(0, PERSIST_CAPS.requests);
  const technologies = dedupe(result.technologies, (t) => t.detectorId).slice(
    0,
    PERSIST_CAPS.technologies,
  );

  await prisma.$transaction([
    prisma.scanPage.createMany({
      data: uniquePages.map((page) => ({
        scanId,
        url: page.url.slice(0, 2048),
        finalUrl: page.finalUrl?.slice(0, 2048) ?? null,
        status: page.status,
        title: page.title?.slice(0, 500) ?? null,
        contentType: page.contentType?.slice(0, 200) ?? null,
        depth: page.depth,
        redirectChain: page.redirectChain.slice(0, 10) as Prisma.InputJsonValue,
        rendered: page.rendered,
        error: page.error?.slice(0, 300) ?? null,
        durationMs: page.durationMs,
        startedAt: new Date(page.startedAt),
      })),
      skipDuplicates: true,
    }),

    prisma.scanCookie.createMany({
      data: uniqueCookies.map((cookie) => ({
        scanId,
        name: cookie.name.slice(0, 200),
        domain: cookie.domain.slice(0, 255),
        path: cookie.path.slice(0, 500),
        expires: cookie.expires ? new Date(cookie.expires) : null,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        isThirdParty: cookie.isThirdParty,
        firstSeenOn: cookie.firstSeenOn.slice(0, 2048),
      })),
      skipDuplicates: true,
    }),

    prisma.scanScript.createMany({
      data: [...uniqueScripts, ...inlineScripts].map((script) => ({
        scanId,
        url: script.url?.slice(0, 2048) ?? null,
        host: script.host?.slice(0, 255) ?? null,
        inline: script.inline,
        isThirdParty: script.isThirdParty,
        observedOn: script.observedOn.slice(0, 2048),
      })),
      skipDuplicates: true,
    }),

    prisma.scanRequest.createMany({
      data: aggregated.map((request) => ({
        scanId,
        host: request.host.slice(0, 255),
        resourceType: request.resourceType.slice(0, 50),
        method: request.method.slice(0, 10),
        samplePath: request.samplePath,
        isThirdParty: request.isThirdParty,
        requestCount: request.requestCount,
        failedCount: request.failedCount,
        status: request.status,
      })),
      skipDuplicates: true,
    }),

    prisma.scanStorage.createMany({
      data: uniqueStorage.map((item) => ({
        scanId,
        kind: item.kind.slice(0, 40),
        name: item.name.slice(0, 300),
        origin: item.origin.slice(0, 500),
        observedOn: item.observedOn.slice(0, 2048),
      })),
      skipDuplicates: true,
    }),

    prisma.scanTechnology.createMany({
      data: technologies.map((technology) => ({
        scanId,
        detectorId: technology.detectorId.slice(0, 120),
        name: technology.name.slice(0, 200),
        category: technology.category.slice(0, 80),
        confidence: technology.confidence,
        evidence: technology.evidence.slice(0, 10) as unknown as Prisma.InputJsonValue,
        destinationCountry: technology.destinationCountry,
        crossesBorder: technology.crossesBorder,
      })),
      skipDuplicates: true,
    }),

    prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "completed",
        crawlerVersion: result.crawlerVersion,
        config: (result.limits ?? {}) as Prisma.InputJsonValue,
        startedAt: new Date(result.startedAt),
        completedAt: new Date(result.completedAt),
        robotsSource: result.robots.source,
        limitReached: result.summary.limitReached,
        consentUiDetected: result.consentUi.detected,
        consentUiSignals: result.consentUi.signals.slice(0, 10) as unknown as Prisma.InputJsonValue,
        pagesDiscovered: result.summary.pagesDiscovered,
        pagesScanned: result.summary.pagesScanned,
        pagesFailed: result.summary.pagesFailed,
        cookiesFound: result.summary.cookiesFound,
        scriptsFound: result.summary.scriptsFound,
        requestsObserved: result.summary.requestsObserved,
        storageItemsFound: result.summary.storageItemsFound,
        thirdPartyDomains: result.summary.thirdPartyDomains,
        technologiesDetected: result.summary.technologiesDetected,
      },
    }),
  ]);
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Scan header only, tenant-scoped. Null when it is not this org's scan. */
export async function getScan(prisma: PrismaClient, organisationId: string, scanId: string) {
  return prisma.scan.findFirst({ where: { id: scanId, organisationId } });
}

/** Full result, tenant-scoped. */
export async function getScanWithObservations(
  prisma: PrismaClient,
  organisationId: string,
  scanId: string,
) {
  return prisma.scan.findFirst({
    where: { id: scanId, organisationId },
    include: {
      pages: { orderBy: { depth: "asc" }, take: 200 },
      cookies: { orderBy: { name: "asc" }, take: 500 },
      scripts: { take: 500 },
      requests: { orderBy: { requestCount: "desc" }, take: 500 },
      storage: { take: 500 },
      technologies: { orderBy: { category: "asc" }, take: 300 },
    },
  });
}

export async function listScans(
  prisma: PrismaClient,
  organisationId: string,
  options: { siteId?: string; limit?: number } = {},
) {
  return prisma.scan.findMany({
    where: { organisationId, ...(options.siteId ? { siteId: options.siteId } : {}) },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
}
