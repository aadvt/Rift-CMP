import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import type {
  TransferAuthorisationSummary,
  TransferDelivery,
  TransferRecordSummary,
} from "@rift-cmp/shared";
import { POST as authorise } from "@/app/api/v1/transfers/authorisations/route";
import { GET as listTransfers, POST as submitTransfer } from "@/app/api/v1/transfers/route";
import { GET as collectEnvelope } from "@/app/api/v1/transfers/[transferId]/envelope/route";
import { POST as createRecipientRoute } from "@/app/api/v1/recipients/route";
import { POST as recordConsentRoute } from "@/app/api/v1/consent/route";
import {
  createTransferScenario,
  managementRequest,
  resetDatabase,
  siteRequest,
  type TransferScenario,
} from "./helpers/fixtures";
import { sealForAuthorisation, submissionBody } from "./helpers/fiduciaries";

beforeEach(resetDatabase);

const PII = "PAN: ABCDE1234F; Salary: 1,250,000 INR; Address: 12 Example Road";

function transferParams(transferId: string) {
  return { params: Promise.resolve({ transferId }) };
}

/** Requests an authorisation and returns it, failing loudly if refused. */
async function getAuthorisation(
  scenario: TransferScenario,
  overrides: Record<string, unknown> = {},
): Promise<TransferAuthorisationSummary> {
  const response = await authorise(
    managementRequest("/api/v1/transfers/authorisations", {
      key: scenario.orgA.secretKey,
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

  if (response.status !== 201) {
    throw new Error(`authorisation refused: ${response.status} ${JSON.stringify(await response.json())}`);
  }
  return (await response.json()) as TransferAuthorisationSummary;
}

describe("end to end: source seals, Rift routes, target decrypts", () => {
  it("recovers the original plaintext at the target", async () => {
    const scenario = await createTransferScenario();

    // 1. Source asks Rift for permission. No payload is involved.
    const authorisation = await getAuthorisation(scenario);
    expect(authorisation.status).toBe("AUTHORISED");
    expect(authorisation.recipient_public_key).toBe(scenario.target.publicKey);

    // 2. Source seals the payload itself, before contacting Rift again.
    const envelope = sealForAuthorisation(authorisation, PII);

    // 3. Rift records the sealed transfer.
    const submitted = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );
    expect(submitted.status).toBe(201);
    const record = (await submitted.json()) as TransferRecordSummary;
    expect(record.status).toBe("RECORDED");

    // 4. Target collects with its delivery key and decrypts with its private key.
    const collected = await collectEnvelope(
      managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
        key: scenario.deliveryKey,
      }),
      transferParams(record.transfer_id),
    );
    expect(collected.status).toBe(200);
    const delivery = (await collected.json()) as TransferDelivery;

    expect(scenario.target.open(delivery)).toBe(PII);
  });

  it("marks the transfer delivered once collected", async () => {
    const scenario = await createTransferScenario();
    const authorisation = await getAuthorisation(scenario);
    const envelope = sealForAuthorisation(authorisation, PII);

    const submitted = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );
    const record = (await submitted.json()) as TransferRecordSummary;

    await collectEnvelope(
      managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
        key: scenario.deliveryKey,
      }),
      transferParams(record.transfer_id),
    );

    const stored = await prisma.transferRecord.findUniqueOrThrow({
      where: { id: record.transfer_id },
    });
    expect(stored.status).toBe("DELIVERED");
    expect(stored.deliveredAt).not.toBeNull();
  });

  it("consumes the authorisation and links the consent decision relied upon", async () => {
    const scenario = await createTransferScenario();
    const authorisation = await getAuthorisation(scenario);

    await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, sealForAuthorisation(authorisation, PII)),
      }),
    );

    const stored = await prisma.transferAuthorisation.findUniqueOrThrow({
      where: { id: authorisation.authorisation_id },
    });
    expect(stored.status).toBe("CONSUMED");

    // The authorisation points at a real, append-only consent record.
    const consent = await prisma.consentRecord.findUniqueOrThrow({
      where: { id: stored.consentRecordId },
      include: { purpose: true },
    });
    expect(consent.status).toBe("GRANTED");
    expect(consent.purpose.code).toBe(scenario.consent.purposeCode);
  });

  it("reports transfer metadata to the source without the envelope", async () => {
    const scenario = await createTransferScenario();
    const authorisation = await getAuthorisation(scenario);
    const envelope = sealForAuthorisation(authorisation, PII);
    await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );

    const response = await listTransfers(
      managementRequest("/api/v1/transfers", { key: scenario.orgA.secretKey }),
    );
    const body = await response.json();
    const serialised = JSON.stringify(body);

    expect(body.transfers).toHaveLength(1);
    expect(body.transfers[0]).toMatchObject({
      purpose_code: scenario.consent.purposeCode,
      recipient_code: scenario.recipientCode,
      status: "RECORDED",
    });

    // Routing metadata only. The integrity digest is present by design; the
    // envelope itself is not served on this plane.
    expect(body.transfers[0].ciphertext_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(serialised).not.toContain(envelope.ciphertext);
    expect(serialised).not.toContain(envelope.authTag);
    expect(serialised).not.toContain(envelope.ephemeralPublicKey);
    expect(body.transfers[0]).not.toHaveProperty("envelope");
    expect(serialised).not.toContain(PII);
  });
});

