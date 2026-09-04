/**
 * End-to-end proof that the scanner pipeline works against a real website.
 *
 * Everything else in Phase 8A is tested with pure logic or a synthetic result
 * fixture. Nothing had ever launched a browser, so the Playwright half of the
 * crawler was reviewed and typechecked but never executed. This script closes
 * that gap by driving the real path:
 *
 *   createScan  →  claimNextScan  →  crawl() with a real Chromium
 *               →  persistScanResult  →  read the results back
 *
 * It uses the same functions the API and worker use, so a pass here means the
 * vertical slice genuinely works rather than that a mock agreed with itself.
 *
 * Usage:
 *   node crawler/scripts/e2e.mjs https://example.com [maxPages]
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const startUrl = process.argv[2] ?? "https://example.com/";
const maxPages = Number(process.argv[3] ?? 3);

// Point at the same test schema the integration suite uses, so this never
// touches development data.
const envRaw = readFileSync(new URL("../../database/.env", import.meta.url), "utf8");
const base = /DATABASE_URL\s*=\s*"?([^"\n]+)/.exec(envRaw)[1];
const direct = base.replace("-pooler.", ".").replace(/([?&])schema=[^&]*/g, "$1").replace(/[?&]+$/, "");
process.env.DATABASE_URL = `${direct}${direct.includes("?") ? "&" : "?"}schema=rift_cmp_test`;

const {
  prisma,
  createScan,
  claimNextScan,
  persistScanResult,
  getScanWithObservations,
  hashSecretKey,
  generateSecretKey,
  generatePublicKey,
} = await import("database");

const { crawl, CRAWLER_VERSION } = await import("../src/crawl.ts");

const line = (s = "") => console.log(s);
const step = (n, s) => console.log(`\n[${n}] ${s}`);

line(`Rift-CMP scanner end-to-end`);
line(`crawler ${CRAWLER_VERSION}   target ${startUrl}   maxPages ${maxPages}`);

// ── 1. A tenant to own the scan ──────────────────────────────────────────────
step(1, "Creating a tenant and site");
const organisationId = randomUUID();
const siteId = randomUUID();
const suffix = Date.now();

await prisma.organisation.create({
  data: {
    id: organisationId,
    name: "E2E Org",
    slug: `e2e-${suffix}`,
    secretKeyHash: hashSecretKey(generateSecretKey()),
  },
});
await prisma.website.create({
  data: {
    id: siteId,
    organisationId,
    name: "E2E Site",
    domain: new URL(startUrl).hostname,
    publicKey: generatePublicKey(),
  },
});
line(`    site ${siteId}`);

