import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authoriseTransfer, prisma } from "database";
import type {
  TransferAuthorisationSummary,
  TransferBindingWire,
  TransferDelivery,
  TransferRecordSummary,
} from "@rift-cmp/shared";
import { buildTransferAad } from "@rift-cmp/secure-transfer";
import { fromWireBinding, fromWireEnvelope } from "@rift-cmp/shared";
import { generateRecipientKeyPair, openEnvelope } from "@rift-cmp/secure-transfer/fiduciary";
import { POST as authorise } from "@/app/api/v1/authorisations/route";
import { GET as listTransfers, POST as submitTransfer } from "@/app/api/v1/transfers/route";
import { GET as collectEnvelope } from "@/app/api/v1/transfers/[transferId]/envelope/route";
import {
  createTransferScenario,
  managementRequest,
  resetDatabase,
  type TransferScenario,
} from "./helpers/fixtures";
import { sealForAuthorisation, submissionBody } from "./helpers/fiduciaries";

/**
 * Tests that attack the trust boundary.
 *
 * The claim under test is narrow and specific: Rift can authorise and record a
 * transfer while being unable to read the payload. These tests try to falsify
 * that from Rift's own position — using only what its database and its API
 * actually contain.
 */

beforeEach(resetDatabase);

/** Distinctive enough that a substring search cannot miss it. */
const PII = "AADHAAR-999888777666-SENSITIVE-PAYLOAD-MARKER";

function transferParams(transferId: string) {
  return { params: Promise.resolve({ transferId }) };
}

/**
 * Matches a real import of the fiduciary module, not a mention of it.
 *
 * A plain substring search would flag the doc comments that explain *why* the
 * module is not imported, which would make the guard useless the moment anyone
 * documented it.
 */
