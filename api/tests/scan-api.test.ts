import { beforeEach, describe, expect, it } from "vitest";
import { prisma, persistScanResult, claimNextScan } from "database";
import { GET as listScansRoute, POST as createScanRoute } from "@/app/api/v1/sites/[siteId]/scans/route";
import { DELETE as cancelScanRoute, GET as scanStatusRoute } from "@/app/api/v1/scans/[scanId]/route";
import { GET as scanResultsRoute } from "@/app/api/v1/scans/[scanId]/results/route";
import {
  createOwnershipTree,
  managementRequest,
  resetDatabase,
  siteParams,
} from "./helpers/fixtures";

beforeEach(resetDatabase);

const scanParams = (scanId: string) => ({ params: Promise.resolve({ scanId }) });

/** A minimal completed-scan result, matching what the crawler produces. */
function sampleResult(overrides: Record<string, unknown> = {}) {
  return {
    crawlerVersion: "1.0.0",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    completedAt: new Date().toISOString(),
    limits: { maxPages: 100, maxDepth: 3 },
    robots: { source: "fetched", crawlDelaySeconds: null, disallowedSkipped: 1 },
    consentUi: { detected: true, signals: [{ kind: "button_text", detail: "accept all" }] },
    pages: [
      {
        url: "https://example.com/",
        finalUrl: null,
        status: 200,
        title: "Home",
        contentType: "text/html",
        depth: 0,
        redirectChain: [],
        rendered: true,
        error: null,
        durationMs: 900,
        startedAt: new Date().toISOString(),
      },
      {
        url: "https://example.com/broken",
        finalUrl: null,
        status: null,
        title: null,
        contentType: null,
        depth: 1,
        redirectChain: [],
        rendered: false,
        error: "timeout",
        durationMs: 30_000,
        startedAt: new Date().toISOString(),
      },
    ],
    cookies: [
      {
        name: "_ga",
        domain: ".example.com",
        path: "/",
        expires: new Date(Date.now() + 86_400_000).toISOString(),
        secure: true,
        httpOnly: false,
        sameSite: "Lax",
        isThirdParty: false,
        firstSeenOn: "https://example.com",
      },
    ],
    scripts: [
      {
        url: "https://www.googletagmanager.com/gtag/js?id=G-X",
        host: "www.googletagmanager.com",
        inline: false,
        isThirdParty: true,
        observedOn: "https://example.com/",
      },
    ],
    requests: [
      {
        url: "https://www.google-analytics.com/collect",
        host: "www.google-analytics.com",
        method: "POST",
        resourceType: "xhr",
        status: 200,
        isThirdParty: true,
        failed: false,
      },
      {
        url: "https://www.google-analytics.com/collect",
        host: "www.google-analytics.com",
        method: "POST",
        resourceType: "xhr",
        status: 200,
        isThirdParty: true,
        failed: false,
      },
    ],
    storage: [
      {
        kind: "local_storage",
        name: "_hjSession",
        origin: "https://example.com",
        observedOn: "https://example.com/",
      },
    ],
    technologies: [
      {
        detectorId: "google-analytics",
        name: "Google Analytics",
        category: "analytics",
        confidence: "high",
        evidence: [{ type: "script", value: "https://www.googletagmanager.com/gtag/js?id=G-X" }],
        destinationCountry: "US",
        crossesBorder: true,
      },
    ],
    summary: {
      pagesDiscovered: 2,
      pagesScanned: 1,
      pagesFailed: 1,
      cookiesFound: 1,
      scriptsFound: 1,
      requestsObserved: 2,
      storageItemsFound: 1,
      thirdPartyDomains: 1,
      technologiesDetected: 1,
      consentUiDetected: true,
      limitReached: null,
    },
    ...overrides,
  };
}

async function queueScan(key: string, siteId: string, startUrl = "https://example.com/") {
  const response = await createScanRoute(
    managementRequest(`/api/v1/sites/${siteId}/scans`, {
      key,
      method: "POST",
      body: { start_url: startUrl },
    }),
    siteParams(siteId),
  );
  return { response, body: await response.json() };
}

