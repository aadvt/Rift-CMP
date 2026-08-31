import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { GET as getOrganisation } from "@/app/api/v1/organisation/route";
import { GET as listSites, POST as createSite } from "@/app/api/v1/sites/route";
import { GET as getSite, PATCH as patchSite } from "@/app/api/v1/sites/[siteId]/route";
import { createOwnershipTree, managementRequest, resetDatabase, siteParams } from "./helpers/fixtures";

beforeEach(resetDatabase);

describe("management authentication", () => {
  it("identifies the organisation behind a secret key", async () => {
    const { orgA } = await createOwnershipTree();
    const response = await getOrganisation(managementRequest("/api/v1/organisation", { key: orgA.secretKey }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      organisation_id: orgA.organisationId,
      slug: "org-a",
    });
  });

  it("never leaks key material", async () => {
    const { orgA } = await createOwnershipTree();
    const response = await getOrganisation(managementRequest("/api/v1/organisation", { key: orgA.secretKey }));
    const body = JSON.stringify(await response.json());

    expect(body).not.toContain(orgA.secretKey);
    expect(body).not.toContain("secret_key_hash");
    expect(body).not.toContain("secretKeyHash");
  });

  it("rejects a request with no credential", async () => {
    await createOwnershipTree();
    expect((await listSites(managementRequest("/api/v1/sites"))).status).toBe(401);
  });

  it("rejects a site public key used on the management plane", async () => {
    const { siteA1 } = await createOwnershipTree();
    const response = await listSites(managementRequest("/api/v1/sites", { key: siteA1.publicKey }));

    expect(response.status).toBe(401);
  });

  it("rejects an unknown secret key", async () => {
    await createOwnershipTree();
    const response = await listSites(managementRequest("/api/v1/sites", { key: `sk_${"0".repeat(64)}` }));

    expect(response.status).toBe(401);
  });

  it("sends no wildcard CORS headers on the management plane", async () => {
    const { orgA } = await createOwnershipTree();
    const response = await listSites(managementRequest("/api/v1/sites", { key: orgA.secretKey }));

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("cross-tenant read access", () => {
  it("lists only the authenticated organisation's sites", async () => {
    const { orgA, siteA1, siteA2, siteB1 } = await createOwnershipTree();
    const response = await listSites(managementRequest("/api/v1/sites", { key: orgA.secretKey }));

    const body = (await response.json()) as { sites: Array<{ site_id: string }> };
    const ids = body.sites.map((site) => site.site_id).sort();

    expect(ids).toEqual([siteA1.siteId, siteA2.siteId].sort());
    expect(ids).not.toContain(siteB1.siteId);
  });

  it("hides another organisation's site behind a 404", async () => {
    const { orgA, siteB1 } = await createOwnershipTree();
    const response = await getSite(
      managementRequest(`/api/v1/sites/${siteB1.siteId}`, { key: orgA.secretKey }),
      siteParams(siteB1.siteId),
    );

    // 404 rather than 403: replying "forbidden" would confirm the site exists.
    expect(response.status).toBe(404);
  });

  it("allows an organisation to read its own site", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const response = await getSite(
      managementRequest(`/api/v1/sites/${siteA1.siteId}`, { key: orgA.secretKey }),
      siteParams(siteA1.siteId),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      site_id: siteA1.siteId,
      organisation_id: orgA.organisationId,
    });
  });
});

describe("cross-tenant configuration changes", () => {
  it("refuses to modify another organisation's site and leaves it unchanged", async () => {
    const { orgA, siteB1 } = await createOwnershipTree();
    const before = await prisma.website.findUniqueOrThrow({ where: { id: siteB1.siteId } });

    const response = await patchSite(
      managementRequest(`/api/v1/sites/${siteB1.siteId}`, {
        key: orgA.secretKey,
        method: "PATCH",
        body: { name: "Owned by A now", is_active: false },
      }),
      siteParams(siteB1.siteId),
    );

    expect(response.status).toBe(404);

    const after = await prisma.website.findUniqueOrThrow({ where: { id: siteB1.siteId } });
    expect(after.name).toBe(before.name);
    expect(after.isActive).toBe(true);
  });

  it("allows an organisation to modify its own site", async () => {
    const { orgA, siteA1 } = await createOwnershipTree();
    const response = await patchSite(
      managementRequest(`/api/v1/sites/${siteA1.siteId}`, {
        key: orgA.secretKey,
        method: "PATCH",
        body: { name: "Renamed", is_active: false },
      }),
      siteParams(siteA1.siteId),
    );

    expect(response.status).toBe(200);
    const after = await prisma.website.findUniqueOrThrow({ where: { id: siteA1.siteId } });
    expect(after.name).toBe("Renamed");
    expect(after.isActive).toBe(false);
  });

  it("refuses attempts to reassign ownership or overwrite key material", async () => {
    const { orgA, orgB, siteA1 } = await createOwnershipTree();

    for (const body of [
      { organisation_id: orgB.organisationId },
      { public_key: "pk_attacker_controlled" },
      { site_id: "site_something_else" },
    ]) {
      const response = await patchSite(
        managementRequest(`/api/v1/sites/${siteA1.siteId}`, {
          key: orgA.secretKey,
          method: "PATCH",
          body,
        }),
        siteParams(siteA1.siteId),
      );

      expect(response.status).toBe(400);
    }

    const after = await prisma.website.findUniqueOrThrow({ where: { id: siteA1.siteId } });
    expect(after.organisationId).toBe(orgA.organisationId);
    expect(after.publicKey).toBe(siteA1.publicKey);
  });
});

describe("site creation", () => {
  it("creates sites owned by the authenticated organisation", async () => {
    const { orgA } = await createOwnershipTree();
    const response = await createSite(
      managementRequest("/api/v1/sites", {
        key: orgA.secretKey,
        method: "POST",
        body: { name: "Site A3", domain: "a3.example.com" },
      }),
    );

    expect(response.status).toBe(201);
    const created = (await response.json()) as { site_id: string; public_key: string };
    expect(created.public_key).toMatch(/^pk_/);

    const stored = await prisma.website.findUniqueOrThrow({ where: { id: created.site_id } });
    expect(stored.organisationId).toBe(orgA.organisationId);
  });

  it("ignores an attempt to create a site under another organisation", async () => {
    const { orgA, orgB } = await createOwnershipTree();
    const response = await createSite(
      managementRequest("/api/v1/sites", {
        key: orgA.secretKey,
        method: "POST",
        body: { name: "Trojan", domain: "trojan.example.com", organisation_id: orgB.organisationId },
      }),
    );

    // `.strict()` turns the smuggled field into a validation error rather than
    // silently dropping it, so the caller is told the request was wrong.
    expect(response.status).toBe(400);
    expect(await prisma.website.count({ where: { organisationId: orgB.organisationId } })).toBe(1);
  });
});