const FIDUCIARY_IMPORT = /(?:from|import|require)\s*\(?\s*["'][^"']*secure-transfer\/fiduciary["']/;

async function runTransfer(scenario: TransferScenario, plaintext = PII) {
  const authResponse = await authorise(
    managementRequest("/api/v1/authorisations", {
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
  const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;
  const envelope = sealForAuthorisation(authorisation, plaintext);

  const submitted = await submitTransfer(
    managementRequest("/api/v1/transfers", {
      key: scenario.orgA.secretKey,
      method: "POST",
      body: submissionBody(authorisation, envelope),
    }),
  );
  const record = (await submitted.json()) as TransferRecordSummary;

  return { authorisation, envelope, record, submitted };
}

/** Everything Rift persists, as one JSON blob. */
async function dumpEntireDatabase(): Promise<string> {
  const [
    organisations, websites, sessions, events, principals, purposes, policies,
    policyVersions, notices, noticePurposes, consentRecords, dataRecipients,
    transferAuthorisations, transferRecords,
  ] = await Promise.all([
    prisma.organisation.findMany(), prisma.website.findMany(), prisma.session.findMany(),
    prisma.event.findMany(), prisma.principal.findMany(), prisma.purpose.findMany(),
    prisma.policy.findMany(), prisma.policyVersion.findMany(), prisma.notice.findMany(),
    prisma.noticePurpose.findMany(), prisma.consentRecord.findMany(),
    prisma.dataRecipient.findMany(), prisma.transferAuthorisation.findMany(),
    prisma.transferRecord.findMany(),
  ]);

  return JSON.stringify({
    organisations, websites, sessions, events, principals, purposes, policies,
    policyVersions, notices, noticePurposes, consentRecords, dataRecipients,
    transferAuthorisations, transferRecords,
  });
}

describe("plaintext never reaches Rift", () => {
  it("is absent from every request body the source sends", async () => {
    const scenario = await createTransferScenario();
    const bodies: string[] = [];

    // Capture what actually crosses the wire by re-serialising the requests.
    const authBody = {
      site_id: scenario.siteA1.siteId,
      principal_external_id: scenario.principalExternalId,
      purpose_code: scenario.consent.purposeCode,
      recipient_code: scenario.recipientCode,
    };
    bodies.push(JSON.stringify(authBody));

    const authResponse = await authorise(
      managementRequest("/api/v1/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: authBody,
      }),
    );
    const authorisation = (await authResponse.json()) as TransferAuthorisationSummary;
    const envelope = sealForAuthorisation(authorisation, PII);
    bodies.push(JSON.stringify(submissionBody(authorisation, envelope)));

    for (const body of bodies) {
      expect(body).not.toContain(PII);
      expect(body).not.toContain("AADHAAR");
    }
  });

  it("is rejected outright if a client tries to attach it", async () => {
    const scenario = await createTransferScenario();
    const { authorisation } = await (async () => {
      const response = await authorise(
        managementRequest("/api/v1/authorisations", {
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
      return { authorisation: (await response.json()) as TransferAuthorisationSummary };
    })();

    const envelope = sealForAuthorisation(authorisation, PII);

    // The submission schema is strict, so an extra `plaintext` field is a
    // validation error rather than something Rift quietly accepts and stores.
    const response = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: { ...submissionBody(authorisation, envelope), plaintext: PII },
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.transferRecord.count()).toBe(0);
    expect(await dumpEntireDatabase()).not.toContain(PII);
  });

  it("cannot be smuggled into the authorisation request", async () => {
    const scenario = await createTransferScenario();

    const response = await authorise(
      managementRequest("/api/v1/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteA1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          recipient_code: scenario.recipientCode,
          payload: PII,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await dumpEntireDatabase()).not.toContain(PII);
  });
});

describe("plaintext is never persisted", () => {
  it("does not appear anywhere in the database after a completed transfer", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    await collectEnvelope(
      managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
        key: scenario.deliveryKey,
      }),
      transferParams(record.transfer_id),
    );

    const everything = await dumpEntireDatabase();

    expect(everything).not.toContain(PII);
    expect(everything).not.toContain("AADHAAR");
    expect(everything).not.toContain("999888777666");
    // The transfer definitely happened - this is not a vacuous pass.
    expect(await prisma.transferRecord.count()).toBe(1);
  });

  it("stores a ciphertext that does not contain the payload in any encoding", async () => {
    const scenario = await createTransferScenario();
    await runTransfer(scenario);

    const stored = await prisma.transferRecord.findFirstOrThrow();
    const raw = Buffer.from(stored.ciphertext, "base64");

    for (const encoding of ["utf8", "latin1", "ascii", "utf16le"] as const) {
      expect(raw.toString(encoding)).not.toContain("AADHAAR");
    }
    expect(stored.ciphertext).not.toContain(PII);
  });
});

describe("Rift cannot decrypt what it stores", () => {
  it("holds no private key material anywhere in the database", async () => {
    const scenario = await createTransferScenario();
    await runTransfer(scenario);

    const everything = await dumpEntireDatabase();
    const privateKey = scenario.target.privateKeyForAssertionsOnly;

    expect(everything).not.toContain(privateKey);
    // Nor any prefix of it - a partial leak would be just as fatal.
    expect(everything).not.toContain(privateKey.slice(0, 32));
    // The public key is present, and that is fine: it is public.
    expect(everything).toContain(scenario.target.publicKey);
  });

  it("cannot decrypt using anything it stores, tried exhaustively", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
          key: scenario.deliveryKey,
        }),
        transferParams(record.transfer_id),
      )
    ).json()) as TransferDelivery;

    // Harvest *every* string value Rift holds, from every column of every
    // table, and try each one as the recipient private key. Hand-picking
    // columns would leave open the possibility that the one column that does
    // work was simply not on the list.
    const candidates = new Set<string>();
    const harvest = (value: unknown) => {
      if (typeof value === "string") {
        candidates.add(value);
      } else if (Array.isArray(value)) {
        value.forEach(harvest);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(harvest);
      }
    };
    harvest(JSON.parse(await dumpEntireDatabase()));

    expect(candidates.size).toBeGreaterThan(20);

    let decrypted = 0;
    for (const candidate of candidates) {
      try {
        openEnvelope({
          envelope: fromWireEnvelope(delivery.envelope),
          recipientPrivateKey: candidate,
          aad: buildTransferAad(fromWireBinding(delivery.binding)),
        });
        decrypted += 1;
      } catch {
        // Expected: nothing Rift holds is a usable decryption key.
      }
    }

    expect(decrypted).toBe(0);

    // Control: the target, holding the one key Rift never had, succeeds.
    expect(scenario.target.open(delivery)).toBe(PII);
  });

  it("has no code path to decryption: api/ never imports the fiduciary module", () => {
    const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // `tests/` is exempt: the tests act as the fiduciaries.
          if (["node_modules", ".next", "tests"].includes(entry.name)) continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        const source = fs.readFileSync(full, "utf8");
        if (FIDUCIARY_IMPORT.test(source)) {
          offenders.push(path.relative(apiDir, full));
        }
      }
    };
    walk(apiDir);

    // Rift does not merely decline to decrypt; the code to do so is not in its
    // dependency graph. If this ever fails, the trust boundary has been broken.
    expect(offenders).toEqual([]);
  });

  it("keeps the database layer free of the fiduciary module too", () => {
    const dbDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../database",
    );
    const source = fs.readFileSync(path.join(dbDir, "transfers.ts"), "utf8");

    // It imports the Rift-safe half, and does not import the fiduciary half.
    expect(source).toContain('from "@rift-cmp/secure-transfer"');
    expect(FIDUCIARY_IMPORT.test(source)).toBe(false);
  });
});

