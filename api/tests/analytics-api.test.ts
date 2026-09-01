import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import type { AnalyticsSummary, PlatformOverview } from "@rift-cmp/shared";
import { GET as getSummary } from "@/app/api/v1/analytics/summary/route";
import { GET as getOverview } from "@/app/api/v1/analytics/overview/route";
import {
  createOwnershipTree,
  createTransferScenario,
  managementRequest,
  resetDatabase,
} from "./helpers/fixtures";
import { daysBefore, REFERENCE_NOW, seedActivity } from "./helpers/activity";

/**
 * The analytics and overview read models.
 *
 * These are the only endpoints that aggregate across a whole tenant, so the
 * isolation tests matter as much as the arithmetic ones.
 */

beforeEach(resetDatabase);

/**
 * A range wide enough to include everything the fixtures seed.
 *
 * `seedActivity` dates events relative to a fixed reference point in the past,
 * but `createTransferScenario` records consent at the real current time, so the
 * upper bound has to reach beyond now.
 */
const WIDE = {
  from: daysBefore(90).toISOString(),
  to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

async function summaryFor(
  key: string,
  query: Record<string, string> = WIDE,
): Promise<{ status: number; body: AnalyticsSummary }> {
  const response = await getSummary(
    managementRequest("/api/v1/analytics/summary", { key, query }),
  );
  return { status: response.status, body: (await response.json()) as AnalyticsSummary };
}

async function overviewFor(
  key: string,
  query: Record<string, string> = WIDE,
): Promise<{ status: number; body: PlatformOverview }> {
  const response = await getOverview(
    managementRequest("/api/v1/analytics/overview", { key, query }),
  );
  return { status: response.status, body: (await response.json()) as PlatformOverview };
}

describe("analytics summary", () => {
  it("returns a complete zeroed shape for a tenant with no activity", async () => {
    const { orgA } = await createOwnershipTree();
    const { status, body } = await summaryFor(orgA.secretKey);

    expect(status).toBe(200);
    // An empty tenant must render the same shape as a busy one, so the
    // dashboard shows zeros rather than crashing on a missing field.
    expect(body.totals).toEqual({
      sessions: 0,
      page_views: 0,
      custom_events: 0,
      total_events: 0,
      active_sites: 0,
    });
    expect(body.top_pages).toEqual([]);
    expect(body.devices).toEqual([]);
    expect(body.by_site.map((site) => site.total_events)).toEqual([0, 0]);
  });

  it("counts sessions, page views and custom events", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    await seedActivity({
      siteId: siteA1.siteId,
      sessions: [
        {
          startedAt: daysBefore(2),
          pages: [
            { url: "https://example.com/", title: "Home" },
            { url: "https://example.com/pricing", title: "Pricing" },
          ],
          customEvents: 2,
        },
        { startedAt: daysBefore(1), pages: [{ url: "https://example.com/", title: "Home" }] },
      ],
    });

    const { body } = await summaryFor(orgA.secretKey);

    expect(body.totals.sessions).toBe(2);
    expect(body.totals.page_views).toBe(3);
    expect(body.totals.custom_events).toBe(2);
    // 2 session_start + 3 page_view + 2 custom
    expect(body.totals.total_events).toBe(7);
    expect(body.totals.active_sites).toBe(1);
  });

  it("ranks top pages by views", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    await seedActivity({
      siteId: siteA1.siteId,
      sessions: [
        {
          startedAt: daysBefore(2),
          pages: [
            { url: "https://example.com/pricing", title: "Pricing" },
            { url: "https://example.com/pricing", title: "Pricing" },
            { url: "https://example.com/", title: "Home" },
          ],
        },
      ],
    });

    const { body } = await summaryFor(orgA.secretKey);

    expect(body.top_pages[0]).toMatchObject({ url: "https://example.com/pricing", views: 2 });
    expect(body.top_pages[1]).toMatchObject({ url: "https://example.com/", views: 1 });
  });

  it("breaks activity down by device, browser and operating system", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    await seedActivity({
      siteId: siteA1.siteId,
      sessions: [
        { startedAt: daysBefore(3), device: "mobile", browser: "Safari", os: "iOS" },
        { startedAt: daysBefore(2), device: "desktop", browser: "Chrome", os: "Windows" },
        { startedAt: daysBefore(1), device: "desktop", browser: "Chrome", os: "macOS" },
      ],
    });

    const { body } = await summaryFor(orgA.secretKey);

    expect(body.devices.map((entry) => entry.key)).toEqual(["desktop", "mobile"]);
    expect(body.browsers.find((entry) => entry.key === "Chrome")?.events).toBe(4);
    expect(body.operating_systems.map((entry) => entry.key).sort()).toEqual([
      "Windows",
      "iOS",
      "macOS",
    ]);
  });

  it("attributes activity to the right site", async () => {
    const { orgA, siteA1, siteA2 } = await createOwnershipTree();
    await seedActivity({ siteId: siteA1.siteId, sessions: [{ startedAt: daysBefore(1) }] });
    await seedActivity({
      siteId: siteA2.siteId,
      sessions: [{ startedAt: daysBefore(1) }, { startedAt: daysBefore(2) }],
    });

    const { body } = await summaryFor(orgA.secretKey);
    const bySite = Object.fromEntries(body.by_site.map((site) => [site.site_id, site.sessions]));

    expect(bySite[siteA1.siteId]).toBe(1);
    expect(bySite[siteA2.siteId]).toBe(2);
    expect(body.totals.active_sites).toBe(2);
  });

  it("narrows to a single site when asked", async () => {
    const { orgA, siteA1, siteA2 } = await createOwnershipTree();
    await seedActivity({ siteId: siteA1.siteId, sessions: [{ startedAt: daysBefore(1) }] });
    await seedActivity({ siteId: siteA2.siteId, sessions: [{ startedAt: daysBefore(1) }] });

    const { body } = await summaryFor(orgA.secretKey, { ...WIDE, site_id: siteA1.siteId });

    expect(body.totals.sessions).toBe(1);
    expect(body.by_site).toHaveLength(1);
    expect(body.by_site[0].site_id).toBe(siteA1.siteId);
  });

  it("honours the date range", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    await seedActivity({
      siteId: siteA1.siteId,
      sessions: [{ startedAt: daysBefore(40) }, { startedAt: daysBefore(2) }],
    });

    const recent = await summaryFor(orgA.secretKey, {
      from: daysBefore(7).toISOString(),
      to: REFERENCE_NOW.toISOString(),
    });
    expect(recent.body.totals.sessions).toBe(1);

    const everything = await summaryFor(orgA.secretKey);
    expect(everything.body.totals.sessions).toBe(2);
  });
});

