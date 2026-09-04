import { beforeEach, describe, expect, it } from "vitest";
import {
  listRightsRequests,
  prisma,
  recordConsentDecision,
  submitRightsRequest,
  updateRightsRequest,
} from "database";
import { proofHash, verifyProof } from "@rift-cmp/shared/consent-proof";
import { GET as listRequests, POST as submitRequest } from "@/app/api/v1/rights/requests/route";
import { PATCH as patchRequest } from "@/app/api/v1/rights/requests/[requestId]/route";
import {
  createConsentFixture,
  createOwnershipTree,
  managementRequest,
  openConsentSession,
  resetDatabase,
  siteRequest,
} from "./helpers/fixtures";

/**
 * Rights requests, consent evidence and historical integrity.
 *
 * Phase 10A's tests: historical integrity, withdrawal, rights availability by
 * jurisdiction (unit), tenant isolation, policy version linkage and audit
 * completeness. This file covers the ones that need a database.
 *
 * The property running through all of them is that a decision, once recorded,
 * is never rewritten — a withdrawal is a new row, and the receipt on the old
 * one still verifies afterwards. If that stopped being true the entire
 * evidentiary claim of the product would go with it.
 *
 * Needs Postgres.
 */

beforeEach(resetDatabase);

async function fixture() {
  const tree = await createOwnershipTree();
  const consent = await createConsentFixture(tree.orgA.organisationId);
  return { tree, consent };
}

// ─── Consent evidence and the receipt ────────────────────────────────────────