describe("creating a scan", () => {
  it("queues a scan for the caller's own site", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();

    const { response, body } = await queueScan(orgA.secretKey, siteA1.siteId);

    // 202, not 201: the scan is queued, not performed.
    expect(response.status).toBe(202);
    expect(body.scan.status).toBe("queued");
    expect(body.scan.site_id).toBe(siteA1.siteId);
    expect(body.scan.mode).toBe("baseline");
    expect(await prisma.scan.count()).toBe(1);
  });

  it("rejects a site public key, because a crawl is not a browser-plane action", async () => {
    const { siteA1 } = await createOwnershipTree();

    const { response } = await queueScan(siteA1.publicKey, siteA1.siteId);

    expect(response.status).toBe(401);
    expect(await prisma.scan.count()).toBe(0);
  });

  it("rejects an unauthenticated request", async () => {
    const { siteA1 } = await createOwnershipTree();
    const response = await createScanRoute(
      managementRequest(`/api/v1/sites/${siteA1.siteId}/scans`, {
        method: "POST",
        body: { start_url: "https://example.com/" },
      }),
      siteParams(siteA1.siteId),
    );
    expect(response.status).toBe(401);
    expect(await prisma.scan.count()).toBe(0);
  });

  it("refuses to scan another organisation's site", async () => {
    const { orgA, siteB1 } = await createOwnershipTree();

    const { response, body } = await queueScan(orgA.secretKey, siteB1.siteId);

    // Indistinguishable from a site that does not exist.
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(await prisma.scan.count()).toBe(0);
  });

  it.each([
    ["http://localhost/", "loopback hostname"],
    ["http://127.0.0.1/", "loopback address"],
    ["http://169.254.169.254/latest/meta-data/", "cloud metadata"],
    ["http://10.0.0.1/", "private range"],
    ["file:///etc/passwd", "unsupported scheme"],
    ["http://metadata.google.internal/", "internal name"],
  ])("refuses %s at the API boundary (%s)", async (url) => {
    const { orgA, siteA1 } = await createOwnershipTree();

    const { response, body } = await queueScan(orgA.secretKey, siteA1.siteId, url);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_request");
    expect(await prisma.scan.count()).toBe(0);
  });

  it("refuses an unimplemented scan mode rather than silently running baseline", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();

    const response = await createScanRoute(
      managementRequest(`/api/v1/sites/${siteA1.siteId}/scans`, {
        key: orgA.secretKey,
        method: "POST",
        body: { start_url: "https://example.com/", mode: "advertising" },
      }),
      siteParams(siteA1.siteId),
    );

    expect(response.status).toBe(400);
    expect(await prisma.scan.count()).toBe(0);
  });

  it("rejects unknown body fields", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const response = await createScanRoute(
      managementRequest(`/api/v1/sites/${siteA1.siteId}/scans`, {
        key: orgA.secretKey,
        method: "POST",
        body: { start_url: "https://example.com/", organisation_id: "someone-else" },
      }),
      siteParams(siteA1.siteId),
    );
    expect(response.status).toBe(400);
  });
});

