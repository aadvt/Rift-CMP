/**
 * Key configuration, and the ways a private key could escape.
 *
 * Two jobs. The first is that a misconfigured key ring fails loudly rather than
 * silently producing unsigned proofs that look signed. The second is the one
 * that actually matters: nothing this module exposes to a response may ever
 * contain private material.
 *
 * The leakage tests deliberately do not assert on a field list. A test that says
 * "the status object has these four keys" passes right up until somebody adds a
 * fifth, which is exactly the change that would leak. They search the serialised
 * value for key material instead, so they keep working when the shape changes.
 */
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activeSigningKey,
  assertNoPrivateMaterial,
  proofKeyProblems,
  proofKeyStatus,
  resetProofKeys,
  verificationKeyRing,
} from "@/lib/proof-keys";

function pair() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

function clear() {
  delete process.env.RIFT_PROOF_SIGNING_KEY;
  delete process.env.RIFT_PROOF_KEY_ID;
  delete process.env.RIFT_PROOF_PUBLIC_KEYS;
  resetProofKeys();
}

beforeEach(clear);
afterEach(clear);

function configure(over: Record<string, string | undefined> = {}) {
  const keys = pair();
  process.env.RIFT_PROOF_SIGNING_KEY = over.signing ?? keys.privatePem;
  process.env.RIFT_PROOF_KEY_ID = over.keyId ?? "k-1";
  if (over.ring !== undefined) process.env.RIFT_PROOF_PUBLIC_KEYS = over.ring;
  resetProofKeys();
  return keys;
}

// ─── Loading ─────────────────────────────────────────────────────────────────

describe("loading keys", () => {
  it("reports no key as no key, without complaining", () => {
    // Unconfigured is a supported state, not an error. Refusing to record
    // consent because an optional hardening feature is off would make it
    // load-bearing for the product's core function.
    expect(activeSigningKey()).toBeNull();
    expect(proofKeyProblems()).toEqual([]);
    expect(proofKeyStatus().signing_configured).toBe(false);
  });

  it("loads a PEM private key", () => {
    configure();
    expect(activeSigningKey()?.keyId).toBe("k-1");
  });

  it("accepts base64 of a PEM", () => {
    // A PEM has newlines, and newlines survive neither a `.env` file nor most
    // secret managers. Rejecting base64 would be a support ticket per customer.
    const keys = pair();
    configure({ signing: Buffer.from(keys.privatePem, "utf8").toString("base64") });
    expect(activeSigningKey()).not.toBeNull();
  });

  it("derives the public key when the ring does not carry it", () => {
    // Otherwise a first deployment signs proofs it cannot verify, which looks
    // exactly like tampering.
    configure();
    const ring = verificationKeyRing();
    expect(ring.keys.map((k) => k.keyId)).toContain("k-1");
  });

  it("keeps every key in the ring so old proofs stay verifiable", () => {
    const old = pair();
    configure({
      ring: JSON.stringify([{ keyId: "k-old", publicKey: old.publicPem }]),
    });

    const ids = verificationKeyRing().keys.map((k) => k.keyId);
    expect(ids).toContain("k-old");
    expect(ids).toContain("k-1");
  });

  it("names the active key without making it the only one", () => {
    const old = pair();
    configure({ ring: JSON.stringify([{ keyId: "k-old", publicKey: old.publicPem }]) });

    const status = proofKeyStatus();
    expect(status.active_key_id).toBe("k-1");
    expect(status.known_keys.find((k) => k.key_id === "k-old")?.active).toBe(false);
  });
});

// ─── Misconfiguration ────────────────────────────────────────────────────────

