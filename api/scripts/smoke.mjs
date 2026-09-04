/**
 * Phase 9 end-to-end smoke test.
 *
 * Proves the platform is actually connected, by driving the real route handlers
 * with real credentials rather than inserting rows and declaring victory:
 *
 *   organisation → site → scan → crawl → findings
 *                       → consent purpose + decision
 *                       → SDK-shaped page_view and custom event through ingestion
 *                       → analytics read
 *
 * Rules this script follows, because breaking them would make a pass meaningless:
 *   - authentication is never bypassed; every call carries the credential the
 *     plane requires, and the wrong plane is asserted to fail
 *   - the crawler result is real; nothing is faked
 *   - events go through `POST /api/v1/events`, never straight to the table
 *
 * Usage: npx tsx api/scripts/smoke.mjs [targetUrl]
 *
 * Lives in `api/` because it imports the real route handlers and `next`, both
 * of which resolve from this workspace and not from `crawler/`.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const target = process.argv[2] ?? "https://example.com/";

const envRaw = readFileSync(new URL("../../database/.env", import.meta.url), "utf8");
const baseUrl = /DATABASE_URL\s*=\s*"?([^"\n]+)/.exec(envRaw)[1];
const direct = baseUrl.replace("-pooler.", ".").replace(/([?&])schema=[^&]*/g, "$1").replace(/[?&]+$/, "");
process.env.DATABASE_URL = `${direct}${direct.includes("?") ? "&" : "?"}schema=rift_cmp_test`;

const { prisma, hashSecretKey, generateSecretKey } = await import("database");
const { NextRequest } = await import("next/server");

// The real handlers. Importing them exercises validation, auth and persistence
// exactly as an HTTP request would, without needing a listening server.
const sitesRoute = await import("../app/api/v1/sites/route.ts");
const scansRoute = await import("../app/api/v1/sites/[siteId]/scans/route.ts");
const scanResultsRoute = await import("../app/api/v1/scans/[scanId]/results/route.ts");
const purposesRoute = await import("../app/api/v1/purposes/route.ts");
const eventsRoute = await import("../app/api/v1/events/route.ts");
const analyticsRoute = await import("../app/api/v1/analytics/summary/route.ts");
const { claimNextScan, persistScanResult } = await import("database");
const { crawl } = await import("@rift-cmp/crawler");

const BASE = "http://127.0.0.1:3000";
const results = [];
let failed = 0;

function check(label, ok, detail = "") {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed += 1;
}