describe("scan lifecycle", () => {
  it("walks queued to running to completed", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const { body: created } = await queueScan(orgA.secretKey, siteA1.siteId);
    const scanId = created.scan.scan_id;

    const claimed = await claimNextScan(prisma);
    expect(claimed?.id).toBe(scanId);
    expect(claimed?.status).toBe("running");

    await persistScanResult(prisma, scanId, sampleResult());

    const response = await scanStatusRoute(
      managementRequest(`/api/v1/scans/${scanId}`, { key: orgA.secretKey }),
      scanParams(scanId),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.scan.status).toBe("completed");
    expect(body.summary.pages_scanned).toBe(1);
    expect(body.summary.pages_failed).toBe(1);
    expect(body.summary.technologies_detected).toBe(1);
  });

  it("walks queued to running to failed, keeping the reason", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const { body: created } = await queueScan(orgA.secretKey, siteA1.siteId);
    const scanId = created.scan.scan_id;

    await claimNextScan(prisma);
    const { markScanFailed } = await import("database");
    await markScanFailed(prisma, scanId, "browser_launch_failed", "Could not start the browser");

    const response = await scanStatusRoute(
      managementRequest(`/api/v1/scans/${scanId}`, { key: orgA.secretKey }),
      scanParams(scanId),
    );
    const body = await response.json();

    expect(body.scan.status).toBe("failed");
    expect(body.scan.error.code).toBe("browser_launch_failed");
  });

  it("cancels a queued scan", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const { body: created } = await queueScan(orgA.secretKey, siteA1.siteId);
    const scanId = created.scan.scan_id;

    const response = await cancelScanRoute(
      managementRequest(`/api/v1/scans/${scanId}`, { key: orgA.secretKey, method: "DELETE" }),
      scanParams(scanId),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).scan.status).toBe("cancelled");

    // A cancelled scan must not then be picked up by a worker.
    expect(await claimNextScan(prisma)).toBeNull();
  });

  it("refuses to cancel a scan that already finished", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const { body: created } = await queueScan(orgA.secretKey, siteA1.siteId);
    const scanId = created.scan.scan_id;

    await claimNextScan(prisma);
    await persistScanResult(prisma, scanId, sampleResult());

    const response = await cancelScanRoute(
      managementRequest(`/api/v1/scans/${scanId}`, { key: orgA.secretKey, method: "DELETE" }),
      scanParams(scanId),
    );

    expect(response.status).toBe(409);
  });

  it("claims scans one at a time, so two workers cannot take the same row", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    await queueScan(orgA.secretKey, siteA1.siteId, "https://example.com/one");
    await queueScan(orgA.secretKey, siteA1.siteId, "https://example.com/two");

    const first = await claimNextScan(prisma);
    const second = await claimNextScan(prisma);
    const third = await claimNextScan(prisma);

    expect(first?.id).not.toBe(second?.id);
    expect(third).toBeNull();
  });
});