describe("misconfiguration is loud", () => {
  it("rejects a private key with no id", () => {
    // Without an id a proof cannot say which key made it, and rotation becomes
    // impossible after the fact.
    const keys = pair();
    process.env.RIFT_PROOF_SIGNING_KEY = keys.privatePem;
    delete process.env.RIFT_PROOF_KEY_ID;
    resetProofKeys();

    expect(activeSigningKey()).toBeNull();
    expect(proofKeyProblems().some((p) => /nothing can be rotated/i.test(p.message))).toBe(true);
  });

  it("rejects a key that is not a PEM", () => {
    configure({ signing: "obviously not a key" });
    expect(activeSigningKey()).toBeNull();
    expect(proofKeyProblems().length).toBeGreaterThan(0);
  });

  it("rejects a key of the wrong algorithm", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    configure({ signing: rsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString() });

    expect(activeSigningKey()).toBeNull();
    expect(proofKeyProblems().some((p) => /Ed25519/i.test(p.message))).toBe(true);
  });

  it("rejects a ring that is not JSON", () => {
    configure({ ring: "not json at all" });
    expect(proofKeyProblems().some((p) => /valid JSON/i.test(p.message))).toBe(true);
  });

  it("rejects a ring entry with an unparseable public key", () => {
    configure({ ring: JSON.stringify([{ keyId: "k-bad", publicKey: "garbage" }]) });
    expect(proofKeyProblems().length).toBeGreaterThan(0);
    expect(verificationKeyRing().keys.map((k) => k.keyId)).not.toContain("k-bad");
  });

  it("refuses to sign with a key marked revoked", () => {
    const keys = pair();
    process.env.RIFT_PROOF_SIGNING_KEY = keys.privatePem;
    process.env.RIFT_PROOF_KEY_ID = "k-leaked";
    process.env.RIFT_PROOF_PUBLIC_KEYS = JSON.stringify([
      { keyId: "k-leaked", publicKey: keys.publicPem, revoked: true },
    ]);
    resetProofKeys();

    expect(activeSigningKey()).toBeNull();
    expect(proofKeyProblems().some((p) => /revoked/i.test(p.message))).toBe(true);
  });

  it("keeps a revoked key in the ring so old proofs still resolve", () => {
    // Deleting it would turn "signature genuine, key revoked" into "unknown
    // key" — different facts an auditor needs to tell apart.
    const keys = pair();
    configure({
      ring: JSON.stringify([{ keyId: "k-leaked", publicKey: keys.publicPem, revoked: true }]),
    });

    const entry = verificationKeyRing().keys.find((k) => k.keyId === "k-leaked");
    expect(entry?.revoked).toBe(true);
  });
});

// ─── Leakage ─────────────────────────────────────────────────────────────────

describe("private material never leaves", () => {
  it("keeps the private key out of the status object", () => {
    const keys = configure();
    const serialised = JSON.stringify(proofKeyStatus());

    expect(serialised).not.toContain("PRIVATE KEY");
    // A slice from the middle, so this fails for any encoding that preserves it.
    expect(serialised).not.toContain(keys.privatePem.slice(60, 100));
  });

  it("keeps the private key out of the verification ring", () => {
    // The ring is handed to anything that verifies, including an endpoint an
    // auditor calls. It must be public material only.
    const keys = configure();
    const serialised = JSON.stringify(verificationKeyRing());

    expect(serialised).not.toContain("PRIVATE KEY");
    expect(serialised).not.toContain(keys.privatePem.slice(60, 100));
    expect(serialised).toContain("PUBLIC KEY");
  });

  it("refuses to serve a body containing a private key", () => {
    const keys = pair();
    expect(() =>
      assertNoPrivateMaterial({ proof: {}, leaked: keys.privatePem }),
    ).toThrow(/private key material/i);
  });

  it("refuses a body carrying the internal field name", () => {
    // Catches somebody spreading a `SigningKey` into a response.
    expect(() => assertNoPrivateMaterial({ privateKeyPem: "x" })).toThrow();
  });

  it("allows a body carrying only a key id", () => {
    expect(() => assertNoPrivateMaterial({ key_id: "k-1", proof: { facts: {} } })).not.toThrow();
  });

  it("allows a body carrying a public key", () => {
    const keys = pair();
    expect(() => assertNoPrivateMaterial({ publicKey: keys.publicPem })).not.toThrow();
  });

  it("copes with a body that is null or empty", () => {
    expect(() => assertNoPrivateMaterial(null)).not.toThrow();
    expect(() => assertNoPrivateMaterial(undefined)).not.toThrow();
  });
});