describe("analytics request validation", () => {
  it("rejects a malformed date", async () => {
    const { orgA } = await createOwnershipTree();
    const response = await getSummary(
      managementRequest("/api/v1/analytics/summary", {
        key: orgA.secretKey,
        query: { from: "last-tuesday" },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a range that runs backwards", async () => {
    const { orgA } = await createOwnershipTree();
    const response = await getSummary(
      managementRequest("/api/v1/analytics/summary", {
        key: orgA.secretKey,
        query: { from: REFERENCE_NOW.toISOString(), to: daysBefore(7).toISOString() },
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("platform overview", () => {
  it("counts sites, consent, authorisations and transfers", async () => {
    const scenario = await createTransferScenario();
    await seedActivity({
      siteId: scenario.siteA1.siteId,
      sessions: [{ startedAt: daysBefore(1), customEvents: 1 }],
    });

    const { status, body } = await overviewFor(scenario.orgA.secretKey);

    expect(status).toBe(200);
    // Organisation A owns Site A1 and Site A2; Site B1 belongs to Organisation B.
    expect(body.sites.total).toBe(2);
    expect(body.consent.granted).toBe(1);
    expect(body.consent.total_decisions).toBe(1);
    expect(body.consent.principals).toBe(1);
    expect(body.activity.sessions).toBe(1);
    expect(body.activity.custom_events).toBe(1);
    // Nothing has been authorised or transferred yet.
    expect(body.authorisations.total).toBe(0);
    expect(body.transfers.total).toBe(0);
  });

  it("reports zeros rather than failing for a brand new organisation", async () => {
    const { orgB } = await createOwnershipTree();
    const { body } = await overviewFor(orgB.secretKey);

    expect(body.sites.total).toBe(1);
    expect(body.consent.total_decisions).toBe(0);
    expect(body.transfers.total).toBe(0);
    expect(body.activity.total_events).toBe(0);
  });
});

describe("analytics tenant isolation", () => {
  it("never aggregates another organisation's activity", async () => {
    const { orgA, orgB, siteA1, siteB1 } = await createOwnershipTree();
    await seedActivity({
      siteId: siteA1.siteId,
      sessions: [{ startedAt: daysBefore(1) }, { startedAt: daysBefore(2) }],
    });
    await seedActivity({ siteId: siteB1.siteId, sessions: [{ startedAt: daysBefore(1) }] });

    const a = await summaryFor(orgA.secretKey);
    const b = await summaryFor(orgB.secretKey);

    expect(a.body.totals.sessions).toBe(2);
    expect(b.body.totals.sessions).toBe(1);
    expect(a.body.by_site.map((site) => site.site_id)).not.toContain(siteB1.siteId);
    expect(b.body.by_site.map((site) => site.site_id)).not.toContain(siteA1.siteId);
  });

  it("refuses to narrow to another organisation's site", async () => {
    const { orgA, siteB1 } = await createOwnershipTree();

    for (const handler of [getSummary, getOverview]) {
      const response = await handler(
        managementRequest("/api/v1/analytics/summary", {
          key: orgA.secretKey,
          query: { site_id: siteB1.siteId },
        }),
      );
      expect(response.status).toBe(404);
    }
  });

  it("rejects unauthenticated and wrong-plane credentials", async () => {
    const scenario = await createTransferScenario();

    for (const key of [undefined, scenario.siteA1.publicKey, scenario.deliveryKey]) {
      for (const handler of [getSummary, getOverview]) {
        const response = await handler(
          managementRequest("/api/v1/analytics/summary", key ? { key } : {}),
        );
        expect(response.status).toBe(401);
      }
    }
  });
});

describe("analytics responses carry nothing sensitive", () => {
  it("returns only aggregates - no payloads, principals or key material", async () => {
    const scenario = await createTransferScenario();
    await seedActivity({
      siteId: scenario.siteA1.siteId,
      sessions: [{ startedAt: daysBefore(1), pages: [{ url: "https://example.com/x", title: "X" }] }],
    });

    const summary = JSON.stringify((await summaryFor(scenario.orgA.secretKey)).body);
    const overview = JSON.stringify((await overviewFor(scenario.orgA.secretKey)).body);

    for (const body of [summary, overview]) {
      // No credential material of any kind.
      expect(body).not.toContain(scenario.orgA.secretKey);
      expect(body).not.toContain(scenario.deliveryKey);
      expect(body).not.toContain(scenario.siteA1.publicKey);
      expect(body).not.toContain(scenario.target.privateKeyForAssertionsOnly);
      // No ciphertext or envelope fields leaking in from the transfer domain.
      expect(body).not.toContain("ciphertext");
      expect(body).not.toContain("ephemeral");
      // No individual principal identifiers - these endpoints are aggregate only.
      expect(body).not.toContain(scenario.principalExternalId);
    }

    // Sanity: the fixtures really did create the things we are asserting absent.
    expect(await prisma.consentRecord.count()).toBeGreaterThan(0);
    expect(await prisma.event.count()).toBeGreaterThan(0);
  });
});
