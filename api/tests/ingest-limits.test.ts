import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { EVENT_LIMITS } from "@rift-cmp/shared";
import { POST } from "@/app/api/v1/events/route";
import { buildEvent, createOwnershipTree, ingestRequest, resetDatabase } from "./helpers/fixtures";

beforeEach(resetDatabase);

/**
 * Bounds on what the ingestion plane will accept.
 *
 * Ingestion is authenticated with a site public key, which ships in page source
 * and is therefore held by everybody who can view it. Every other write endpoint
 * bounds its inputs; until Phase 7A this one did not, so the highest-volume
 * route in the system was also the only one where an unbounded string, an
 * unbounded property object or an unbounded batch reached Postgres.
 *
 * These tests pin the ceilings. They assert the *rejection*, not the number: the
 * numbers live in `EVENT_LIMITS` and are read from there, so raising a limit is
 * a one-line change and removing one fails here.
 */
describe("ingestion input bounds", () => {
  it("accepts an event sitting exactly on the limits", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({
      site_id: siteA1.siteId,
      name: "x".repeat(EVENT_LIMITS.name),
      source: "s".repeat(EVENT_LIMITS.source),
    });
    event.payload.page.url = `https://example.com/${"a".repeat(EVENT_LIMITS.url - 20)}`;
    event.payload.page.title = "t".repeat(EVENT_LIMITS.title);

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1, rejected: 0 });
  });

  it("rejects a page url over the limit", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId });
    event.payload.page.url = `https://example.com/${"a".repeat(EVENT_LIMITS.url)}`;

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request", details: [{ code: "invalid_event" }] },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects a page title over the limit", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId });
    event.payload.page.title = "t".repeat(EVENT_LIMITS.title + 1);

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects a custom event name over the limit", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({
      site_id: siteA1.siteId,
      event_type: "custom",
      name: "n".repeat(EVENT_LIMITS.name + 1),
    });

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects an oversized session_id", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({
      site_id: siteA1.siteId,
      session_id: "s".repeat(EVENT_LIMITS.identifier + 1),
    });

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    expect(await prisma.session.count()).toBe(0);
  });

  it("rejects properties with too many keys", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId, event_type: "custom", name: "purchase" });
    event.payload.properties = Object.fromEntries(
      Array.from({ length: EVENT_LIMITS.propertyKeys + 1 }, (_, i) => [`k${i}`, 1]),
    );

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects properties whose serialised size is over the limit", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId, event_type: "custom", name: "purchase" });
    // Few keys, one enormous value: the key count alone would not catch this.
    event.payload.properties = { blob: "x".repeat(EVENT_LIMITS.propertiesBytes) };

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    expect(await prisma.event.count()).toBe(0);
  });

  it("preserves properties that are within the limits", async () => {
    const { siteA1 } = await createOwnershipTree();
    const properties = { product_id: "123", value: 499, currency: "INR", nested: { a: [1, 2] } };
    const event = buildEvent({ site_id: siteA1.siteId, event_type: "custom", name: "purchase" });
    event.payload.properties = properties;

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(202);
    const stored = await prisma.event.findUniqueOrThrow({ where: { eventId: event.event_id } });
    expect(stored.properties).toEqual(properties);
    expect(stored.name).toBe("purchase");
  });

  it("rejects a batch with more events than the limit, and stores none of them", async () => {
    const { siteA1 } = await createOwnershipTree();
    const events = Array.from({ length: EVENT_LIMITS.batchSize + 1 }, () =>
      buildEvent({ site_id: siteA1.siteId }),
    );

    const response = await POST(ingestRequest({ events }, { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_request" } });
    // The whole batch is refused rather than truncated: reporting `accepted` for
    // a prefix would be indistinguishable from success to the SDK.
    expect(await prisma.event.count()).toBe(0);
  });

  it("accepts a batch exactly at the limit", async () => {
    const { siteA1 } = await createOwnershipTree();
    const events = Array.from({ length: EVENT_LIMITS.batchSize }, () =>
      buildEvent({ site_id: siteA1.siteId }),
    );

    const response = await POST(ingestRequest({ events }, { key: siteA1.publicKey }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: EVENT_LIMITS.batchSize });
  });

  it("rejects an oversized body with 413 before parsing it", async () => {
    const { siteA1 } = await createOwnershipTree();
    // Deliberately not valid JSON. A 413 rather than a 400 proves the body was
    // refused on size before anything tried to parse it.
    const body = `{"events":[` + "x".repeat(EVENT_LIMITS.bodyBytes);

    const response = await POST(ingestRequest(body, { key: siteA1.publicKey }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "payload_too_large" },
    });
    expect(await prisma.event.count()).toBe(0);
  });

  it("still answers 401 for an oversized body with no credential", async () => {
    await createOwnershipTree();
    const body = "x".repeat(EVENT_LIMITS.bodyBytes + 1);

    const response = await POST(ingestRequest(body));

    // Authentication runs before the body is read at all, so an anonymous
    // caller learns nothing about the size limit.
    expect(response.status).toBe(401);
  });
});
