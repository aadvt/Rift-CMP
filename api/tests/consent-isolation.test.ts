import { beforeEach, describe, expect, it } from "vitest";
import { createPurpose, prisma, recordConsentDecision } from "database";
import type { ConsentStateResponse } from "@rift-cmp/shared";
import { GET as getConsent, POST as recordConsent } from "@/app/api/v1/consent/route";
import { GET as getHistory } from "@/app/api/v1/consent/history/route";
import { GET as listPurposes } from "@/app/api/v1/purposes/route";
import { GET as listNotices } from "@/app/api/v1/notices/route";
import {
  createConsentFixture,
  createOwnershipTree,
  managementRequest,
  openConsentSession,
  resetDatabase,
  siteRequest,
} from "./helpers/fixtures";

beforeEach(resetDatabase);

const PRINCIPAL = "shared-principal-id";

/**
 * A consent session per site, for the same external id.
 *
 * They are separate sessions because they are separate principals: the same
 * `external_id` on two sites is two people as far as this system is concerned,
 * and a session minted on one site is refused on the other. That refusal is
 * asserted directly in `consent-authenticity.test.ts`.
 */
let sessionA1: string;
let sessionB1: string;

/** Both organisations get their own reference data, with distinct purpose codes. */
async function setupBothTenants() {
  const tree = await createOwnershipTree();
  const consentA = await createConsentFixture(tree.orgA.organisationId);
  const consentB = await createConsentFixture(tree.orgB.organisationId, "b-");

  sessionA1 = (
    await openConsentSession(tree.siteA1.publicKey, {
      siteId: tree.siteA1.siteId,
      principalExternalId: PRINCIPAL,
    })
  ).sessionToken;
  sessionB1 = (
    await openConsentSession(tree.siteB1.publicKey, {
      siteId: tree.siteB1.siteId,
      principalExternalId: PRINCIPAL,
    })
  ).sessionToken;

  return { ...tree, consentA, consentB };
}

describe("consent authentication", () => {
  it("rejects an unauthenticated decision", async () => {
    const { consentA } = await setupBothTenants();
    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        method: "POST",
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("rejects an organisation secret key on the browser consent plane", async () => {
    const { orgA, consentA } = await setupBothTenants();
    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: orgA.secretKey,
        method: "POST",
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
        },
      }),
    );

    expect(response.status).toBe(401);
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("rejects an unknown public key", async () => {
    const { consentA } = await setupBothTenants();
    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: "pk_not_a_real_key",
        method: "POST",
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
        },
      }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects decisions for an inactive site", async () => {
    const { siteA1, consentA } = await setupBothTenants();
    await prisma.website.update({ where: { id: siteA1.siteId }, data: { isActive: false } });

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
        },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("rejects a site public key on the audit-trail endpoint", async () => {
    const { siteA1 } = await setupBothTenants();
    const response = await getHistory(
      managementRequest("/api/v1/consent/history", { key: siteA1.publicKey }),
    );

    // The audit trail spans principals, so it needs the organisation secret -
    // a public key is visible to anyone who views the page source.
    expect(response.status).toBe(401);
  });

  it("rejects a site public key on the consent reference-data endpoints", async () => {
    const { siteA1 } = await setupBothTenants();

    for (const handler of [listPurposes, listNotices]) {
      const response = await handler(managementRequest("/api/v1/purposes", { key: siteA1.publicKey }));
      expect(response.status).toBe(401);
    }
  });
});

describe("cross-tenant reference data", () => {
  it("cannot record consent against another organisation's purpose", async () => {
    const { siteA1, consentB } = await setupBothTenants();

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentB.purposeCode,
          status: "GRANTED",
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unknown_purpose" } });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("cannot cite another organisation's notice", async () => {
    const { siteA1, consentA, consentB } = await setupBothTenants();

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
          notice_id: consentB.noticeId,
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unknown_notice" } });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("cannot cite another organisation's policy version", async () => {
    const { siteA1, consentA, consentB } = await setupBothTenants();

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
          policy_version_id: consentB.policyVersionId,
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unknown_policy" } });
  });

  it("resolves a shared purpose code to the caller's own purpose", async () => {
    const { orgA, orgB, siteA1, siteB1 } = await setupBothTenants();

    // Both tenants independently define a purpose called "newsletter".
    const purposeA = await createPurpose(prisma, {
      organisationId: orgA.organisationId,
      code: "newsletter",
      name: "Newsletter",
      description: "A's newsletter.",
    });
    const purposeB = await createPurpose(prisma, {
      organisationId: orgB.organisationId,
      code: "newsletter",
      name: "Newsletter",
      description: "B's newsletter.",
    });

    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: { principal_external_id: PRINCIPAL, purpose_code: "newsletter", status: "GRANTED" },
      }),
    );
    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteB1.publicKey,
        method: "POST",
        sessionToken: sessionB1,
        body: { principal_external_id: PRINCIPAL, purpose_code: "newsletter", status: "DENIED" },
      }),
    );

    const recordA = await prisma.consentRecord.findFirstOrThrow({
      where: { organisationId: orgA.organisationId },
    });
    const recordB = await prisma.consentRecord.findFirstOrThrow({
      where: { organisationId: orgB.organisationId },
    });

    expect(recordA.purposeId).toBe(purposeA.purpose_id);
    expect(recordB.purposeId).toBe(purposeB.purpose_id);
    expect(recordA.status).toBe("GRANTED");
    expect(recordB.status).toBe("DENIED");
  });

  it("refuses a decision body that tries to name its own tenant", async () => {
    const { siteA1, siteB1, consentA } = await setupBothTenants();

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
          site_id: siteB1.siteId,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.consentRecord.count()).toBe(0);
  });
});