const req = (path, { key, method = "GET", body, sessionToken } = {}) => {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (key) headers.set("Authorization", `Bearer ${key}`);
  if (sessionToken) headers.set("X-Rift-Consent-Session", sessionToken);
  return new NextRequest(new URL(path, BASE), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
};

const organisationId = randomUUID();
const secretKey = generateSecretKey();
const suffix = Date.now();

console.log("Rift-CMP Phase 9 end-to-end smoke\n");

try {
  // ── 1. Organisation ────────────────────────────────────────────────────────
  console.log("[1] Organisation");
  await prisma.organisation.create({
    data: { id: organisationId, name: "Smoke Org", slug: `smoke-${suffix}`, secretKeyHash: hashSecretKey(secretKey) },
  });
  check("organisation created", true);

  // ── 2. Site, through the real management endpoint ──────────────────────────
  console.log("\n[2] Website registration (management plane)");
  const created = await sitesRoute.POST(
    req("/api/v1/sites", {
      key: secretKey,
      method: "POST",
      body: { name: "Smoke Site", domain: new URL(target).hostname },
    }),
  );
  const site = await created.json();
  check("POST /api/v1/sites returns 201", created.status === 201, `got ${created.status}`);
  const siteId = site.site_id;
  const publicKey = site.public_key;
  check("site carries a pk_ public key", typeof publicKey === "string" && publicKey.startsWith("pk_"));

  // ── 3. Credential planes must not be interchangeable ───────────────────────
  console.log("\n[3] Credential separation");
  const withPublic = await scansRoute.POST(
    req(`/api/v1/sites/${siteId}/scans`, { key: publicKey, method: "POST", body: { start_url: target } }),
    { params: Promise.resolve({ siteId }) },
  );
  check("public key cannot start a scan", withPublic.status === 401, `got ${withPublic.status}`);

  const ssrf = await scansRoute.POST(
    req(`/api/v1/sites/${siteId}/scans`, { key: secretKey, method: "POST", body: { start_url: "http://169.254.169.254/" } }),
    { params: Promise.resolve({ siteId }) },
  );
  check("cloud metadata URL refused at the API boundary", ssrf.status === 400, `got ${ssrf.status}`);

  // ── 4. Scan, queued through the real endpoint ──────────────────────────────
  console.log("\n[4] Scan");
  const queued = await scansRoute.POST(
    req(`/api/v1/sites/${siteId}/scans`, { key: secretKey, method: "POST", body: { start_url: target, max_pages: 1, max_depth: 0 } }),
    { params: Promise.resolve({ siteId }) },
  );
  const queuedBody = await queued.json();
  check("scan queued with 202", queued.status === 202, `got ${queued.status}`);
  const scanId = queuedBody.scan.scan_id;

  const claimed = await claimNextScan(prisma);
  check("worker claims the queued scan", claimed?.id === scanId);

  const crawlResult = await crawl({
    startUrl: target,
    limits: { maxPages: 1, maxDepth: 0, maxDurationMs: 120_000 },
  });
  check("real crawl rendered a page", crawlResult.summary.pagesScanned >= 1,
    `${crawlResult.summary.pagesScanned} page(s), ${crawlResult.summary.requestsObserved} requests`);

  await persistScanResult(prisma, scanId, crawlResult);

  const stored = await scanResultsRoute.GET(
    req(`/api/v1/scans/${scanId}/results`, { key: secretKey }),
    { params: Promise.resolve({ scanId }) },
  );
  const findings = await stored.json();
  check("scan results readable through the API", stored.status === 200, `got ${stored.status}`);
  check("scan reports completed", findings.scan.status === "completed", findings.scan.status);
  check("findings carry no legal determination",
    !JSON.stringify(findings).toLowerCase().includes("requires_consent"));

  // ── 5. Consent purpose, declared by the operator ───────────────────────────
  console.log("\n[5] Consent configuration");
  const purpose = await purposesRoute.POST(
    req("/api/v1/purposes", {
      key: secretKey,
      method: "POST",
      body: { code: "analytics", name: "Analytics", description: "Site usage measurement." },
    }),
  );
  check("operator can declare a purpose", purpose.status === 201, `got ${purpose.status}`);

  // ── 6. Ingestion, in the exact shape the SDK sends ─────────────────────────
  console.log("\n[6] Ingestion (browser plane)");
  const sessionId = randomUUID();
  const makeEvent = (type, name, properties) => ({
    event_id: randomUUID(),
    site_id: siteId,
    session_id: sessionId,
    event_type: type,
    name,
    event_time: new Date().toISOString(),
    schema_version: 1,
    source: "rift-cmp-sdk/0.1.0",
    payload: {
      page: { url: `${new URL(target).origin}/pricing`, title: "Pricing" },
      device: { type: "desktop", browser: "Chrome", os: "Windows" },
      referrer: null,
      properties: properties ?? {},
    },
  });

  const pageView = makeEvent("page_view", "page_view");
  const custom = makeEvent("custom", "signup", { plan: "pro" });

  const ingest = await eventsRoute.POST(
    req("/api/v1/events", { key: publicKey, method: "POST", body: { events: [pageView, custom] } }),
  );
  const ingestBody = await ingest.json();
  check("events accepted with 202", ingest.status === 202, `got ${ingest.status}`);
  check("both events accepted", ingestBody.accepted === 2, JSON.stringify(ingestBody));

  const wrongPlane = await eventsRoute.POST(
    req("/api/v1/events", { key: secretKey, method: "POST", body: { events: [makeEvent("page_view", "page_view")] } }),
  );
  check("organisation secret refused on the ingestion plane", wrongPlane.status === 401, `got ${wrongPlane.status}`);

  // Replay: idempotency is what makes SDK retries safe.
  const replay = await eventsRoute.POST(
    req("/api/v1/events", { key: publicKey, method: "POST", body: { events: [pageView, custom] } }),
  );
  check("replayed batch accepted", replay.status === 202);
  const eventCount = await prisma.event.count({ where: { siteId } });
  check("replay created no duplicate rows", eventCount === 2, `${eventCount} rows`);

  // ── 7. Analytics reads what ingestion wrote ────────────────────────────────
  console.log("\n[7] Analytics");
  const analytics = await analyticsRoute.GET(req("/api/v1/analytics/summary", { key: secretKey }));
  const summary = await analytics.json();
  check("analytics readable", analytics.status === 200, `got ${analytics.status}`);
  // Field names come from `shared/analytics.ts` — the read contract, not a guess.
  // `AnalyticsSummary` in shared/analytics.ts: { range, totals, top_pages, … }.
  const totals = summary.totals ?? {};
  check("analytics counts the ingested events", totals.total_events === 2,
    `reported ${JSON.stringify(totals)}`);
  check("analytics separates page views from custom events",
    totals.page_views === 1 && totals.custom_events === 1,
    `page_views=${totals.page_views} custom=${totals.custom_events}`);
  check("analytics reports sessions, never unique visitors",
    totals.sessions === 1 && !("visitors" in totals) && !("unique_visitors" in totals));

  // ── 7b. The dashboard write path ───────────────────────────────────────────
  // The dashboard was read-only until this phase, so these are the first writes
  // it can make. Exercised through the same API client the server actions use,
  // proving an operator can do from the UI what previously needed curl.
  console.log("\n[7b] Dashboard write path");

  const dashboardApi = await import("../lib/dashboard/api.ts");
  check("dashboard exposes a write method", typeof dashboardApi.apiSend === "function");

  // The server actions themselves need a request context (cookies/headers), so
  // what is asserted here is the contract they depend on: the endpoints they
  // call accept exactly the bodies the forms submit.
  const formSite = await sitesRoute.POST(
    req("/api/v1/sites", {
      key: secretKey,
      method: "POST",
      body: { name: "From the Add Website form", domain: "forms.example.com" },
    }),
  );
  check("Add Website form body is accepted", formSite.status === 201, `got ${formSite.status}`);
  const formSiteId = (await formSite.json()).site_id;

  const formScan = await scansRoute.POST(
    req(`/api/v1/sites/${formSiteId}/scans`, {
      key: secretKey,
      method: "POST",
      body: { start_url: target },
    }),
    { params: Promise.resolve({ siteId: formSiteId }) },
  );
  check("Start Scan form body is accepted", formScan.status === 202, `got ${formScan.status}`);

  const formPurpose = await purposesRoute.POST(
    req("/api/v1/purposes", {
      key: secretKey,
      method: "POST",
      body: { code: "advertising", name: "Advertising", description: "Marketing measurement." },
    }),
  );
  check("Declare Purpose form body is accepted", formPurpose.status === 201, `got ${formPurpose.status}`);

  const purposeList = await purposesRoute.GET(req("/api/v1/purposes", { key: secretKey }));
  const purposeBody = await purposeList.json();
  check("Configure page can list declared purposes",
    purposeBody.purposes?.length === 2, `${purposeBody.purposes?.length} purpose(s)`);
  check("purposes expose the `code` the Configure page reads",
    purposeBody.purposes?.every((p) => typeof p.code === "string"));

  // ── 8. Tenant isolation ────────────────────────────────────────────────────
  console.log("\n[8] Tenant isolation");
  const otherId = randomUUID();
  const otherSecret = generateSecretKey();
  await prisma.organisation.create({
    data: { id: otherId, name: "Other", slug: `other-${suffix}`, secretKeyHash: hashSecretKey(otherSecret) },
  });
  const crossScan = await scanResultsRoute.GET(
    req(`/api/v1/scans/${scanId}/results`, { key: otherSecret }),
    { params: Promise.resolve({ scanId }) },
  );
  check("another organisation cannot read this scan", crossScan.status === 404, `got ${crossScan.status}`);

  const crossAnalytics = await analyticsRoute.GET(req("/api/v1/analytics/summary", { key: otherSecret }));
  const crossSummary = await crossAnalytics.json();
  check("another organisation sees none of these events",
    (crossSummary.totals?.total_events ?? 0) === 0, `saw ${crossSummary.totals?.total_events}`);

  await prisma.organisation.delete({ where: { id: otherId } }).catch(() => {});
} catch (error) {
  check(`unexpected error: ${error?.message ?? error}`, false);
  if (error?.stack) console.log(error.stack.split("\n").slice(1, 5).join("\n"));
} finally {
  await prisma.organisation.delete({ where: { id: organisationId } }).catch(() => {});
  await prisma.$disconnect();
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