describe("logs and errors do not leak plaintext", () => {
  const spies: Array<{ restore: () => void }> = [];
  let captured: string[] = [];

  beforeEach(() => {
    captured = [];
    for (const level of ["log", "warn", "error", "info", "debug"] as const) {
      const spy = vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        captured.push(args.map((a) => String(a)).join(" "));
      });
      spies.push({ restore: () => spy.mockRestore() });
    }
  });

  afterEach(() => {
    for (const spy of spies.splice(0)) spy.restore();
  });

  it("writes no plaintext to the console during a full transfer", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);
    await collectEnvelope(
      managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
        key: scenario.deliveryKey,
      }),
      transferParams(record.transfer_id),
    );

    const log = captured.join("\n");
    expect(log).not.toContain(PII);
    expect(log).not.toContain("AADHAAR");
  });

  it("returns no plaintext in error responses", async () => {
    const scenario = await createTransferScenario();
    const { authorisation, envelope } = await runTransfer(scenario);

    // Replay: the authorisation is already consumed.
    const replay = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );

    const body = JSON.stringify(await replay.json());
    expect(replay.status).toBe(409);
    expect(body).not.toContain(PII);
    // Nor does an error echo the ciphertext back.
    expect(body).not.toContain(envelope.ciphertext);
  });
});

describe("tampering, replay and misdelivery", () => {
  it("rejects a replayed authorisation", async () => {
    const scenario = await createTransferScenario();
    const { authorisation, envelope } = await runTransfer(scenario);

    const replay = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, envelope),
      }),
    );

    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toMatchObject({
      error: { code: "authorisation_consumed" },
    });
    expect(await prisma.transferRecord.count()).toBe(1);
  });

  it("rejects an expired authorisation", async () => {
    const scenario = await createTransferScenario();

    // Minted with an already-lapsed TTL rather than by editing `expires_at`
    // afterwards. Phase 6A froze that column - extending an authorisation's life
    // by rewriting the row is exactly the attack the guard exists to stop, and
    // `audit-immutability.test.ts` asserts the refusal. The route's TTL floor is
    // 30 seconds, so this goes through the service layer to reach the past, and
    // the submission below still goes through the real HTTP surface, which is
    // where the expiry check lives.
    const minted = await authoriseTransfer(prisma, {
      organisationId: scenario.orgA.organisationId,
      siteId: scenario.siteA1.siteId,
      principalExternalId: scenario.principalExternalId,
      purposeCode: scenario.consent.purposeCode,
      recipientCode: scenario.recipientCode,
      ttlSeconds: -1,
    });
    if (!minted.ok) throw new Error(`could not mint an authorisation: ${minted.message}`);
    const authorisation: TransferAuthorisationSummary = minted.authorisation;

    const submitted = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: submissionBody(authorisation, sealForAuthorisation(authorisation, PII)),
      }),
    );

    expect(submitted.status).toBe(409);
    await expect(submitted.json()).resolves.toMatchObject({
      error: { code: "authorisation_expired" },
    });
    expect(await prisma.transferRecord.count()).toBe(0);
  });

  it("rejects a mismatched nonce", async () => {
    const scenario = await createTransferScenario();
    const response = await authorise(
      managementRequest("/api/v1/authorisations", {
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
    const authorisation = (await response.json()) as TransferAuthorisationSummary;
    const envelope = sealForAuthorisation(authorisation, PII);

    const submitted = await submitTransfer(
      managementRequest("/api/v1/transfers", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: { ...submissionBody(authorisation, envelope), nonce: "not-the-issued-nonce" },
      }),
    );

    expect(submitted.status).toBe(404);
    expect(await prisma.transferRecord.count()).toBe(0);
  });

  it("cannot alter stored ciphertext at all, and could not do so undetectably", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    const stored = await prisma.transferRecord.findUniqueOrThrow({
      where: { id: record.transfer_id },
    });
    const bytes = Buffer.from(stored.ciphertext, "base64");
    bytes[0] ^= 0x01;

    // Phase 6A: the payload columns are immutable, so a compromised Rift cannot
    // even record the alteration. This is new, and it is the stronger half.
    await expect(
      prisma.transferRecord.update({
        where: { id: stored.id },
        data: { ciphertext: bytes.toString("base64") },
      }),
    ).rejects.toThrow();

    const untouched = await prisma.transferRecord.findUniqueOrThrow({
      where: { id: record.transfer_id },
    });
    expect(untouched.ciphertext).toBe(stored.ciphertext);

    // And the original claim still holds independently of that guard: even if a
    // bit did flip - in storage, in transit, anywhere between the two
    // fiduciaries - the target detects it, because AES-GCM authenticates. The
    // corruption is applied to the delivered envelope, which models a hostile
    // relay rather than a hostile database.
    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
          key: scenario.deliveryKey,
        }),
        transferParams(record.transfer_id),
      )
    ).json()) as TransferDelivery;

    const tampered = {
      ...delivery.envelope,
      ciphertext: bytes.toString("base64"),
    };
    expect(scenario.target.tryOpen(tampered, delivery.binding)).toBeNull();
    // The untampered envelope still opens, so the null above is the tampering
    // being caught rather than the test misconstructing the request.
    expect(scenario.target.tryOpen(delivery.envelope, delivery.binding)).toBe(PII);
  });

  it("delivers metadata that fails to open if Rift re-labelled the transfer", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
          key: scenario.deliveryKey,
        }),
        transferParams(record.transfer_id),
      )
    ).json()) as TransferDelivery;

    // Rift claims the transfer was for a different purpose. The AAD no longer
    // matches, so the payload will not open under the false metadata.
    // Annotated, so a mistyped key is a compile error rather than an ignored
    // extra property that would silently weaken this test into a no-op.
    const tampered: TransferBindingWire = {
      ...delivery.binding,
      purpose_code: "some_other_purpose",
    };
    expect(scenario.target.tryOpen(delivery.envelope, tampered)).toBeNull();

    // The honest metadata still works.
    expect(scenario.target.open(delivery)).toBe(PII);
  });

  it("gives a different recipient nothing it can use", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    const delivery = (await (
      await collectEnvelope(
        managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
          key: scenario.deliveryKey,
        }),
        transferParams(record.transfer_id),
      )
    ).json()) as TransferDelivery;

    const outsider = generateRecipientKeyPair();
    expect(() =>
      openEnvelope({
        envelope: fromWireEnvelope(delivery.envelope),
        recipientPrivateKey: outsider.privateKey,
        aad: buildTransferAad(fromWireBinding(delivery.binding)),
      }),
    ).toThrow();
  });
});