describe("principal and record isolation", () => {
  it("keeps the same external id as separate principals on separate sites", async () => {
    const { siteA1, siteB1, consentA, consentB } = await setupBothTenants();

    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
        },
      }),
    );
    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteB1.publicKey,
        method: "POST",
        sessionToken: sessionB1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentB.purposeCode,
          status: "DENIED",
        },
      }),
    );

    const principals = await prisma.principal.findMany({ where: { externalId: PRINCIPAL } });
    expect(principals).toHaveLength(2);
    expect(new Set(principals.map((p) => p.siteId))).toEqual(
      new Set([siteA1.siteId, siteB1.siteId]),
    );
  });

  it("does not leak another site's decisions through the state endpoint", async () => {
    const { siteA1, siteB1, consentB } = await setupBothTenants();

    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteB1.publicKey,
        method: "POST",
        sessionToken: sessionB1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentB.purposeCode,
          status: "GRANTED",
        },
      }),
    );

    // Site A1 asks about the very same external id.
    const response = await getConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        query: { principal_external_id: PRINCIPAL },
      }),
    );
    const state = (await response.json()) as ConsentStateResponse;

    expect(response.status).toBe(200);
    expect(state.purposes).toEqual([]);
  });

  it("does not leak a sibling site's decisions within the same organisation", async () => {
    const { orgA, siteA1, siteA2, consentA } = await setupBothTenants();

    await recordConsentDecision(prisma, {
      organisationId: orgA.organisationId,
      siteId: siteA2.siteId,
      principalExternalId: PRINCIPAL,
      purposeCode: consentA.purposeCode,
      status: "GRANTED",
    });

    const response = await getConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        query: { principal_external_id: PRINCIPAL },
      }),
    );
    const state = (await response.json()) as ConsentStateResponse;

    // A public key authorises one site, not the whole organisation.
    expect(state.purposes).toEqual([]);
  });
});

describe("audit trail isolation", () => {
  it("shows an organisation only its own records", async () => {
    const { orgA, orgB, siteA1, siteB1, consentA, consentB } = await setupBothTenants();

    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: sessionA1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentA.purposeCode,
          status: "GRANTED",
        },
      }),
    );
    await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteB1.publicKey,
        method: "POST",
        sessionToken: sessionB1,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consentB.purposeCode,
          status: "DENIED",
        },
      }),
    );

    const historyA = await getHistory(
      managementRequest("/api/v1/consent/history", { key: orgA.secretKey }),
    );
    const bodyA = (await historyA.json()) as {
      records: Array<{ site_id: string; purpose_code: string }>;
    };

    expect(bodyA.records).toHaveLength(1);
    expect(bodyA.records[0]).toMatchObject({
      site_id: siteA1.siteId,
      purpose_code: consentA.purposeCode,
    });

    const historyB = await getHistory(
      managementRequest("/api/v1/consent/history", { key: orgB.secretKey }),
    );
    const bodyB = (await historyB.json()) as { records: Array<{ site_id: string }> };
    expect(bodyB.records).toHaveLength(1);
    expect(bodyB.records[0].site_id).toBe(siteB1.siteId);
  });

  it("returns 404 when filtering the audit trail by another tenant's site", async () => {
    const { orgA, siteB1 } = await setupBothTenants();

    const response = await getHistory(
      managementRequest("/api/v1/consent/history", {
        key: orgA.secretKey,
        query: { site_id: siteB1.siteId },
      }),
    );

    expect(response.status).toBe(404);
  });

  it("lists only the caller's own purposes", async () => {
    const { orgA, consentA, consentB } = await setupBothTenants();

    const response = await listPurposes(managementRequest("/api/v1/purposes", { key: orgA.secretKey }));
    const body = (await response.json()) as { purposes: Array<{ code: string }> };
    const codes = body.purposes.map((p) => p.code);

    expect(codes).toContain(consentA.purposeCode);
    expect(codes).not.toContain(consentB.purposeCode);
  });

  it("rejects an out-of-range limit rather than silently clamping", async () => {
    const { orgA } = await setupBothTenants();

    const response = await getHistory(
      managementRequest("/api/v1/consent/history", {
        key: orgA.secretKey,
        query: { limit: "999999" },
      }),
    );

    expect(response.status).toBe(400);
  });
});