describe("consent evidence is captured and provable", () => {
  it("stores the evidence a decision was taken under", async () => {
    const { tree, consent } = await fixture();

    const result = await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      status: "GRANTED",
      noticeId: consent.noticeId,
      jurisdictions: ["EU"],
      vendors: ["Google Analytics"],
      mechanism: "banner",
      policyConfigVersion: "cfg-abc",
      source: "sdk",
    });
    expect(result.ok).toBe(true);

    const row = await prisma.consentRecord.findFirstOrThrow();
    expect(row.jurisdictions).toEqual(["EU"]);
    expect(row.vendors).toEqual(["Google Analytics"]);
    expect(row.mechanism).toBe("banner");
    expect(row.policyConfigVersion).toBe("cfg-abc");
    expect(row.proofHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("issues a receipt a principal can verify against the stored row", async () => {
    const { tree, consent } = await fixture();
    const decidedAt = new Date("2026-09-04T10:00:00.000Z");

    await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      status: "GRANTED",
      noticeId: consent.noticeId,
      decidedAt,
      jurisdictions: ["EU"],
      vendors: [],
      mechanism: "banner",
      source: "sdk",
    });

    const row = await prisma.consentRecord.findFirstOrThrow();
    const recomputed = proofHash({
      siteId: row.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      status: row.status,
      decidedAt: row.decidedAt,
      noticeId: row.noticeId,
      policyVersionId: row.policyVersionId,
      policyConfigVersion: row.policyConfigVersion,
      jurisdictions: row.jurisdictions,
      vendors: row.vendors,
      mechanism: row.mechanism,
      source: row.source,
    });

    // A principal holding the receipt can check the record they are shown is
    // the one that was issued.
    expect(recomputed).toBe(row.proofHash);
    expect(verifyProof(
      {
        siteId: row.siteId,
        principalExternalId: "p-1",
        purposeCode: consent.purposeCode,
        status: row.status,
        decidedAt: row.decidedAt,
        noticeId: row.noticeId,
        policyVersionId: row.policyVersionId,
        policyConfigVersion: row.policyConfigVersion,
        jurisdictions: row.jurisdictions,
        vendors: row.vendors,
        mechanism: row.mechanism,
        source: row.source,
      },
      row.proofHash!,
    )).toBe(true);
  });

  it("still writes a record when no evidence is supplied", async () => {
    // Every caller that predates 10A supplies none, and must keep working.
    const { tree, consent } = await fixture();
    const result = await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      status: "GRANTED",
    });
    expect(result.ok).toBe(true);

    const row = await prisma.consentRecord.findFirstOrThrow();
    expect(row.jurisdictions).toEqual([]);
    expect(row.mechanism).toBeNull();
    // A receipt is still issued: it covers whatever evidence there was.
    expect(row.proofHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ─── Historical integrity and withdrawal ─────────────────────────────────────

describe("historical integrity", () => {
  it("appends on withdrawal and leaves the earlier record intact", async () => {
    const { tree, consent } = await fixture();
    const base = {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      noticeId: consent.noticeId,
      jurisdictions: ["EU"],
      mechanism: "banner",
    };

    await recordConsentDecision(prisma, { ...base, status: "GRANTED" });
    const granted = await prisma.consentRecord.findFirstOrThrow();
    const grantedProof = granted.proofHash;

    await recordConsentDecision(prisma, { ...base, status: "WITHDRAWN" });

    const all = await prisma.consentRecord.findMany({ orderBy: { recordedAt: "asc" } });
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.status)).toEqual(["GRANTED", "WITHDRAWN"]);

    // The receipt on the earlier decision is unchanged, so a principal holding
    // it can still prove what they originally chose.
    expect(all[0].proofHash).toBe(grantedProof);
    expect(all[0].id).toBe(granted.id);
  });

  it("refuses to rewrite a decision, receipt included", async () => {
    const { tree, consent } = await fixture();
    await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      status: "GRANTED",
    });
    const row = await prisma.consentRecord.findFirstOrThrow();

    // The append-only trigger, not the receipt, is what guards the log. This
    // asserts it still holds now that there are more columns to tamper with.
    await expect(
      prisma.consentRecord.update({
        where: { id: row.id },
        data: { proofHash: "0".repeat(64) },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.consentRecord.update({
        where: { id: row.id },
        data: { jurisdictions: ["Brazil"] },
      }),
    ).rejects.toThrow();
  });

  it("links a decision to the policy version in force", async () => {
    const { tree, consent } = await fixture();
    await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "p-1",
      purposeCode: consent.purposeCode,
      status: "GRANTED",
      noticeId: consent.noticeId,
    });

    const row = await prisma.consentRecord.findFirstOrThrow();
    // The notice resolves its own policy version, so a record stands alone even
    // after the notice is superseded.
    expect(row.noticeId).toBe(consent.noticeId);
    expect(row.policyVersionId).toBe(consent.policyVersionId);
  });
});

// ─── Rights requests ─────────────────────────────────────────────────────────

