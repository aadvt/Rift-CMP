import { beforeEach, describe, expect, it } from "vitest";
import { deleteOrganisation, prisma } from "database";
import { createTransferScenario, resetDatabase, runTransferFlow } from "./helpers/fixtures";

/**
 * Immutable audit semantics for the routing tables.
 *
 * `GET /api/v1/audit` presents consent decisions, authorisations and transfers
 * as one timeline and the product calls that an audit trail. Until Phase 6A only
 * one of the three tables was actually protected, and only against `UPDATE`. The
 * other two were ordinary mutable rows: "this transfer was permitted by consent
 * record X" was a claim anything with database access could quietly rewrite.
 *
 * These tests reach **past the API** and issue the statements through Prisma,
 * for the same reason `consent-decisions.test.ts` does: the guarantee is a
 * database trigger, not a route that happens not to offer an endpoint. A
 * guarantee that only holds while the application layer behaves is not a
 * guarantee.
 *
 * The tables cannot be strictly append-only — an authorisation is consumed, a
 * transfer is delivered — so what is asserted is narrower and more useful: the
 * columns that record *what happened* never change, and `status` only ever moves
 * forwards along the declared state machine.
 */

beforeEach(resetDatabase);

/**
 * A completed flow: one consent record, one authorisation, one transfer.
 *
 * `prefix` exists because organisation slugs are globally unique, and one test
 * below deliberately builds two independent tenants inside a single `it`.
 */
async function completedTransfer(prefix = "") {
  const scenario = await createTransferScenario({ prefix });
  const { transfer, authorisation } = await runTransferFlow(scenario);
  if (!transfer) throw new Error("runTransferFlow did not produce a transfer");
  return {
    scenario,
    transferId: transfer.transfer_id,
    authorisationId: authorisation.authorisation_id,
  };
}