describe("cross-tenant and credential isolation", () => {
  it("refuses a transfer authorisation for another tenant's site", async () => {
    const scenario = await createTransferScenario();

    const response = await authorise(
      managementRequest("/api/v1/authorisations", {
        key: scenario.orgA.secretKey,
        method: "POST",
        body: {
          site_id: scenario.siteB1.siteId,
          principal_external_id: scenario.principalExternalId,
          purpose_code: scenario.consent.purposeCode,
          recipient_code: scenario.recipientCode,
        },
      }),
    );

    expect(response.status).toBe(404);
    expect(await prisma.transferAuthorisation.count()).toBe(0);
  });

  it("refuses another organisation's secret on the same authorisation", async () => {
    const scenario = await createTransferScenario();

    const response = await authorise(
      managementRequest("/api/v1/authorisations", {
        key: scenario.orgB.secretKey,
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

  it("hides one organisation's transfers from another", async () => {
    const scenario = await createTransferScenario();
    await runTransfer(scenario);

    const response = await listTransfers(
      managementRequest("/api/v1/transfers", { key: scenario.orgB.secretKey }),
    );

    // Assert the status first. Without this, an unrelated failure that returns
    // an error body reads as `expected undefined to equal []`, which is
    // indistinguishable from a genuine tenancy leak.
    expect(response.status).toBe(200);
    const body = (await response.json()) as { transfers: unknown[] };
    expect(body.transfers).toEqual([]);
  });

  it("refuses a site public key and an organisation secret on the delivery plane", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    for (const key of [scenario.siteA1.publicKey, scenario.orgA.secretKey]) {
      const response = await collectEnvelope(
        managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, { key }),
        transferParams(record.transfer_id),
      );
      expect(response.status).toBe(401);
    }
  });

  it("stops one recipient collecting another recipient's envelope", async () => {
    const scenario = await createTransferScenario();
    const { record } = await runTransfer(scenario);

    // A second recipient in the same organisation, with its own delivery key.
    const other = generateRecipientKeyPair();
    const { createRecipient } = await import("database");
    const otherRecipient = await createRecipient(prisma, {
      organisationId: scenario.orgA.organisationId,
      code: "other-partner",
      name: "Other Partner",
      publicKey: other.publicKey,
    });

    const response = await collectEnvelope(
      managementRequest(`/api/v1/transfers/${record.transfer_id}/envelope`, {
        key: otherRecipient.delivery_key,
      }),
      transferParams(record.transfer_id),
    );

    expect(response.status).toBe(404);
  });
});
