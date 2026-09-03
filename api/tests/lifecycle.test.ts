import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import type {
  AuditResponse,
  AuthorisationDecisionResponse,
  TransferAuthorisationSummary,
  TransferDelivery,
  TransferRecordSummary,
} from "@rift-cmp/shared";
import { POST as authorise } from "@/app/api/v1/authorisations/route";
import { POST as decide } from "@/app/api/v1/authorisations/decision/route";
import { GET as getAudit } from "@/app/api/v1/audit/route";
import { POST as submitTransfer } from "@/app/api/v1/transfers/route";
import { GET as collectEnvelope } from "@/app/api/v1/transfers/[transferId]/envelope/route";
import { POST as recordConsentRoute } from "@/app/api/v1/consent/route";
import {
  createTransferScenario,
  managementRequest,
  openConsentSession,
  resetDatabase,
  siteRequest,
  type TransferScenario,
} from "./helpers/fixtures";
import { sealForAuthorisation, submissionBody } from "./helpers/fiduciaries";

/**
 * Withdraws consent through the real browser-facing route.
 *
 * Since Phase 6A that route needs a consent session as well as the site public
 * key, so the withdrawal is preceded by opening one for this principal. That is
 * exactly what a preference centre does, and going through it rather than
 * writing the row directly keeps this file testing the lifecycle instead of a
 * shortcut around it.
 */
async function withdrawConsent(scenario: TransferScenario): Promise<void> {
  const session = await openConsentSession(scenario.siteA1.publicKey, {
    siteId: scenario.siteA1.siteId,
    principalExternalId: scenario.principalExternalId,
  });

  const response = await recordConsentRoute(
    siteRequest("/api/v1/consent", {
      key: scenario.siteA1.publicKey,
      method: "POST",
      sessionToken: session.sessionToken,
      body: {
        principal_external_id: scenario.principalExternalId,
        purpose_code: scenario.consent.purposeCode,
        status: "WITHDRAWN",
      },
    }),
  );
  if (response.status !== 201) {
    throw new Error(`withdrawConsent failed: ${response.status} ${await response.text()}`);
  }
}


/**
 * The product flow end to end:
 *
 *   consent -> authorisation -> secure transfer -> audit record
 *
 * and the refusals at each point where a condition is not satisfied. These
 * exercise the API surface a fiduciary actually integrates against, not the
 * service functions underneath it.
 */

beforeEach(resetDatabase);

const PII = "PAN: ABCDE1234F; Salary: 1,250,000 INR";

function transferParams(transferId: string) {
  return { params: Promise.resolve({ transferId }) };
}

/** Ask whether an action is permitted, without creating anything. */
async function askDecision(
  scenario: TransferScenario,
  overrides: Record<string, unknown> = {},
): Promise<{ status: number; body: AuthorisationDecisionResponse }> {
  const response = await decide(
    managementRequest("/api/v1/authorisations/decision", {
      key: scenario.orgA.secretKey,
      method: "POST",
      body: {
        site_id: scenario.siteA1.siteId,
        principal_external_id: scenario.principalExternalId,
        purpose_code: scenario.consent.purposeCode,
        ...overrides,
      },
    }),
  );
  return { status: response.status, body: (await response.json()) as AuthorisationDecisionResponse };
}

/** Request an authorisation. */
async function requestAuthorisation(
  scenario: TransferScenario,
  overrides: Record<string, unknown> = {},
  key = scenario.orgA.secretKey,
) {
  return authorise(
    managementRequest("/api/v1/authorisations", {
      key,
      method: "POST",
      body: {
        site_id: scenario.siteA1.siteId,
        principal_external_id: scenario.principalExternalId,
        purpose_code: scenario.consent.purposeCode,
        recipient_code: scenario.recipientCode,
        ...overrides,
      },
    }),
  );
}

/** The whole happy path, returning everything the assertions need. */
async function runFullFlow(scenario: TransferScenario, plaintext = PII) {
  const authResponse = await requestAuthorisation(scenario);
  const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;
  const envelope = sealForAuthorisation(authorisation, plaintext);

  const submitted = await submitTransfer(
    managementRequest("/api/v1/transfers", {
      key: scenario.orgA.secretKey,
      method: "POST",
      body: submissionBody(authorisation, envelope),
    }),
  );
  const transfer = (await submitted.json()) as TransferRecordSummary;

  return { authResponse, authorisation, envelope, submitted, transfer };
}

async function readAudit(scenario: TransferScenario): Promise<AuditResponse> {
  const response = await getAudit(
    managementRequest("/api/v1/audit", {
      key: scenario.orgA.secretKey,
      query: { principal_external_id: scenario.principalExternalId },
    }),
  );
  return (await response.json()) as AuditResponse;
}

