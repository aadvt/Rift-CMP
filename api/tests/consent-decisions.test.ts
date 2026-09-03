import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import type { ConsentDecisionResponse, ConsentStateResponse } from "@rift-cmp/shared";
import { GET as getConsent, POST as recordConsent } from "@/app/api/v1/consent/route";
import { GET as getHistory } from "@/app/api/v1/consent/history/route";
import {
  createConsentFixture,
  createOwnershipTree,
  managementRequest,
  openConsentSession,
  resetDatabase,
  siteRequest,
  type OpenedConsentSession,
} from "./helpers/fixtures";

beforeEach(resetDatabase);

const PRINCIPAL = "principal-abc-123";

/**
 * The session every decision in this file is recorded through.
 *
 * Since Phase 6A the site public key alone does not authorise a write: a caller
 * must also hold a consent session bound to the principal it is deciding for.
 * Forgery, replay and cross-principal attempts are covered in
 * `consent-authenticity.test.ts`; this file stays about the decision semantics.
 */
let session: OpenedConsentSession;

async function setup() {
  const tree = await createOwnershipTree();
  const consent = await createConsentFixture(tree.orgA.organisationId);
  session = await openConsentSession(tree.siteA1.publicKey, {
    siteId: tree.siteA1.siteId,
    principalExternalId: PRINCIPAL,
  });
  return { ...tree, consent, session };
}

/** Records one decision through the site-authenticated API. */
async function decide(
  publicKey: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: ConsentDecisionResponse }> {
  const response = await recordConsent(
    siteRequest("/api/v1/consent", {
      key: publicKey,
      method: "POST",
      sessionToken: session.sessionToken,
      body: { principal_external_id: PRINCIPAL, ...body },
    }),
  );
  return { status: response.status, body: (await response.json()) as ConsentDecisionResponse };
}

async function readState(publicKey: string): Promise<ConsentStateResponse> {
  const response = await getConsent(
    siteRequest("/api/v1/consent", {
      key: publicKey,
      query: { principal_external_id: PRINCIPAL },
    }),
  );
  return (await response.json()) as ConsentStateResponse;
}

describe("recording decisions", () => {
  it("records a grant and returns the resulting effective state", async () => {
    const { siteA1, consent } = await setup();

    const { status, body } = await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
    });

    expect(status).toBe(201);
    expect(body.record).toMatchObject({
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      principal_external_id: PRINCIPAL,
      site_id: siteA1.siteId,
    });
    expect(body.effective).toEqual([
      expect.objectContaining({ purpose_code: consent.purposeCode, status: "GRANTED" }),
    ]);
  });

  it("records a denial", async () => {
    const { siteA1, consent } = await setup();
    const { body } = await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "DENIED",
    });

    expect(body.record.status).toBe("DENIED");
    expect(body.effective[0].status).toBe("DENIED");
  });

  it("records a withdrawal", async () => {
    const { siteA1, consent } = await setup();
    await decide(siteA1.publicKey, { purpose_code: consent.purposeCode, status: "GRANTED" });
    const { body } = await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "WITHDRAWN",
    });

    expect(body.record.status).toBe("WITHDRAWN");
    expect(body.effective[0].status).toBe("WITHDRAWN");
  });

  it("creates the principal on first decision and reuses it afterwards", async () => {
    const { siteA1, consent } = await setup();

    await decide(siteA1.publicKey, { purpose_code: consent.purposeCode, status: "GRANTED" });
    await decide(siteA1.publicKey, { purpose_code: consent.secondPurposeCode, status: "DENIED" });

    expect(await prisma.principal.count({ where: { siteId: siteA1.siteId } })).toBe(1);
  });

  it("rejects an unknown consent status", async () => {
    const { siteA1, consent } = await setup();
    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consent.purposeCode,
          status: "MAYBE",
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("refuses a decision dated in the future", async () => {
    const { siteA1, consent } = await setup();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consent.purposeCode,
          status: "GRANTED",
          decided_at: future,
        },
      }),
    );

    // Effective consent is "newest wins", so a future-dated grant would pin
    // itself permanently and make every later withdrawal a no-op.
    expect(response.status).toBe(400);
    expect(await prisma.consentRecord.count()).toBe(0);
  });
});