describe("rights requests", () => {
  async function withPrincipal() {
    const { tree, consent } = await fixture();
    const session = await openConsentSession(tree.siteA1.publicKey, { siteId: tree.siteA1.siteId });
    await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: session.principalExternalId,
      purposeCode: consent.purposeCode,
      status: "GRANTED",
    });
    return { tree, consent, session };
  }

  it("accepts a request from the principal the session is bound to", async () => {
    const { tree, session } = await withPrincipal();

    const response = await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: session.principalExternalId,
          kind: "deletion",
          message: "Please delete my data.",
          markets: ["DE"],
        },
      }),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { request: { kind: string; status: string } };
    expect(body.request.kind).toBe("deletion");
    expect(body.request.status).toBe("received");
  });

  it("refuses a request naming somebody else's principal", async () => {
    /**
     * The forgery this endpoint exists to prevent. A deletion request filed
     * against another person's principal is more damaging than a forged consent
     * record, and a public key read from page source must not be enough.
     */
    const { tree, session } = await withPrincipal();

    const response = await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: { principal_external_id: "somebody-else", kind: "deletion" },
      }),
    );

    expect(response.status).toBe(403);
    expect(await prisma.rightsRequest.count()).toBe(0);
  });

  it("refuses a request with no consent session at all", async () => {
    const { tree, session } = await withPrincipal();
    const response = await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        body: { principal_external_id: session.principalExternalId, kind: "deletion" },
      }),
    );
    expect(response.status).toBe(401);
    expect(await prisma.rightsRequest.count()).toBe(0);
  });

  it("refuses an unknown request kind", async () => {
    const { tree, session } = await withPrincipal();
    const response = await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: { principal_external_id: session.principalExternalId, kind: "make_me_famous" },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("snapshots the rules cited when the request was made", async () => {
    const { tree, session } = await withPrincipal();
    await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: session.principalExternalId,
          kind: "access",
          markets: ["DE"],
        },
      }),
    );

    const row = await prisma.rightsRequest.findFirstOrThrow();
    // Which rules were cited when somebody asked is part of the record;
    // re-deriving it later would answer under a matrix that has since moved.
    expect(row.jurisdictions).toEqual(["EU"]);
    expect(row.ruleReferences.length).toBeGreaterThan(0);
  });

  it("accepts a request the matrix does not support, and shows that it did", async () => {
    // Refusing because no requirement was found would turn an incomplete
    // research artifact into a reason to deny somebody a request.
    const { tree, session } = await withPrincipal();
    const response = await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: session.principalExternalId,
          kind: "opt_out_sale",
          markets: ["BR"],
        },
      }),
    );

    expect(response.status).toBe(201);
    const row = await prisma.rightsRequest.findFirstOrThrow();
    expect(row.ruleReferences).toEqual([]);
  });

  it("never echoes a contact detail back on the browser plane", async () => {
    const { tree, session } = await withPrincipal();
    const response = await submitRequest(
      siteRequest("/api/v1/rights/requests", {
        key: tree.siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: session.principalExternalId,
          kind: "access",
          contact: "someone@example.com",
        },
      }),
    );
    const text = await response.text();
    expect(text).not.toContain("someone@example.com");
  });
});

// ─── The operator's queue ────────────────────────────────────────────────────