// --- Scenario A ---------------------------------------------------------------

describe("Scenario A - no consent", () => {
  it("refuses the request and creates no authorisation or transfer", async () => {
    const scenario = await createTransferScenario({ consent: "none" });

    const decision = await askDecision(scenario);
    expect(decision.body.permitted).toBe(false);
    expect(decision.body.reason).toBe("principal_not_found");

    const response = await requestAuthorisation(scenario);
    expect(response.status).toBe(404);

    expect(await prisma.transferAuthorisation.count()).toBe(0);
    expect(await prisma.transferRecord.count()).toBe(0);
  });

  it("distinguishes a known principal who has decided nothing for this purpose", async () => {
    const scenario = await createTransferScenario();

    // The principal exists and consented to one purpose, but not this one.
    const decision = await askDecision(scenario, {
      purpose_code: scenario.consent.secondPurposeCode,
    });

    expect(decision.body.permitted).toBe(false);
    expect(decision.body.reason).toBe("no_consent_decision");
    expect(decision.body.consent_record_id).toBeNull();
  });
});

// --- Scenario B ---------------------------------------------------------------

describe("Scenario B - consent granted", () => {
  it("runs consent -> authorisation -> secure transfer -> audit record", async () => {
    const scenario = await createTransferScenario();

    // The decision is available before anything is committed.
    const decision = await askDecision(scenario);
    expect(decision.body).toMatchObject({ permitted: true, reason: null, consent_status: "GRANTED" });
    expect(decision.body.consent_record_id).not.toBeNull();
    // Asking must not create anything.
    expect(await prisma.transferAuthorisation.count()).toBe(0);

    const { authResponse, authorisation, transfer } = await runFullFlow(scenario);
    expect(authResponse.status).toBe(201);
    expect(transfer.status).toBe("RECORDED");

    // The authorisation cites the exact consent record the decision named.
    expect(authorisation.consent_record_id).toBe(decision.body.consent_record_id);

    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${transfer.transfer_id}/envelope`, {
          key: scenario.deliveryKey,
        }),
        transferParams(transfer.transfer_id),
      )
    ).json()) as TransferDelivery;
    expect(scenario.target.open(delivery)).toBe(PII);

    // And the whole story is readable as one timeline.
    const audit = await readAudit(scenario);
    const kinds = audit.entries.map((entry) => entry.kind);
    expect(kinds).toContain("consent");
    expect(kinds).toContain("authorisation");
    expect(kinds).toContain("transfer");

    const transferEntry = audit.entries.find((entry) => entry.kind === "transfer");
    const authEntry = audit.entries.find((entry) => entry.kind === "authorisation");
    // Each step links back to the consent decision that justified it.
    expect(transferEntry?.consent_record_id).toBe(decision.body.consent_record_id);
    expect(authEntry?.consent_record_id).toBe(decision.body.consent_record_id);
    expect(JSON.stringify(audit)).not.toContain(PII);
  });
});

// --- Scenario C ---------------------------------------------------------------

describe("Scenario C - consent withdrawn", () => {
  it("refuses after a withdrawal, and keeps the earlier grant in the record", async () => {
    const scenario = await createTransferScenario();

    // Granted first, so this is genuinely a withdrawal rather than a refusal.
    expect((await askDecision(scenario)).body.permitted).toBe(true);

    await withdrawConsent(scenario);

    const decision = await askDecision(scenario);
    expect(decision.body.permitted).toBe(false);
    expect(decision.body.reason).toBe("consent_withdrawn");

    const response = await requestAuthorisation(scenario);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_not_granted" },
    });
    expect(await prisma.transferAuthorisation.count()).toBe(0);

    // History is preserved: the grant was not mutated into a withdrawal.
    const statuses = (
      await prisma.consentRecord.findMany({ orderBy: { decidedAt: "asc" } })
    ).map((row) => row.status);
    expect(statuses).toEqual(["GRANTED", "WITHDRAWN"]);
  });

  it("does not retroactively invalidate a transfer already authorised and made", async () => {
    const scenario = await createTransferScenario();
    const { transfer } = await runFullFlow(scenario);

    await withdrawConsent(scenario);

    // The historical record stands, and still cites the consent that was in
    // force at the time. A withdrawal stops future transfers, it does not
    // rewrite the past.
    const stored = await prisma.transferRecord.findUniqueOrThrow({
      where: { id: transfer.transfer_id },
      include: { authorisation: true },
    });
    expect(stored.status).toBe("RECORDED");

    const citedConsent = await prisma.consentRecord.findUniqueOrThrow({
      where: { id: stored.authorisation.consentRecordId },
    });
    expect(citedConsent.status).toBe("GRANTED");

    // But a new request is refused.
    expect((await requestAuthorisation(scenario)).status).toBe(409);
  });
});

// --- Scenario D ---------------------------------------------------------------

describe("Scenario D - wrong purpose", () => {
  it("refuses a purpose the principal did not consent to", async () => {
    const scenario = await createTransferScenario();

    const response = await requestAuthorisation(scenario, {
      purpose_code: scenario.consent.secondPurposeCode,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_not_granted" },
    });
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("refuses a purpose that does not exist at all, distinguishably", async () => {
    const scenario = await createTransferScenario();

    const decision = await askDecision(scenario, { purpose_code: "no-such-purpose" });
    expect(decision.body.reason).toBe("purpose_not_found");

    const response = await requestAuthorisation(scenario, { purpose_code: "no-such-purpose" });
    expect(response.status).toBe(404);
  });
});

// --- Scenario E ---------------------------------------------------------------

describe("Scenario E - wrong Fiduciary", () => {
  it("refuses a request from an organisation the consent was not given to", async () => {
    const scenario = await createTransferScenario();

    // Organisation B, using its own valid credential, for Organisation A's site.
    const response = await requestAuthorisation(scenario, {}, scenario.orgB.secretKey);

    expect(response.status).toBe(404);
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("refuses the decision endpoint to the wrong organisation too", async () => {
    const scenario = await createTransferScenario();

    const response = await decide(
      managementRequest("/api/v1/authorisations/decision", {
        key: scenario.orgB.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
        },
      }),
    );
    const body = (await response.json()) as AuthorisationDecisionResponse;

    // Not a leak: from B's perspective A's site simply does not exist.
    expect(body.permitted).toBe(false);
    expect(body.reason).toBe("site_not_found");
  });
});

// --- Scenario F ---------------------------------------------------------------

describe("Scenario F - cross-tenant attempt", () => {
  it("refuses one organisation naming another organisation's site", async () => {
    const scenario = await createTransferScenario();

    const response = await requestAuthorisation(scenario, { site_id: scenario.siteB1.siteId });

    expect(response.status).toBe(404);
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("refuses a sibling site reusing another site's consent, inside one organisation", async () => {
    const scenario = await createTransferScenario();

    // Site A2 belongs to the same organisation, but consent was given on A1.
    // Consent does not travel between sites.
    const decision = await askDecision(scenario, { site_id: scenario.siteA2.siteId });
    expect(decision.body.permitted).toBe(false);
    expect(decision.body.reason).toBe("principal_not_found");

    const response = await requestAuthorisation(scenario, { site_id: scenario.siteA2.siteId });
    expect(response.status).toBe(404);
  });

  it("keeps one organisation's audit trail out of another's", async () => {
    const scenario = await createTransferScenario();
    await runFullFlow(scenario);

    const response = await getAudit(
      managementRequest("/api/v1/audit", { key: scenario.orgB.secretKey }),
    );

    // Status first, so an error body cannot masquerade as an empty result.
    expect(response.status).toBe(200);
    const body = (await response.json()) as AuditResponse;
    expect(body.entries).toEqual([]);
  });
});

// --- Scenario G ---------------------------------------------------------------

describe("Scenario G - secure payload boundary", () => {
  it("moves the payload while the Consent Manager holds only ciphertext", async () => {
    const scenario = await createTransferScenario();
    const { transfer } = await runFullFlow(scenario);

    // Everything Rift stores about this transfer.
    const stored = await prisma.transferRecord.findUniqueOrThrow({
      where: { id: transfer.transfer_id },
    });
    expect(JSON.stringify(stored)).not.toContain("ABCDE1234F");
    expect(Buffer.from(stored.ciphertext, "base64").toString("utf8")).not.toContain("ABCDE1234F");

    // And the audit trail, which is what an operator would actually read.
    const audit = await readAudit(scenario);
    expect(JSON.stringify(audit)).not.toContain("ABCDE1234F");

    // The target, holding the key Rift never had, recovers the original.
    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${transfer.transfer_id}/envelope`, {
          key: scenario.deliveryKey,
        }),
        transferParams(transfer.transfer_id),
      )
    ).json()) as TransferDelivery;
    expect(scenario.target.open(delivery)).toBe(PII);
  });
});