describe("scan results", () => {
  async function completedScan() {
    const tree = await createOwnershipTree();
    const { body } = await queueScan(tree.orgA.secretKey, tree.siteA1.siteId);
    const scanId = body.scan.scan_id;
    await claimNextScan(prisma);
    await persistScanResult(prisma, scanId, sampleResult());
    return { ...tree, scanId };
  }

  it("returns observations with their evidence", async () => {
    const { orgA, scanId } = await completedScan();

    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanId}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pages).toHaveLength(2);
    expect(body.cookies[0].name).toBe("_ga");
    expect(body.technologies[0].name).toBe("Google Analytics");
    expect(body.technologies[0].evidence.length).toBeGreaterThan(0);
    expect(body.consent_ui.detected).toBe(true);
    expect(body.consent_ui.signals[0].detail).toBe("accept all");
  });

  it("records a failed page rather than dropping it", async () => {
    const { orgA, scanId } = await completedScan();
    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanId}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId }) },
    );
    const body = await response.json();

    const failed = body.pages.find((page: { rendered: boolean }) => !page.rendered);
    expect(failed).toBeDefined();
    expect(failed.error).toBe("timeout");
  });

  it("aggregates repeated requests to one host into a single row with a count", async () => {
    const { orgA, scanId } = await completedScan();
    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanId}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId }) },
    );
    const body = await response.json();

    const ga = body.requests.find(
      (request: { host: string }) => request.host === "www.google-analytics.com",
    );
    expect(ga.request_count).toBe(2);
    expect(body.requests).toHaveLength(1);
  });

  it("stores no cookie value, and no such field exists on the wire", async () => {
    const { orgA, scanId } = await completedScan();
    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanId}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId }) },
    );
    const body = await response.json();

    for (const cookie of body.cookies) {
      expect(Object.keys(cookie)).not.toContain("value");
    }
    // And nothing resembling a value reached the database either.
    const row = await prisma.scanCookie.findFirstOrThrow();
    expect(Object.keys(row)).not.toContain("value");
  });

  it("stores storage key names but never values", async () => {
    const { orgA, scanId } = await completedScan();
    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanId}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId }) },
    );
    const body = await response.json();

    expect(body.storage[0].name).toBe("_hjSession");
    expect(Object.keys(body.storage[0])).not.toContain("value");
  });

  it("carries no legal determination anywhere in the payload", async () => {
    const { orgA, scanId } = await completedScan();
    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanId}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId }) },
    );
    const raw = JSON.stringify(await response.json()).toLowerCase();

    // Scanner output is evidence, not a compliance verdict. If any of these
    // appear, the boundary between discovery and the consent engine has moved.
    for (const forbidden of ["consent_required", "requires_consent", "lawful", "gdpr", "legal_basis"]) {
      expect(raw, `results must not assert "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe("scan tenant isolation", () => {
  async function twoTenantScans() {
    const tree = await createOwnershipTree();
    const { body: a } = await queueScan(tree.orgA.secretKey, tree.siteA1.siteId);
    const { body: b } = await queueScan(tree.orgB.secretKey, tree.siteB1.siteId);
    return { ...tree, scanA: a.scan.scan_id, scanB: b.scan.scan_id };
  }

  it("hides another organisation's scan status behind a 404", async () => {
    const { orgA, scanB } = await twoTenantScans();

    const response = await scanStatusRoute(
      managementRequest(`/api/v1/scans/${scanB}`, { key: orgA.secretKey }),
      scanParams(scanB),
    );

    expect(response.status).toBe(404);
  });

  it("hides another organisation's scan results behind a 404", async () => {
    const { orgA, scanB } = await twoTenantScans();

    const response = await scanResultsRoute(
      managementRequest(`/api/v1/scans/${scanB}/results`, { key: orgA.secretKey }),
      { params: Promise.resolve({ scanId: scanB }) },
    );

    expect(response.status).toBe(404);
  });

  it("refuses to cancel another organisation's scan, and leaves it running", async () => {
    const { orgA, scanB } = await twoTenantScans();

    const response = await cancelScanRoute(
      managementRequest(`/api/v1/scans/${scanB}`, { key: orgA.secretKey, method: "DELETE" }),
      scanParams(scanB),
    );

    expect(response.status).toBe(404);
    const untouched = await prisma.scan.findUniqueOrThrow({ where: { id: scanB } });
    expect(untouched.status).toBe("queued");
  });

  it("lists only the caller's own scans", async () => {
    const { orgA, siteA1, scanA } = await twoTenantScans();

    const response = await listScansRoute(
      managementRequest(`/api/v1/sites/${siteA1.siteId}/scans`, { key: orgA.secretKey }),
      siteParams(siteA1.siteId),
    );
    const body = await response.json();

    expect(body.scans).toHaveLength(1);
    expect(body.scans[0].scan_id).toBe(scanA);
  });
});

describe("persistence limits", () => {
  it("caps what one pathological scan can write", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const { body: created } = await queueScan(orgA.secretKey, siteA1.siteId);
    const scanId = created.scan.scan_id;
    await claimNextScan(prisma);

    // A hostile site: 5,000 distinct pages and 5,000 distinct hosts.
    const pages = Array.from({ length: 5000 }, (_, i) => ({
      url: `https://example.com/p/${i}`,
      finalUrl: null,
      status: 200,
      title: null,
      contentType: "text/html",
      depth: 1,
      redirectChain: [],
      rendered: true,
      error: null,
      durationMs: 10,
      startedAt: new Date().toISOString(),
    }));
    const requests = Array.from({ length: 5000 }, (_, i) => ({
      url: `https://h${i}.example.net/x`,
      host: `h${i}.example.net`,
      method: "GET",
      resourceType: "script",
      status: 200,
      isThirdParty: true,
      failed: false,
    }));

    await persistScanResult(prisma, scanId, sampleResult({ pages, requests }));

    // Bounded regardless of what the crawler handed over.
    expect(await prisma.scanPage.count({ where: { scanId } })).toBeLessThanOrEqual(200);
    expect(await prisma.scanRequest.count({ where: { scanId } })).toBeLessThanOrEqual(2000);
  });
});