describe("transfer_authorisations", () => {
  it("refuses to rewrite the consent record it relied on", async () => {
    const { authorisationId } = await completedTransfer();

    // The single most damaging edit available: making a transfer appear to have
    // been justified by a decision other than the one that justified it.
    await expect(
      prisma.transferAuthorisation.update({
        where: { id: authorisationId },
        data: { consentRecordId: "some-other-record" },
      }),
    ).rejects.toThrow();
  });

  it("refuses to rewrite the principal, purpose, recipient or site", async () => {
    const { authorisationId } = await completedTransfer();

    for (const data of [
      { principalId: "someone-else" },
      { purposeId: "another-purpose" },
      { recipientId: "another-recipient" },
      { siteId: "another-site" },
    ]) {
      await expect(
        prisma.transferAuthorisation.update({ where: { id: authorisationId }, data }),
      ).rejects.toThrow();
    }
  });

  it("refuses to rewrite the nonce or the expiry", async () => {
    const { authorisationId } = await completedTransfer();

    await expect(
      prisma.transferAuthorisation.update({
        where: { id: authorisationId },
        data: { nonce: "a-fresh-nonce" },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.transferAuthorisation.update({
        where: { id: authorisationId },
        data: { expiresAt: new Date(Date.now() + 86_400_000) },
      }),
    ).rejects.toThrow();
  });

  it("refuses to move a consumed authorisation back to authorised", async () => {
    const { authorisationId } = await completedTransfer();

    // Re-arming a spent single-use permission, which is exactly what replay
    // protection exists to stop.
    await expect(
      prisma.transferAuthorisation.update({
        where: { id: authorisationId },
        data: { status: "AUTHORISED" },
      }),
    ).rejects.toThrow();

    const row = await prisma.transferAuthorisation.findUniqueOrThrow({
      where: { id: authorisationId },
    });
    expect(row.status).toBe("CONSUMED");
  });

  it("refuses an invented status", async () => {
    const scenario = await createTransferScenario();
    const { authorisation } = await runTransferFlow(scenario, { submit: false });

    await expect(
      prisma.transferAuthorisation.update({
        where: { id: authorisation.authorisation_id },
        data: { status: "DEFINITELY_FINE" },
      }),
    ).rejects.toThrow();
  });

  it("still allows the transitions the product depends on", async () => {
    const scenario = await createTransferScenario();
    const { authorisation } = await runTransferFlow(scenario, { submit: false });

    const expired = await prisma.transferAuthorisation.update({
      where: { id: authorisation.authorisation_id },
      data: { status: "EXPIRED" },
    });

    expect(expired.status).toBe("EXPIRED");
  });
});

describe("transfer_records", () => {
  it("refuses to alter the sealed payload", async () => {
    const { transferId } = await completedTransfer();

    for (const data of [
      { ciphertext: "c3dhcHBlZA==" },
      { iv: "c3dhcHBlZA==" },
      { authTag: "c3dhcHBlZA==" },
      { ephemeralPublicKey: "c3dhcHBlZA==" },
    ]) {
      await expect(
        prisma.transferRecord.update({ where: { id: transferId }, data }),
      ).rejects.toThrow();
    }
  });

  it("refuses to alter the digest or the recorded size", async () => {
    const { transferId } = await completedTransfer();

    // The digest is the only thing that lets anyone later prove the ciphertext
    // relayed was the ciphertext sealed.
    await expect(
      prisma.transferRecord.update({
        where: { id: transferId },
        data: { ciphertextSha256: "0".repeat(64) },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.transferRecord.update({ where: { id: transferId }, data: { payloadBytes: 1 } }),
    ).rejects.toThrow();
  });

  it("refuses to re-point a transfer at another authorisation", async () => {
    const { transferId } = await completedTransfer();

    await expect(
      prisma.transferRecord.update({
        where: { id: transferId },
        data: { authorisationId: "another-authorisation" },
      }),
    ).rejects.toThrow();
  });

  it("refuses to backdate when it was recorded", async () => {
    const { transferId } = await completedTransfer();

    await expect(
      prisma.transferRecord.update({
        where: { id: transferId },
        data: { recordedAt: new Date("2020-01-01T00:00:00Z") },
      }),
    ).rejects.toThrow();
  });

  it("refuses to un-deliver a delivered transfer", async () => {
    const { transferId } = await completedTransfer();

    await prisma.transferRecord.update({
      where: { id: transferId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });

    await expect(
      prisma.transferRecord.update({ where: { id: transferId }, data: { status: "RECORDED" } }),
    ).rejects.toThrow();
  });

  it("writes the delivery timestamp once", async () => {
    const { transferId } = await completedTransfer();
    const deliveredAt = new Date();

    await prisma.transferRecord.update({
      where: { id: transferId },
      data: { status: "DELIVERED", deliveredAt },
    });

    await expect(
      prisma.transferRecord.update({
        where: { id: transferId },
        data: { deliveredAt: new Date(deliveredAt.getTime() + 60_000) },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.transferRecord.update({ where: { id: transferId }, data: { deliveredAt: null } }),
    ).rejects.toThrow();
  });

  it("still allows RECORDED to DELIVERED, which the delivery plane performs", async () => {
    const { transferId } = await completedTransfer();

    const delivered = await prisma.transferRecord.update({
      where: { id: transferId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });

    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.deliveredAt).not.toBeNull();
  });

  it("still allows RECORDED to FAILED with a reason", async () => {
    const { transferId } = await completedTransfer();

    const failed = await prisma.transferRecord.update({
      where: { id: transferId },
      data: { status: "FAILED", failureReason: "recipient rejected the envelope" },
    });

    expect(failed.status).toBe("FAILED");
  });
});

describe("consent_records stays append-only", () => {
  it("still refuses any UPDATE", async () => {
    await completedTransfer();
    const record = await prisma.consentRecord.findFirstOrThrow();

    await expect(
      prisma.consentRecord.update({ where: { id: record.id }, data: { status: "WITHDRAWN" } }),
    ).rejects.toThrow();
  });
});

describe("deletion is guarded, not blocked", () => {
  it("refuses an ad-hoc delete of an authorisation", async () => {
    const { authorisationId } = await completedTransfer();

    await expect(
      prisma.transferAuthorisation.deleteMany({ where: { id: authorisationId } }),
    ).rejects.toThrow();
  });

  it("refuses an ad-hoc delete of a transfer", async () => {
    const { transferId } = await completedTransfer();

    await expect(
      prisma.transferRecord.deleteMany({ where: { id: transferId } }),
    ).rejects.toThrow();
  });

  it("refuses an ad-hoc delete of a consent record", async () => {
    await completedTransfer();
    const record = await prisma.consentRecord.findFirstOrThrow();

    await expect(
      prisma.consentRecord.deleteMany({ where: { id: record.id } }),
    ).rejects.toThrow();
  });

  it("refuses a plain organisation delete, because the cascade reaches history", async () => {
    const { scenario } = await completedTransfer();

    // The failure mode this replaces: a routine tenant delete quietly erasing an
    // audit trail as a side effect nobody reviewed.
    await expect(
      prisma.organisation.delete({ where: { id: scenario.orgA.organisationId } }),
    ).rejects.toThrow();

    expect(await prisma.transferRecord.count()).toBe(1);
  });

  it("offboards a tenant completely through the documented mechanism", async () => {
    const { scenario } = await completedTransfer();

    await deleteOrganisation(prisma, scenario.orgA.organisationId);

    expect(await prisma.organisation.count({ where: { id: scenario.orgA.organisationId } })).toBe(0);
    expect(await prisma.transferRecord.count()).toBe(0);
    expect(await prisma.transferAuthorisation.count()).toBe(0);
    expect(await prisma.consentRecord.count()).toBe(0);
  });

  it("leaves the other tenant's history untouched while offboarding one", async () => {
    const { scenario } = await completedTransfer();

    const before = await prisma.organisation.count({ where: { id: scenario.orgB.organisationId } });
    await deleteOrganisation(prisma, scenario.orgA.organisationId);

    expect(before).toBe(1);
    expect(await prisma.organisation.count({ where: { id: scenario.orgB.organisationId } })).toBe(1);
  });

  it("does not leave the offboarding permission behind for the next statement", async () => {
    const first = await completedTransfer();
    await deleteOrganisation(prisma, first.scenario.orgA.organisationId);

    // `SET LOCAL` is scoped to its transaction. If it leaked onto the pooled
    // connection, the next delete would silently succeed - which is the whole
    // reason the flag is set with SET LOCAL rather than SET.
    const second = await completedTransfer("second-");
    await expect(
      prisma.transferRecord.deleteMany({ where: { id: second.transferId } }),
    ).rejects.toThrow();
  });
});
