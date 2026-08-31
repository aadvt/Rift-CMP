import { describe, expect, it } from "vitest";
import {
  buildTransferAad,
  ciphertextBytes,
  envelopeDigest,
  isSealedEnvelope,
  MAX_CIPHERTEXT_BYTES,
  type TransferBinding,
} from "@rift-cmp/secure-transfer";
import {
  generateRecipientKeyPair,
  openEnvelope,
  sealEnvelope,
} from "@rift-cmp/secure-transfer/fiduciary";

/**
 * Unit tests for the cryptographic boundary itself, with no database and no API.
 *
 * These prove the primitive behaves as the design claims. The tests that prove
 * *Rift* cannot decrypt live in `transfer-boundary.test.ts`, which works only
 * from what the Consent Manager actually stores.
 */

const PII = "Aadhaar: 1234-5678-9012; DOB: 1990-01-01; Name: A. Person";

function binding(overrides: Partial<TransferBinding> = {}): TransferBinding {
  return {
    authorisationId: "11111111-1111-4111-8111-111111111111",
    nonce: "nonce-aaaaaaaaaaaaaaaa",
    purposeCode: "kyc_verification",
    recipientCode: "partner-bank",
    principalExternalId: "principal-1",
    ...overrides,
  };
}

describe("sealing and opening", () => {
  it("round-trips a payload for the intended recipient", () => {
    const target = generateRecipientKeyPair();
    const aad = buildTransferAad(binding());

    const envelope = sealEnvelope({ plaintext: PII, recipientPublicKey: target.publicKey, aad });
    const opened = openEnvelope({ envelope, recipientPrivateKey: target.privateKey, aad });

    expect(opened.toString("utf8")).toBe(PII);
  });

  it("produces a well-formed envelope", () => {
    const target = generateRecipientKeyPair();
    const envelope = sealEnvelope({
      plaintext: PII,
      recipientPublicKey: target.publicKey,
      aad: buildTransferAad(binding()),
    });

    expect(isSealedEnvelope(envelope)).toBe(true);
    expect(Buffer.from(envelope.iv, "base64")).toHaveLength(12);
    expect(Buffer.from(envelope.authTag, "base64")).toHaveLength(16);
    expect(envelopeDigest(envelope)).toMatch(/^[0-9a-f]{64}$/);
    expect(ciphertextBytes(envelope)).toBeGreaterThan(0);
  });

  it("leaks no plaintext into the ciphertext", () => {
    const target = generateRecipientKeyPair();
    const envelope = sealEnvelope({
      plaintext: PII,
      recipientPublicKey: target.publicKey,
      aad: buildTransferAad(binding()),
    });

    const asBytes = Buffer.from(envelope.ciphertext, "base64");
    expect(asBytes.toString("utf8")).not.toContain("Aadhaar");
    expect(asBytes.toString("latin1")).not.toContain("1234-5678-9012");
    expect(JSON.stringify(envelope)).not.toContain("Aadhaar");
  });

  it("gives a different ciphertext every time, even for identical input", () => {
    const target = generateRecipientKeyPair();
    const aad = buildTransferAad(binding());

    const first = sealEnvelope({ plaintext: PII, recipientPublicKey: target.publicKey, aad });
    const second = sealEnvelope({ plaintext: PII, recipientPublicKey: target.publicKey, aad });

    // A fresh ephemeral key and IV per call, so identical payloads are not
    // linkable by comparing ciphertexts.
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.ephemeralPublicKey).not.toBe(second.ephemeralPublicKey);
    expect(first.iv).not.toBe(second.iv);
  });

  it("refuses a payload over the size limit", () => {
    const target = generateRecipientKeyPair();
    expect(() =>
      sealEnvelope({
        plaintext: Buffer.alloc(MAX_CIPHERTEXT_BYTES + 1, 0x41),
        recipientPublicKey: target.publicKey,
        aad: buildTransferAad(binding()),
      }),
    ).toThrow();
  });
});