describe("the operator's queue", () => {
  async function withRequest() {
    const { tree } = await fixture();
    const session = await openConsentSession(tree.siteA1.publicKey, { siteId: tree.siteA1.siteId });
    const submitted = await submitRightsRequest(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: session.principalExternalId,
      kind: "access",
      jurisdictions: ["EU"],
      ruleReferences: ["REQ-GDPR-007"],
      contact: "someone@example.com",
    });
    if (!submitted.ok) throw new Error("fixture failed");
    return { tree, request: submitted.request };
  }

  it("lists requests with the contact detail the operator needs", async () => {
    const { tree } = await withRequest();
    const response = await listRequests(
      managementRequest("/api/v1/rights/requests", { key: tree.orgA.secretKey }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { requests: Array<{ contact: string | null }> };
    expect(body.requests).toHaveLength(1);
    expect(body.requests[0].contact).toBe("someone@example.com");
  });

  it("moves a request along and stamps when it was answered", async () => {
    const { tree, request } = await withRequest();
    const response = await patchRequest(
      managementRequest(`/api/v1/rights/requests/${request.request_id}`, {
        key: tree.orgA.secretKey,
        method: "PATCH",
        body: { status: "completed", resolution_note: "Exported and sent." },
      }),
      { params: Promise.resolve({ requestId: request.request_id }) },
    );

    expect(response.status).toBe(200);
    const row = await prisma.rightsRequest.findFirstOrThrow();
    expect(row.status).toBe("completed");
    expect(row.resolutionNote).toBe("Exported and sent.");
    expect(row.respondedAt).not.toBeNull();
  });

  it("does not let handling rewrite what was asked", async () => {
    const { tree, request } = await withRequest();
    await patchRequest(
      managementRequest(`/api/v1/rights/requests/${request.request_id}`, {
        key: tree.orgA.secretKey,
        method: "PATCH",
        body: { status: "refused", kind: "complaint" },
      }),
      { params: Promise.resolve({ requestId: request.request_id }) },
    );
    // `kind` is not in the schema, so a strict body rejects it outright.
    const row = await prisma.rightsRequest.findFirstOrThrow();
    expect(row.kind).toBe("access");
  });
});

// ─── Tenant isolation ────────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("hides another organisation's requests from a list", async () => {
    const { tree } = await fixture();
    const session = await openConsentSession(tree.siteA1.publicKey, { siteId: tree.siteA1.siteId });
    await submitRightsRequest(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: session.principalExternalId,
      kind: "access",
      jurisdictions: [],
      ruleReferences: [],
    });

    const theirs = await listRightsRequests(prisma, tree.orgB.organisationId);
    expect(theirs).toEqual([]);
  });

  it("refuses to update another organisation's request", async () => {
    const { tree } = await fixture();
    const session = await openConsentSession(tree.siteA1.publicKey, { siteId: tree.siteA1.siteId });
    const submitted = await submitRightsRequest(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: session.principalExternalId,
      kind: "deletion",
      jurisdictions: [],
      ruleReferences: [],
    });
    if (!submitted.ok) throw new Error("fixture failed");

    const result = await updateRightsRequest(prisma, {
      organisationId: tree.orgB.organisationId,
      requestId: submitted.request.request_id,
      status: "completed",
    });
    expect(result.ok).toBe(false);

    const row = await prisma.rightsRequest.findFirstOrThrow();
    expect(row.status).toBe("received");
  });

  it("hides another organisation's request behind a 404 over HTTP", async () => {
    const { tree } = await fixture();
    const session = await openConsentSession(tree.siteA1.publicKey, { siteId: tree.siteA1.siteId });
    const submitted = await submitRightsRequest(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: session.principalExternalId,
      kind: "deletion",
      jurisdictions: [],
      ruleReferences: [],
    });
    if (!submitted.ok) throw new Error("fixture failed");

    const response = await patchRequest(
      managementRequest(`/api/v1/rights/requests/${submitted.request.request_id}`, {
        key: tree.orgB.secretKey,
        method: "PATCH",
        body: { status: "completed" },
      }),
      { params: Promise.resolve({ requestId: submitted.request.request_id }) },
    );
    expect(response.status).toBe(404);
  });

  it("cannot attach a request to a principal from another site", async () => {
    // The composite foreign key makes it unrepresentable rather than validated.
    const { tree } = await fixture();
    const session = await openConsentSession(tree.siteA1.publicKey, { siteId: tree.siteA1.siteId });

    const result = await submitRightsRequest(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA2.siteId,
      principalExternalId: session.principalExternalId,
      kind: "access",
      jurisdictions: [],
      ruleReferences: [],
    });
    expect(result.ok).toBe(false);
  });
});

// ─── Retention metadata ──────────────────────────────────────────────────────

describe("retention metadata is the operator's, never invented", () => {
  it("defaults to null rather than to a period nobody stated", async () => {
    const { tree } = await fixture();
    const purpose = await prisma.purpose.findFirstOrThrow({
      where: { organisationId: tree.orgA.organisationId },
    });
    expect(purpose.retentionNote).toBeNull();
    expect(purpose.retentionPeriod).toBeNull();
  });

  it("stores what the operator writes, unparsed", async () => {
    const { tree } = await fixture();
    const purpose = await prisma.purpose.findFirstOrThrow({
      where: { organisationId: tree.orgA.organisationId },
    });
    await prisma.purpose.update({
      where: { id: purpose.id },
      data: { retentionNote: "Kept for two years after last activity.", retentionPeriod: "P2Y" },
    });
    const updated = await prisma.purpose.findUniqueOrThrow({ where: { id: purpose.id } });
    expect(updated.retentionNote).toBe("Kept for two years after last activity.");
    // Never derived from the prose: a parser inferring a period would be
    // inventing the number this field exists to avoid inventing.
    expect(updated.retentionPeriod).toBe("P2Y");
  });
});
