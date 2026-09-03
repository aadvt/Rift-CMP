import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { POST as ingest } from "@/app/api/v1/events/route";
import { POST as openSession } from "@/app/api/v1/consent/session/route";
import { POST as reportDiscovery } from "@/app/api/v1/discovery/route";
import { RATE_LIMITS, checkRateLimit, resetRateLimits } from "@/lib/rate-limit";
import {
  buildEvent,
  createOwnershipTree,
  ingestRequest,
  resetDatabase,
  siteRequest,
} from "./helpers/fixtures";

/**
 * The browser-facing planes end to end: origin validation and rate limiting as
 * the routes actually apply them.
 *
 * `lib/origin.ts` and `lib/rate-limit.ts` have their own unit tests. This file
 * is about the wiring — that the checks are on every browser-facing route, in
 * the right order, and that a refusal still carries CORS headers so the SDK can
 * read the status instead of seeing an opaque network error.
 */

beforeEach(resetDatabase);

function discoveryReport(siteId: string) {
  return {
    site_id: siteId,
    page_url: "https://a1.example.com/pricing",
    collected_at: new Date().toISOString(),
    schema_version: 1,
    source: "rift-cmp-sdk/test",
    destinations: [],
    storage: [],
    violations: [],
  };
}

describe("origin validation on the ingestion plane", () => {
  it("accepts a request from the site's registered domain", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { key: siteA1.publicKey, origin: "https://a1.example.com" },
      ),
    );

    expect(response.status).toBe(202);
    expect(await prisma.event.count()).toBe(1);
  });

  it("refuses a request from an origin the site never registered", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { key: siteA1.publicKey, origin: "https://stolen-key.test" },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "origin_not_allowed" },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("accepts an origin an operator added to the allowlist", async () => {
    const { siteA1 } = await createOwnershipTree();
    await prisma.website.update({
      where: { id: siteA1.siteId },
      data: { allowedOrigins: ["https://checkout.partner.test"] },
    });

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { key: siteA1.publicKey, origin: "https://checkout.partner.test" },
      ),
    );

    expect(response.status).toBe(202);
  });

  it("accepts a request with no Origin at all, as a server-to-server caller sends", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );

    // Documented plainly: Origin is defence in depth. Its absence is normal, so
    // it cannot be required, and therefore it cannot be a control.
    expect(response.status).toBe(202);
  });

  it("echoes the caller's origin rather than a wildcard once it has been checked", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { key: siteA1.publicKey, origin: "https://a1.example.com" },
      ),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://a1.example.com");
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("keeps CORS headers on a refusal, so the SDK can read the status", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { key: siteA1.publicKey, origin: "https://stolen-key.test" },
      ),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("origin validation on the other browser-facing routes", () => {
  it("applies to the consent session endpoint", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: {},
        origin: "https://stolen-key.test",
      }),
    );

    expect(response.status).toBe(403);
    expect(await prisma.principal.count()).toBe(0);
  });

  it("applies to discovery reports", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      siteRequest("/api/v1/discovery", {
        key: siteA1.publicKey,
        method: "POST",
        body: discoveryReport(siteA1.siteId),
        origin: "https://stolen-key.test",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("still accepts a legitimate discovery report", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await reportDiscovery(
      siteRequest("/api/v1/discovery", {
        key: siteA1.publicKey,
        method: "POST",
        body: discoveryReport(siteA1.siteId),
        origin: "https://a1.example.com",
      }),
    );

    expect(response.status).toBe(202);
  });
});

describe("authentication happens before the origin check", () => {
  it("answers 401, not 403, when the credential is also wrong", async () => {
    const { siteA1 } = await createOwnershipTree();

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { key: "pk_not_a_real_key", origin: "https://stolen-key.test" },
      ),
    );

    // Otherwise the origin check would become an oracle for which keys exist.
    expect(response.status).toBe(401);
  });
});

describe("rate limiting at the route", () => {
  it("returns 429 once a site's ingestion allowance is spent", async () => {
    const { siteA1 } = await createOwnershipTree();

    // Spend the per-client allowance directly rather than issuing 120 real
    // requests: the route and the limiter agree on the key, which is what is
    // being tested, and the counting itself is covered in rate-limit.test.ts.
    const key = `events:${siteA1.siteId}:unknown`;
    for (let i = 0; i < RATE_LIMITS.events.limit; i += 1) {
      checkRateLimit(key, RATE_LIMITS.events);
    }

    const response = await ingest(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "rate_limited" } });
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(await prisma.event.count()).toBe(0);
  });

  it("limits one site without limiting its sibling", async () => {
    const { siteA1, siteA2 } = await createOwnershipTree();

    for (let i = 0; i < RATE_LIMITS.events.limit; i += 1) {
      checkRateLimit(`events:${siteA1.siteId}:unknown`, RATE_LIMITS.events);
    }

    const blocked = await ingest(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );
    const allowed = await ingest(
      ingestRequest({ events: [buildEvent({ site_id: siteA2.siteId })] }, { key: siteA2.publicKey }),
    );

    expect(blocked.status).toBe(429);
    expect(allowed.status).toBe(202);
  });

  it("limits an unauthenticated flood before it reaches a credential lookup", async () => {
    await createOwnershipTree();

    for (let i = 0; i < RATE_LIMITS.unauthenticated.limit; i += 1) {
      checkRateLimit("pre:events:unknown", RATE_LIMITS.unauthenticated);
    }

    const response = await ingest(ingestRequest({ events: [] }, { key: "pk_not_a_real_key" }));

    // 429 rather than 401: the request never got as far as being authenticated,
    // which is the point of putting this limit first.
    expect(response.status).toBe(429);
  });

  it("caps consent session creation tightly", async () => {
    const { siteA1 } = await createOwnershipTree();

    for (let i = 0; i < RATE_LIMITS.consentSession.limit; i += 1) {
      checkRateLimit(`consent-session:${siteA1.siteId}:unknown`, RATE_LIMITS.consentSession);
    }

    const response = await openSession(
      siteRequest("/api/v1/consent/session", {
        key: siteA1.publicKey,
        method: "POST",
        body: {},
      }),
    );

    expect(response.status).toBe(429);
    // No principal row was created, which is what this limit is protecting.
    expect(await prisma.principal.count()).toBe(0);
  });

  it("recovers on its own once the window rolls over", async () => {
    const { siteA1 } = await createOwnershipTree();

    for (let i = 0; i < RATE_LIMITS.events.limit; i += 1) {
      checkRateLimit(`events:${siteA1.siteId}:unknown`, RATE_LIMITS.events);
    }
    expect(
      (
        await ingest(
          ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
        )
      ).status,
    ).toBe(429);

    resetRateLimits();

    const response = await ingest(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );
    expect(response.status).toBe(202);
  });
});