describe("attacks the envelope must reject", () => {
  const target = generateRecipientKeyPair();
  const aad = buildTransferAad(binding());
  const envelope = sealEnvelope({ plaintext: PII, recipientPublicKey: target.publicKey, aad });

  it("rejects the wrong recipient's private key", () => {
    const attacker = generateRecipientKeyPair();
    expect(() =>
      openEnvelope({ envelope, recipientPrivateKey: attacker.privateKey, aad }),
    ).toThrow();
  });

  it("rejects modified ciphertext", () => {
    const bytes = Buffer.from(envelope.ciphertext, "base64");
    bytes[0] ^= 0x01;

    expect(() =>
      openEnvelope({
        envelope: { ...envelope, ciphertext: bytes.toString("base64") },
        recipientPrivateKey: target.privateKey,
        aad,
      }),
    ).toThrow();
  });

  it("rejects a modified authentication tag", () => {
    const tag = Buffer.from(envelope.authTag, "base64");
    tag[0] ^= 0x01;

    expect(() =>
      openEnvelope({
        envelope: { ...envelope, authTag: tag.toString("base64") },
        recipientPrivateKey: target.privateKey,
        aad,
      }),
    ).toThrow();
  });

  it("rejects a substituted ephemeral public key", () => {
    const other = generateRecipientKeyPair();
    expect(() =>
      openEnvelope({
        envelope: { ...envelope, ephemeralPublicKey: other.publicKey },
        recipientPrivateKey: target.privateKey,
        aad,
      }),
    ).toThrow();
  });

  it("rejects the same ciphertext replayed under a different authorisation", () => {
    // Byte-identical envelope, different AAD: this is what stops an intercepted
    // envelope being re-submitted against a fresh authorisation.
    const replayed = buildTransferAad(
      binding({ authorisationId: "22222222-2222-4222-8222-222222222222", nonce: "nonce-b" }),
    );

    expect(() =>
      openEnvelope({ envelope, recipientPrivateKey: target.privateKey, aad: replayed }),
    ).toThrow();
  });

  it("rejects an envelope redirected to a different recipient", () => {
    const redirected = buildTransferAad(binding({ recipientCode: "some-other-bank" }));
    expect(() =>
      openEnvelope({ envelope, recipientPrivateKey: target.privateKey, aad: redirected }),
    ).toThrow();
  });

  it("rejects an envelope re-labelled with a different purpose", () => {
    const relabelled = buildTransferAad(binding({ purposeCode: "marketing" }));
    expect(() =>
      openEnvelope({ envelope, recipientPrivateKey: target.privateKey, aad: relabelled }),
    ).toThrow();
  });

  it("rejects an envelope re-pointed at a different principal", () => {
    const swapped = buildTransferAad(binding({ principalExternalId: "someone-else" }));
    expect(() =>
      openEnvelope({ envelope, recipientPrivateKey: target.privateKey, aad: swapped }),
    ).toThrow();
  });
});

describe("envelope shape validation", () => {
  it("accepts a real envelope and rejects malformed ones", () => {
    const target = generateRecipientKeyPair();
    const envelope = sealEnvelope({
      plaintext: "x",
      recipientPublicKey: target.publicKey,
      aad: buildTransferAad(binding()),
    });

    expect(isSealedEnvelope(envelope)).toBe(true);
    expect(isSealedEnvelope(null)).toBe(false);
    expect(isSealedEnvelope({})).toBe(false);
    expect(isSealedEnvelope({ ...envelope, iv: "AAAA" })).toBe(false);
    expect(isSealedEnvelope({ ...envelope, authTag: "AAAA" })).toBe(false);
    expect(isSealedEnvelope({ ...envelope, ciphertext: "" })).toBe(false);
    expect(isSealedEnvelope({ ...envelope, ephemeralPublicKey: "" })).toBe(false);
  });
});

describe("additional authenticated data", () => {
  it("is deterministic for the same binding", () => {
    expect(buildTransferAad(binding())).toEqual(buildTransferAad(binding()));
  });

  it("changes when any field changes", () => {
    const base = buildTransferAad(binding()).toString("utf8");
    const fields: Array<Partial<TransferBinding>> = [
      { authorisationId: "other" },
      { nonce: "other" },
      { purposeCode: "other" },
      { recipientCode: "other" },
      { principalExternalId: "other" },
    ];

    for (const field of fields) {
      expect(buildTransferAad(binding(field)).toString("utf8")).not.toBe(base);
    }
  });
});
