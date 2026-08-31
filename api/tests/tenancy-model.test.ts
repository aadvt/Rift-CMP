import { beforeEach, describe, expect, it } from "vitest";
import { createOrganisation, createWebsite, hashSecretKey, prisma } from "database";
import { createOwnershipTree, resetDatabase } from "./helpers/fixtures";

beforeEach(resetDatabase);

describe("organisation creation and ownership", () => {
  it("creates an organisation and returns a secret key that is never stored in plaintext", async () => {
    const created = await createOrganisation(prisma, { name: "Acme", slug: "acme" });

    expect(created.secret_key).toMatch(/^sk_/);

    const stored = await prisma.organisation.findUniqueOrThrow({
      where: { id: created.organisation_id },
    });
    expect(stored.secretKeyHash).toBe(hashSecretKey(created.secret_key));
    expect(JSON.stringify(stored)).not.toContain(created.secret_key);
  });

  it("enforces unique organisation slugs", async () => {
    await createOrganisation(prisma, { name: "Acme", slug: "acme" });
    await expect(createOrganisation(prisma, { name: "Other", slug: "acme" })).rejects.toThrow();
  });

  it("gives every organisation a distinct secret", async () => {
    const a = await createOrganisation(prisma, { name: "A", slug: "a" });
    const b = await createOrganisation(prisma, { name: "B", slug: "b" });
    expect(a.secret_key).not.toBe(b.secret_key);
  });
});

describe("website ownership", () => {
  it("builds the required two-level ownership tree", async () => {
    const { orgA, orgB, siteA1, siteA2, siteB1 } = await createOwnershipTree();

    const ownedByA = await prisma.website.findMany({
      where: { organisationId: orgA.organisationId },
      select: { id: true },
    });
    const ownedByB = await prisma.website.findMany({
      where: { organisationId: orgB.organisationId },
      select: { id: true },
    });

    expect(ownedByA.map((w) => w.id).sort()).toEqual([siteA1.siteId, siteA2.siteId].sort());
    expect(ownedByB.map((w) => w.id)).toEqual([siteB1.siteId]);
  });

  it("mints a distinct public key per site", async () => {
    const { siteA1, siteA2, siteB1 } = await createOwnershipTree();
    const keys = new Set([siteA1.publicKey, siteA2.publicKey, siteB1.publicKey]);
    expect(keys.size).toBe(3);
  });

  it("refuses a website with no owning organisation", async () => {
    await expect(
      createWebsite(prisma, {
        organisationId: "org_does_not_exist",
        name: "Orphan",
        domain: "orphan.example.com",
      }),
    ).rejects.toThrow();
  });

  it("enforces unique public keys across organisations", async () => {
    const { orgB, siteA1 } = await createOwnershipTree();
    await expect(
      prisma.website.create({
        data: {
          organisationId: orgB.organisationId,
          name: "Impostor",
          domain: "impostor.example.com",
          publicKey: siteA1.publicKey,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("database relationship constraints", () => {
  it("refuses an event whose session belongs to a different site", async () => {
    const { siteA1, siteB1 } = await createOwnershipTree();

    const sessionOfB = await prisma.session.create({
      data: { id: "session-owned-by-b", siteId: siteB1.siteId, lastActivity: new Date() },
    });

    // The composite (session_id, site_id) foreign key makes this impossible even
    // if application-level checks were bypassed entirely.
    await expect(
      prisma.event.create({
        data: {
          eventId: "11111111-1111-4111-8111-111111111111",
          siteId: siteA1.siteId,
          sessionId: sessionOfB.id,
          eventType: "page_view",
          eventTime: new Date(),
          pageUrl: "https://a1.example.com",
          pageTitle: "A1",
          deviceType: "desktop",
          browser: "Chrome",
          os: "Windows",
        },
      }),
    ).rejects.toThrow();
  });

  it("refuses a session pointing at a nonexistent site", async () => {
    await expect(
      prisma.session.create({
        data: { id: "ghost", siteId: "site_does_not_exist", lastActivity: new Date() },
      }),
    ).rejects.toThrow();
  });

  it("enforces a unique event_id", async () => {
    const { siteA1 } = await createOwnershipTree();
    await prisma.session.create({
      data: { id: "s1", siteId: siteA1.siteId, lastActivity: new Date() },
    });

    const row = {
      eventId: "22222222-2222-4222-8222-222222222222",
      siteId: siteA1.siteId,
      sessionId: "s1",
      eventType: "page_view",
      eventTime: new Date(),
      pageUrl: "https://a1.example.com",
      pageTitle: "A1",
      deviceType: "desktop",
      browser: "Chrome",
      os: "Windows",
    };

    await prisma.event.create({ data: row });
    await expect(prisma.event.create({ data: { ...row, id: "other" } })).rejects.toThrow();
  });

  it("cascades deletion of an organisation down to its sessions and events", async () => {
    const { orgA, siteA1, siteB1 } = await createOwnershipTree();

    for (const siteId of [siteA1.siteId, siteB1.siteId]) {
      await prisma.session.create({
        data: { id: `session-${siteId}`, siteId, lastActivity: new Date() },
      });
      await prisma.event.create({
        data: {
          eventId: `event-${siteId}`,
          siteId,
          sessionId: `session-${siteId}`,
          eventType: "page_view",
          eventTime: new Date(),
          pageUrl: "https://example.com",
          pageTitle: "Example",
          deviceType: "desktop",
          browser: "Chrome",
          os: "Windows",
        },
      });
    }

    await prisma.organisation.delete({ where: { id: orgA.organisationId } });

    expect(await prisma.website.count({ where: { organisationId: orgA.organisationId } })).toBe(0);
    expect(await prisma.session.count({ where: { siteId: siteA1.siteId } })).toBe(0);
    expect(await prisma.event.count({ where: { siteId: siteA1.siteId } })).toBe(0);

    // Organisation B is untouched.
    expect(await prisma.session.count({ where: { siteId: siteB1.siteId } })).toBe(1);
    expect(await prisma.event.count({ where: { siteId: siteB1.siteId } })).toBe(1);
  });
});