describe("decision sequences and history preservation", () => {
  it("GRANTED then WITHDRAWN leaves both records and ends withdrawn", async () => {
    const { siteA1, orgA, consent } = await setup();

    await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      decided_at: "2026-01-01T09:00:00.000Z",
    });
    await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "WITHDRAWN",
      decided_at: "2026-01-01T11:30:00.000Z",
    });

    const state = await readState(siteA1.publicKey);
    expect(state.purposes).toEqual([
      expect.objectContaining({ purpose_code: consent.purposeCode, status: "WITHDRAWN" }),
    ]);

    const history = await getHistory(
      managementRequest("/api/v1/consent/history", { key: orgA.secretKey }),
    );
    const body = (await history.json()) as { records: Array<{ status: string; decided_at: string }> };

    // Newest first, and the earlier grant is still there in full.
    expect(body.records.map((r) => r.status)).toEqual(["WITHDRAWN", "GRANTED"]);
    expect(body.records[1].decided_at).toBe("2026-01-01T09:00:00.000Z");
  });

  it("DENIED then GRANTED then WITHDRAWN keeps the whole trail", async () => {
    const { siteA1, orgA, consent } = await setup();

    const sequence = [
      { status: "DENIED", decided_at: "2026-02-01T08:00:00.000Z" },
      { status: "GRANTED", decided_at: "2026-02-01T09:00:00.000Z" },
      { status: "WITHDRAWN", decided_at: "2026-02-01T10:00:00.000Z" },
    ];
    for (const step of sequence) {
      await decide(siteA1.publicKey, { purpose_code: consent.purposeCode, ...step });
    }

    const state = await readState(siteA1.publicKey);
    expect(state.purposes[0].status).toBe("WITHDRAWN");

    const history = await getHistory(
      managementRequest("/api/v1/consent/history", { key: orgA.secretKey }),
    );
    const body = (await history.json()) as { records: Array<{ status: string }> };
    expect(body.records.map((r) => r.status)).toEqual(["WITHDRAWN", "GRANTED", "DENIED"]);
    expect(await prisma.consentRecord.count()).toBe(3);
  });

  it("keeps repeated identical decisions as separate records", async () => {
    const { siteA1, consent } = await setup();

    await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      decided_at: "2026-03-01T08:00:00.000Z",
    });
    await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      decided_at: "2026-03-01T09:00:00.000Z",
    });

    // Re-affirming consent is itself an event worth auditing, not a no-op.
    expect(await prisma.consentRecord.count()).toBe(2);
    const state = await readState(siteA1.publicKey);
    expect(state.purposes).toHaveLength(1);
    expect(state.purposes[0].status).toBe("GRANTED");
  });

  it("tracks purposes independently for the same principal", async () => {
    const { siteA1, consent } = await setup();

    await decide(siteA1.publicKey, { purpose_code: consent.purposeCode, status: "GRANTED" });
    await decide(siteA1.publicKey, { purpose_code: consent.secondPurposeCode, status: "DENIED" });

    const state = await readState(siteA1.publicKey);
    const byPurpose = Object.fromEntries(state.purposes.map((p) => [p.purpose_code, p.status]));

    expect(byPurpose[consent.purposeCode]).toBe("GRANTED");
    expect(byPurpose[consent.secondPurposeCode]).toBe("DENIED");
  });

  it("returns an empty state for a principal that has never decided", async () => {
    const { siteA1 } = await setup();
    const state = await readState(siteA1.publicKey);
    expect(state.purposes).toEqual([]);
  });

  it("refuses to rewrite a recorded decision, at the database level", async () => {
    const { siteA1, consent } = await setup();
    const { body } = await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
    });

    // There is no API that updates a consent record; this reaches past the API
    // entirely to prove the guarantee is enforced by the database.
    await expect(
      prisma.consentRecord.update({
        where: { id: body.record.consent_record_id },
        data: { status: "DENIED" },
      }),
    ).rejects.toThrow(/append-only/i);

    const stored = await prisma.consentRecord.findUniqueOrThrow({
      where: { id: body.record.consent_record_id },
    });
    expect(stored.status).toBe("GRANTED");
  });
});

describe("notice and policy version recording", () => {
  it("stores the notice and derives the policy version from it", async () => {
    const { siteA1, consent } = await setup();

    const { body } = await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      notice_id: consent.noticeId,
    });

    expect(body.record.notice_id).toBe(consent.noticeId);
    // Not supplied by the caller - taken from the notice, so the record shows
    // exactly which policy text was in force.
    expect(body.record.policy_version_id).toBe(consent.policyVersionId);
  });

  it("accepts an explicit policy version without a notice", async () => {
    const { siteA1, consent } = await setup();

    const { body } = await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      policy_version_id: consent.policyVersionId,
    });

    expect(body.record.notice_id).toBeNull();
    expect(body.record.policy_version_id).toBe(consent.policyVersionId);
  });

  it("refuses a notice that never disclosed the purpose being consented to", async () => {
    const { siteA1, consent } = await setup();

    const response = await recordConsent(
      siteRequest("/api/v1/consent", {
        key: siteA1.publicKey,
        method: "POST",
        sessionToken: session.sessionToken,
        body: {
          principal_external_id: PRINCIPAL,
          purpose_code: consent.undisclosedPurposeCode,
          status: "GRANTED",
          notice_id: consent.noticeId,
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unknown_purpose" } });
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("keeps older records pointing at the version that was in force", async () => {
    const { siteA1, orgA, consent } = await setup();

    await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "GRANTED",
      notice_id: consent.noticeId,
      decided_at: "2026-01-01T09:00:00.000Z",
    });

    // Publish a newer policy version; the historical record must not follow it.
    const newVersion = await prisma.policyVersion.create({
      data: {
        organisationId: orgA.organisationId,
        policyId: consent.policyId,
        version: "2.0.0",
      },
    });

    await decide(siteA1.publicKey, {
      purpose_code: consent.purposeCode,
      status: "WITHDRAWN",
      policy_version_id: newVersion.id,
      decided_at: "2026-01-02T09:00:00.000Z",
    });

    const history = await getHistory(
      managementRequest("/api/v1/consent/history", { key: orgA.secretKey }),
    );
    const body = (await history.json()) as {
      records: Array<{ status: string; policy_version_id: string | null }>;
    };

    expect(body.records[0]).toMatchObject({ status: "WITHDRAWN", policy_version_id: newVersion.id });
    expect(body.records[1]).toMatchObject({
      status: "GRANTED",
      policy_version_id: consent.policyVersionId,
    });
  });
});
