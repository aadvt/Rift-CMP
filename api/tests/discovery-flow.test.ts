import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { POST as reportDiscovery } from "@/app/api/v1/discovery/route";
import { GET as readInventory } from "@/app/api/v1/discovery/inventory/route";
import {
  createOwnershipTree,
  ingestRequest,
  managementRequest,
  resetDatabase,
} from "./helpers/fixtures";

beforeEach(resetDatabase);

const BASE_REPORT = {
  site_id: "ignored-by-the-server",
  page_url: "https://shop.example.com/checkout",
  collected_at: new Date().toISOString(),
  schema_version: 1,
  source: "rift-cmp-sdk/0.1.0",
  destinations: [] as unknown[],
  storage: [] as unknown[],
  violations: [] as unknown[],
};

function destination(overrides: Record<string, unknown> = {}) {
  return {
    host: "connect.facebook.net",
    kind: "script",
    initiator: "www.googletagmanager.com/gtm.js",
    sample_path: "/en_US/fbevents.js",
    third_party: true,
    request_count: 1,
    first_seen: new Date().toISOString(),
    ...overrides,
  };
}

/** The discovery route is mounted at its own path, so build the URL explicitly. */
function discoveryRequest(body: unknown, key?: string) {
  const request = ingestRequest(body, { key });
  return new Request(request.url.replace("/api/v1/events", "/api/v1/discovery"), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof reportDiscovery>[0];
}

describe("discovery ingestion", () => {
  it("records a destination and classifies it server-side", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      discoveryRequest({ ...BASE_REPORT, destinations: [destination()] }, siteA1.publicKey),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ destinations_recorded: 1 });

    const stored = await prisma.discoveredComponent.findFirstOrThrow({
      where: { siteId: siteA1.siteId },
    });
    // The SDK sent no vendor; classification is entirely the server's doing.
    expect(stored.vendor).toBe("Meta Pixel");
    expect(stored.destinationCountry).toBe("US");
    expect(stored.crossesBorder).toBe(true);
    expect(stored.initiator).toBe("www.googletagmanager.com/gtm.js");
  });

  it("aggregates repeat sightings instead of growing the table", async () => {
    const { siteA1 } = await createOwnershipTree();
    const body = { ...BASE_REPORT, destinations: [destination({ request_count: 3 })] };

    await reportDiscovery(discoveryRequest(body, siteA1.publicKey));
    await reportDiscovery(discoveryRequest(body, siteA1.publicKey));

    const rows = await prisma.discoveredComponent.findMany({ where: { siteId: siteA1.siteId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].requestCount).toBe(6);
  });

  it("keeps first_seen fixed while last_seen advances", async () => {
    const { siteA1 } = await createOwnershipTree();
    const firstSeen = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    await reportDiscovery(
      discoveryRequest(
        { ...BASE_REPORT, destinations: [destination({ first_seen: firstSeen })] },
        siteA1.publicKey,
      ),
    );
    await reportDiscovery(
      discoveryRequest({ ...BASE_REPORT, destinations: [destination()] }, siteA1.publicKey),
    );

    const row = await prisma.discoveredComponent.findFirstOrThrow({
      where: { siteId: siteA1.siteId },
    });
    expect(row.firstSeen.toISOString()).toBe(firstSeen);
    expect(row.lastSeen.getTime()).toBeGreaterThan(row.firstSeen.getTime());
  });

  it("appends violations rather than collapsing them", async () => {
    const { siteA1 } = await createOwnershipTree();
    const violation = {
      host: "connect.facebook.net",
      purpose_code: "advertising",
      consent_status: "WITHDRAWN",
      observed_at: new Date().toISOString(),
    };

    await reportDiscovery(
      discoveryRequest({ ...BASE_REPORT, violations: [violation] }, siteA1.publicKey),
    );
    await reportDiscovery(
      discoveryRequest({ ...BASE_REPORT, violations: [violation] }, siteA1.publicKey),
    );

    // Two observations are two pieces of evidence, not one deduplicated row.
    expect(await prisma.discoveryViolation.count({ where: { siteId: siteA1.siteId } })).toBe(2);
  });
});