describe("consent gates the transfer", () => {
  it("refuses to authorise when consent was denied", async () => {
    const scenario = await createTransferScenario({ grant: false });

    const response = await authorise(
      managementRequest("/api/v1/transfers/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          recipient_code: scenario.recipientCode,
        },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_not_granted" },
    });
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("refuses once consent has been withdrawn", async () => {
    const scenario = await createTransferScenario();

    // A withdrawal after the grant. Effective consent is newest-wins, so the
    // transfer must now be refused even though a GRANTED record still exists.
    await recordConsentRoute(
      siteRequest("/api/v1/consent", {
        key: scenario.siteA1.publicKey,
        method: "POST",
        body: {
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          status: "WITHDRAWN",
        },
      }),
    );

    const response = await authorise(
      managementRequest("/api/v1/transfers/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          recipient_code: scenario.recipientCode,
        },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "consent_not_granted" },
    });
  });

  it("refuses a purpose the principal never decided on", async () => {
    const scenario = await createTransferScenario();

    const response = await authorise(
      managementRequest("/api/v1/transfers/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.secondPurposeCode,
          recipient_code: scenario.recipientCode,
        },
      }),
    );

    expect(response.status).toBe(409);
  });

  it("refuses an unknown principal", async () => {
    const scenario = await createTransferScenario();

    const response = await authorise(
      managementRequest("/api/v1/transfers/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: "nobody-here",
          purpose_code: scenario.consent.purposeCode,
          recipient_code: scenario.recipientCode,
        },
      }),
    );

    expect(response.status).toBe(404);
  });

  it("refuses an unknown recipient", async () => {
    const scenario = await createTransferScenario();

    const response = await authorise(
      managementRequest("/api/v1/transfers/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          recipient_code: "no-such-recipient",
        },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unknown_recipient" },
    });
  });

  it("refuses a deactivated recipient", async () => {
    const scenario = await createTransferScenario();
    await prisma.dataRecipient.updateMany({
      where: { code: scenario.recipientCode },
      data: { isActive: false },
    });

    const response = await authorise(
      managementRequest("/api/v1/transfers/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          recipient_code: scenario.recipientCode,
        },
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("recipient registration", () => {
  it("returns a delivery key once and stores only its digest", async () => {
    const scenario = await createTransferScenario();

    const response = await createRecipientRoute(
      managementRequest("/api/v1/recipients", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          code: "second-partner",
          name: "Second Partner",
          public_key: scenario.target.publicKey,
        },
      }),
    );

    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.delivery_key).toMatch(/^rk_[0-9a-f]{64}$/);

    const stored = await prisma.dataRecipient.findFirstOrThrow({
      where: { code: "second-partner" },
    });
    expect(JSON.stringify(stored)).not.toContain(created.delivery_key);
    expect(stored.deliveryKeyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a duplicate recipient code", async () => {
    const scenario = await createTransferScenario();

    const response = await createRecipientRoute(
      managementRequest("/api/v1/recipients", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          code: scenario.recipientCode,
          name: "Duplicate",
          public_key: scenario.target.publicKey,
        },
      }),
    );

    expect(response.status).toBe(409);
  });
});