let exitCode = 0;
try {
  // ── 2. Queue, exactly as POST /api/v1/sites/{id}/scans does ────────────────
  step(2, "Queueing the scan (what the API endpoint does)");
  const queued = await createScan(prisma, {
    organisationId,
    siteId,
    startUrl,
    config: { maxPages, maxDepth: 1, maxDurationMs: 120_000 },
  });
  line(`    scan ${queued.id}  status=${queued.status}`);

  // ── 3. Claim, exactly as the worker does ───────────────────────────────────
  step(3, "Claiming it (what the worker does)");
  const claimed = await claimNextScan(prisma);
  if (!claimed || claimed.id !== queued.id) throw new Error("worker failed to claim the scan");
  line(`    status=${claimed.status}`);

  // ── 4. The part that has never run before ──────────────────────────────────
  step(4, "Crawling with a real browser");
  const started = Date.now();
  const result = await crawl({
    startUrl,
    limits: claimed.config ?? {},
    onEvent: (event) => {
      if (event.event === "page_scanned") line(`    ✓ ${event.status} ${event.url} (${event.durationMs}ms)`);
      else if (event.event === "page_failed") line(`    ✗ ${event.url} — ${event.error}`);
      else if (event.event.startsWith("robots")) line(`    robots: ${event.event}`);
      else if (event.event === "limit_reached") line(`    limit reached: ${event.limit}`);
    },
  });
  line(`    crawl finished in ${Math.round((Date.now() - started) / 1000)}s`);

  // ── 5. Persist, exactly as the worker does ─────────────────────────────────
  step(5, "Persisting observations");
  await persistScanResult(prisma, queued.id, result);

  // ── 6. Read back through the same query the results endpoint uses ──────────
  step(6, "Reading results back (what GET /results does)");
  const stored = await getScanWithObservations(prisma, organisationId, queued.id);

  line();
  line("─".repeat(64));
  line(`status              ${stored.status}`);
  line(`crawler version     ${stored.crawlerVersion}`);
  line(`robots              ${stored.robotsSource}`);
  line(`limit reached       ${stored.limitReached ?? "none — finished naturally"}`);
  line();
  line(`pages discovered    ${stored.pagesDiscovered}`);
  line(`pages scanned       ${stored.pagesScanned}`);
  line(`pages failed        ${stored.pagesFailed}`);
  line(`cookies             ${stored.cookiesFound}`);
  line(`scripts             ${stored.scriptsFound}`);
  line(`requests observed   ${stored.requestsObserved}`);
  line(`storage items       ${stored.storageItemsFound}`);
  line(`third-party domains ${stored.thirdPartyDomains}`);
  line(`technologies        ${stored.technologiesDetected}`);
  line(`consent UI detected ${stored.consentUiDetected}`);
  line("─".repeat(64));

  if (stored.technologies.length) {
    line("\nTechnologies detected:");
    for (const t of stored.technologies) {
      const where = t.destinationCountry ? ` → ${t.destinationCountry}` : "";
      line(`  ${t.confidence.padEnd(6)} ${t.name} (${t.category})${where}`);
      for (const e of t.evidence.slice(0, 2)) line(`         ${e.type}: ${e.value}`);
    }
  }

  if (stored.cookies.length) {
    line("\nCookies (names and flags only — no values are stored):");
    for (const c of stored.cookies.slice(0, 10)) {
      line(`  ${c.name}  ${c.domain}  ${c.isThirdParty ? "third-party" : "first-party"}` +
        `${c.secure ? " secure" : ""}${c.httpOnly ? " httpOnly" : ""}`);
    }
  }

  const thirdParty = stored.requests.filter((r) => r.isThirdParty);
  if (thirdParty.length) {
    line("\nThird-party destinations:");
    for (const r of thirdParty.slice(0, 12)) {
      line(`  ${String(r.requestCount).padStart(4)}×  ${r.host}  (${r.resourceType})`);
    }
  }

  // ── 7. Privacy assertions against what actually landed in the database ─────
  step(7, "Verifying the privacy guarantees on real data");
  const problems = [];

  for (const c of stored.cookies) {
    if ("value" in c) problems.push(`cookie ${c.name} carries a value`);
  }
  for (const r of stored.requests) {
    if (r.samplePath && r.samplePath.includes("?")) {
      problems.push(`request sample_path has a query string: ${r.samplePath}`);
    }
  }
  for (const s of stored.scripts) {
    if (s.url && s.url.includes("?")) problems.push(`script url has a query string: ${s.url}`);
  }
  for (const s of stored.storage) {
    if ("value" in s) problems.push(`storage ${s.name} carries a value`);
  }

  if (problems.length) {
    line("    FAILED:");
    for (const p of problems) line(`      - ${p}`);
    exitCode = 1;
  } else {
    line("    ✓ no cookie values, no storage values, no query strings on resources");
  }
} catch (error) {
  line(`\nFAILED: ${error?.message ?? error}`);
  if (error?.stack) line(error.stack.split("\n").slice(1, 4).join("\n"));
  exitCode = 1;
} finally {
  // Leave the test schema as we found it.
  await prisma.organisation.delete({ where: { id: organisationId } }).catch(() => {});
  await prisma.$disconnect();
}

process.exit(exitCode);