describe("discovery refuses to carry personal data", () => {
  it("rejects a host that is really a URL", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      discoveryRequest(
        {
          ...BASE_REPORT,
          destinations: [destination({ host: "https://tracker.example.com/collect?uid=abc123" })],
        },
        siteA1.publicKey,
      ),
    );

    expect(response.status).toBe(400);
    expect(await prisma.discoveredComponent.count()).toBe(0);
  });

  it("rejects a sample path carrying a query string", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      discoveryRequest(
        { ...BASE_REPORT, destinations: [destination({ sample_path: "/collect?uid=abc123" })] },
        siteA1.publicKey,
      ),
    );

    expect(response.status).toBe(400);
    expect(await prisma.discoveredComponent.count()).toBe(0);
  });

  it("rejects a page_url carrying a query string", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      discoveryRequest(
        { ...BASE_REPORT, page_url: "https://shop.example.com/checkout?email=a@b.com" },
        siteA1.publicKey,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects unknown fields rather than silently dropping them", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      discoveryRequest(
        { ...BASE_REPORT, principal_external_id: "visitor-123" },
        siteA1.publicKey,
      ),
    );

    // Strict parsing: an SDK that started sending an identifier must fail
    // loudly rather than have the field quietly ignored.
    expect(response.status).toBe(400);
  });
});

describe("discovery tenancy", () => {
  it("files a report under the credential's site, not the body's site_id", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();

    await reportDiscovery(
      discoveryRequest(
        { ...BASE_REPORT, site_id: siteB1.siteId, destinations: [destination()] },
        siteA1.publicKey,
      ),
    );

    expect(await prisma.discoveredComponent.count({ where: { siteId: siteA1.siteId } })).toBe(1);
    expect(await prisma.discoveredComponent.count({ where: { siteId: siteB1.siteId } })).toBe(0);
  });

  it("refuses an unauthenticated report", async () => {
    const response = await reportDiscovery(discoveryRequest(BASE_REPORT));
    expect(response.status).toBe(401);
  });

  it("refuses to read an inventory with a site public key", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await readInventory(
      managementRequest("/api/v1/discovery/inventory", {
        key: siteA1.publicKey,
        query: { site_id: siteA1.siteId },
      }),
    );

    // The inventory names every vendor a business uses; a key that ships in
    // page source must not be able to read it back.
    expect(response.status).toBe(401);
  });

  it("hides one organisation's inventory from another", async () => {
    const { orgA, siteA1, siteB1 } = await createOwnershipTree();

    await reportDiscovery(
      discoveryRequest({ ...BASE_REPORT, destinations: [destination()] }, siteB1.publicKey),
    );

    const response = await readInventory(
      managementRequest("/api/v1/discovery/inventory", {
        key: orgA.secretKey,
        query: { site_id: siteB1.siteId },
      }),
    );

    // Organisation A holds a valid secret, but not for site B1.
    expect(response.status).toBe(404);

    const own = await readInventory(
      managementRequest("/api/v1/discovery/inventory", {
        key: orgA.secretKey,
        query: { site_id: siteA1.siteId },
      }),
    );
    expect(own.status).toBe(200);
    await expect(own.json()).resolves.toMatchObject({ totals: { destinations: 0 } });
  });
});

describe("discovery inventory", () => {
  it("counts unclassified third parties separately from known vendors", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();

    await reportDiscovery(
      discoveryRequest(
        {
          ...BASE_REPORT,
          destinations: [
            destination(),
            destination({ host: "unknown-vendor.example", kind: "fetch", initiator: null }),
            destination({ host: "checkout.razorpay.com", kind: "iframe" }),
          ],
        },
        siteA1.publicKey,
      ),
    );

    const response = await readInventory(
      managementRequest("/api/v1/discovery/inventory", {
        key: orgA.secretKey,
        query: { site_id: siteA1.siteId },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totals.destinations).toBe(3);
    expect(body.totals.third_party).toBe(3);
    expect(body.totals.unclassified).toBe(1);
    // Meta crosses the border; Razorpay does not; the unknown host is not
    // counted as crossing because we cannot evidence that it does.
    expect(body.totals.cross_border).toBe(1);
  });
});
