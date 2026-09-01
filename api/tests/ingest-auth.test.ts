import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { POST } from "@/app/api/v1/events/route";
import { buildEvent, createOwnershipTree, ingestRequest, resetDatabase } from "./helpers/fixtures";

beforeEach(resetDatabase);

describe("ingestion authentication", () => {
  it("accepts a batch signed with the site's public key", async () => {
    const { siteA1 } = await createOwnershipTree();
    const event = buildEvent({ site_id: siteA1.siteId });

    const response = await POST(ingestRequest({ events: [event] }, { key: siteA1.publicKey }));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ accepted: 1, rejected: 0 });
    expect(await prisma.event.count({ where: { siteId: siteA1.siteId } })).toBe(1);
  });

  it("rejects a request with no credential", async () => {
    const { siteA1 } = await createOwnershipTree();
    const response = await POST(ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }));

    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects an unknown public key", async () => {
    const { siteA1 } = await createOwnershipTree();
    const response = await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: "pk_not_a_real_key" }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects an organisation secret key used on the ingestion plane", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const response = await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: orgA.secretKey }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });

  it("rejects events for an inactive site with 403", async () => {
    const { siteA1 } = await createOwnershipTree();
    await prisma.website.update({ where: { id: siteA1.siteId }, data: { isActive: false } });

    const response = await POST(
      ingestRequest({ events: [buildEvent({ site_id: siteA1.siteId })] }, { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "forbidden" } });
    expect(await prisma.event.count()).toBe(0);
  });

  it("refuses a credential passed in the URL instead of a header", async () => {
    const { siteA1 } = await createOwnershipTree();

    // The SDK flushes with `fetch(..., { keepalive: true })`, which supports
    // headers even during unload, so nothing needs a credential in the query
    // string - where it would leak into access logs and browser history.
    const response = await POST(
      ingestRequest(
        { events: [buildEvent({ site_id: siteA1.siteId })] },
        { queryKey: siteA1.publicKey },
      ),
    );

    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });

  it("authenticates before parsing the body, so bad JSON from an anonymous caller is still 401", async () => {
    await createOwnershipTree();
    const response = await POST(ingestRequest("{not json", {}));
    expect(response.status).toBe(401);
  });

  it("returns 400 for malformed JSON from an authenticated caller", async () => {
    const { siteA1 } = await createOwnershipTree();
    const response = await POST(ingestRequest("{not json", { key: siteA1.publicKey }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_json" } });
  });

  it("returns 400 when every event fails schema validation", async () => {
    const { siteA1 } = await createOwnershipTree();
    const response = await POST(
      ingestRequest({ events: [{ event_id: "not-a-uuid" }] }, { key: siteA1.publicKey }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.event.count()).toBe(0);
  });
});