// --- Failure modes ------------------------------------------------------------

describe("failure modes across the lifecycle", () => {
  it("refuses when consent was denied rather than never given", async () => {
    const scenario = await createTransferScenario({ consent: "DENIED" });

    const decision = await askDecision(scenario);
    expect(decision.body.reason).toBe("consent_denied");
    expect((await requestAuthorisation(scenario)).status).toBe(409);
  });

  it("rejects an unauthenticated or wrong-plane credential", async () => {
    const scenario = await createTransferScenario();

    for (const key of [undefined, scenario.siteA1.publicKey, scenario.deliveryKey]) {
      const response = await authorise(
        managementRequest("/api/v1/authorisations", {
          ...(key ? { key } : {}),
          method: "POST",
          body: {
            site_id: scenario.siteA1.siteId,
            principal_external_id: scenario.principalExternalId,
            purpose_code: scenario.consent.purposeCode,
            recipient_code: scenario.recipientCode,
          },
        }),
      );
      expect(response.status).toBe(401);
    }
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("rejects a malformed request without touching state", async () => {
    const scenario = await createTransferScenario();

    const malformed: Array<Record<string, unknown>> = [
      {},
      { site_id: scenario.siteA1.siteId },
      { ...{ site_id: scenario.siteA1.siteId }, principal_external_id: "", purpose_code: "x", recipient_code: "y" },
      // A payload must never ride along with a permission request.
      {
        site_id: scenario.siteA1.siteId,
        principal_external_id: scenario.principalExternalId,
        purpose_code: scenario.consent.purposeCode,
        recipient_code: scenario.recipientCode,
        plaintext: PII,
      },
    ];

    for (const body of malformed) {
      const response = await authorise(
        managementRequest("/api/v1/authorisations", {
          key: scenario.orgA.secretKey,
          method: "POST",
          body,
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("refuses an unknown or deactivated recipient", async () => {
    const scenario = await createTransferScenario();

    expect((await requestAuthorisation(scenario, { recipient_code: "nope" })).status).toBe(404);

    await prisma.dataRecipient.updateMany({
      where: { code: scenario.recipientCode },
      data: { isActive: false },
    });
    expect((await requestAuthorisation(scenario)).status).toBe(404);
  });

  it("rejects a replayed authorisation and keeps exactly one transfer", async () => {
    const scenario = await createTransferScenario();
    const { authorisation, envelope } = await runFullFlow(scenario);

    const replay = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );

    expect(replay.status).toBe(409);
    expect(await prisma.transferRecord.count()).toBe(1);
  });

  it("treats a duplicate authorisation request as a separate, independent permission", async () => {
    const scenario = await createTransferScenario();

    const first = (await (await requestAuthorisation(scenario)).json()) as TransferAuthorisationSummary;
    const second = (await (await requestAuthorisation(scenario)).json()) as TransferAuthorisationSummary;

    // Two requests are two permissions, each single-use, with distinct nonces.
    // They are not deduplicated: asking twice is not the same as asking once.
    expect(second.authorisation_id).not.toBe(first.authorisation_id);
    expect(second.nonce).not.toBe(first.nonce);
    expect(await prisma.transferAuthorisation.count()).toBe(2);
  });

  it("leaves the authorisation usable when a transfer fails validation", async () => {
    const scenario = await createTransferScenario();
    const authResponse = await requestAuthorisation(scenario);
    const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;

    // A malformed envelope is rejected before the authorisation is consumed, so
    // a transient client bug does not burn the permission.
    const failed = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          authorisation_id: authorisation.authorisation_id,
          nonce: authorisation.nonce,
          envelope: { ciphertext: "x", iv: "aaaa", auth_tag: "bbbb", ephemeral_public_key: "c" },
        },
      }),
    );
    expect(failed.status).toBe(400);

    const stillUsable = await prisma.transferAuthorisation.findUniqueOrThrow({
      where: { id: authorisation.authorisation_id },
    });
    expect(stillUsable.status).toBe("AUTHORISED");

    // And the retry succeeds.
    const retry = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, sealForAuthorisation(authorisation, PII)),
      }),
    );
    expect(retry.status).toBe(201);
  });

  it("resolves concurrent submissions to exactly one transfer, with no partial state", async () => {
    const scenario = await createTransferScenario();
    const authResponse = await requestAuthorisation(scenario);
    const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;
    const envelope = sealForAuthorisation(authorisation, PII);

    const submit = () =>
      submitTransfer(
        managementRequest("/api/v1/transfers", {
          key: scenario.orgA.secretKey,
          method: "POST",
          body: submissionBody(authorisation, envelope),
        }),
      );

    const [a, b] = await Promise.all([submit(), submit()]);
    const statuses = [a.status, b.status].sort();

    // One wins; the other is refused. The unique constraint on
    // authorisation_id decides it, so a race cannot produce two transfers or
    // an authorisation consumed with nothing recorded against it.
    expect(statuses).toEqual([201, 409]);
    expect(await prisma.transferRecord.count()).toBe(1);

    const consumed = await prisma.transferAuthorisation.findUniqueOrThrow({
      where: { id: authorisation.authorisation_id },
    });
    expect(consumed.status).toBe("CONSUMED");
  });
});
