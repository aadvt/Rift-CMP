/**
 * Signed proofs, checked with real cryptography.
 *
 * Every key in this file is generated at run time and every signature is a real
 * Ed25519 signature over real bytes. Nothing is mocked, because a mocked
 * verifier tests that the test agrees with itself: the entire value of this
 * subsystem is that `verify` returns false when it should, and a stub that
 * returns `true` cannot demonstrate that.
 *
 * The tests are organised around the three claims the module makes, which are
 * deliberately separate and must never collapse into one boolean:
 *
 *   integrity   — the record still matches the proof.
 *   authenticity— a named key produced the proof.
 *   ordering    — this decision sits where it says in the person's history.
 *
 * A proof can be genuine and yet sit in a broken chain, or have perfect
 * integrity and an unknown signer. Each of those is a different thing to tell an
 * operator, and reporting either as a flat "invalid" would leave them unable to
 * act.
 */
import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ConsentEvidence } from "@rift-cmp/shared/consent-proof";
import { proofHash } from "@rift-cmp/shared/consent-proof";
import {
  PROOF_VERSION,
  PROOF_VERSION_V1,
  buildProof,
  canonicalProof,
  proofDigest,
  verifySignedProof,
  type ConsentProofFacts,
  type KeyRing,
  type SignedConsentProof,
  type SigningKey,
} from "@rift-cmp/shared/consent-signature";

function keypair(keyId: string): { signing: SigningKey; verification: KeyRing["keys"][number] } {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    signing: {
      keyId,
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    },
    verification: {
      keyId,
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    },
  };
}

const DECIDED = new Date("2026-04-01T10:00:00.000Z");

function evidence(over: Partial<ConsentEvidence> = {}): ConsentEvidence {
  return {
    siteId: "site-1",
    principalExternalId: "principal-1",
    purposeCode: "analytics",
    status: "GRANTED",
    decidedAt: DECIDED,
    noticeId: null,
    policyVersionId: "pv-1",
    policyConfigVersion: "v3",
    jurisdictions: ["EU"],
    vendors: ["Google Analytics"],
    mechanism: "banner",
    source: "sdk",
    ...over,
  };
}

function facts(over: Partial<ConsentProofFacts> = {}): Omit<ConsentProofFacts, "receiptHash"> {
  return {
    consentRecordId: "record-1",
    siteId: "site-1",
    principalExternalId: "principal-1",
    purposeCode: "analytics",
    status: "GRANTED",
    decidedAt: DECIDED.toISOString(),
    policyVersionId: "pv-1",
    policyConfigVersion: "v3",
    jurisdictions: ["EU"],
    sequence: 1,
    previousProofHash: null,
    ...over,
  };
}

const alice = keypair("k-2026-04");
const ring: KeyRing = { activeKeyId: alice.signing.keyId, keys: [alice.verification] };

function proofFor(
  over: Partial<ConsentProofFacts> = {},
  ev: Partial<ConsentEvidence> = {},
  key: SigningKey | null = alice.signing,
) {
  return buildProof(facts(over), evidence(ev), key);
}

// ─── Canonicalisation ────────────────────────────────────────────────────────

describe("canonicalisation", () => {
  it("produces identical bytes for the same logical proof", () => {
    expect(canonicalProof(proofFor().facts)).toBe(canonicalProof(proofFor().facts));
  });

  it("does not depend on the order jurisdictions arrived in", () => {
    const a = proofFor({ jurisdictions: ["EU", "IN"] });
    const b = proofFor({ jurisdictions: ["IN", "EU"] });
    expect(canonicalProof(a.facts)).toBe(canonicalProof(b.facts));
  });

  it("normalises the timestamp so two spellings of one instant agree", () => {
    const a = proofFor({ decidedAt: "2026-04-01T10:00:00.000Z" });
    const b = proofFor({ decidedAt: "2026-04-01T10:00:00Z" });
    expect(a.proofHash).toBe(b.proofHash);
  });

  it("names its version first, so a reader knows what they are holding", () => {
    expect(canonicalProof(proofFor().facts).startsWith(PROOF_VERSION)).toBe(true);
  });

  it("changes the digest when any bound fact changes", () => {
    const base = proofFor().proofHash;
    const variants: Array<Partial<ConsentProofFacts>> = [
      { consentRecordId: "record-2" },
      { siteId: "site-2" },
      { principalExternalId: "principal-2" },
      { purposeCode: "marketing" },
      { status: "DENIED" },
      { decidedAt: new Date("2026-04-01T10:00:01.000Z").toISOString() },
      { policyVersionId: "pv-2" },
      { policyConfigVersion: "v4" },
      { jurisdictions: ["IN"] },
      { sequence: 2 },
      { previousProofHash: "a".repeat(64) },
    ];
    for (const variant of variants) {
      expect(proofFor(variant).proofHash, JSON.stringify(variant)).not.toBe(base);
    }
  });

  it("binds the receipt, so changing the record changes the proof", () => {
    expect(proofFor({}, { vendors: ["Hotjar"] }).proofHash).not.toBe(proofFor().proofHash);
  });
});

// ─── Creation ────────────────────────────────────────────────────────────────

describe("creating a proof", () => {
  it("signs with the configured key", () => {
    const proof = proofFor();
    expect(proof.signature?.algorithm).toBe("ed25519");
    expect(proof.signature?.keyId).toBe("k-2026-04");
    expect(proof.signature?.value.length).toBeGreaterThan(0);
  });

  it("carries the receipt digest of the record it covers", () => {
    expect(proofFor().facts.receiptHash).toBe(proofHash(evidence()));
  });

  it("issues an unsigned proof when no key is configured", () => {
    // A missing signing key must not stop consent being recorded.
    const proof = proofFor({}, {}, null);
    expect(proof.signature).toBeNull();
    expect(proof.proofHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("says out loud that a signature is not a legal conclusion", () => {
    const proof = proofFor();
    expect(proof.legal_advice).toBe(false);
    expect(proof.caveat).toMatch(/lawfully obtained/i);
  });

  it("agrees with the standalone digest function", () => {
    const proof = proofFor();
    expect(proofDigest(proof.facts)).toBe(proof.proofHash);
  });
});

// ─── Verification ────────────────────────────────────────────────────────────

describe("verifying a genuine proof", () => {
  it("reports integrity, signature and chain separately", () => {
    const result = verifySignedProof({
      proof: proofFor(),
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.integrity).toBe("valid");
    expect(result.signature).toBe("valid");
    expect(result.chain).toBe("valid");
    expect(result.ok).toBe(true);
  });

  it("will not call the chain valid when it was not given one to check", () => {
    const result = verifySignedProof({ proof: proofFor(), evidence: evidence(), keyRing: ring });
    expect(result.chain).toBe("unverifiable");
    expect(result.findings.join(" ")).toMatch(/not supplied/i);
  });

  it("passes an unsigned proof as unsigned, never as signed", () => {
    const result = verifySignedProof({
      proof: proofFor({}, {}, null),
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.signature).toBe("unsigned");
    expect(result.integrity).toBe("valid");
    expect(result.findings.join(" ")).toMatch(/integrity only/i);
  });
});

describe("detecting tampering", () => {
  it("catches a record altered after the proof was made", () => {
    const proof = proofFor();
    // The proof is untouched and still internally consistent. What changed is
    // the row it describes, which is the realistic attack: edit the database,
    // leave the proof alone.
    const result = verifySignedProof({
      proof,
      evidence: evidence({ status: "DENIED" }),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.integrity).toBe("invalid");
    expect(result.ok).toBe(false);
    expect(result.findings.join(" ")).toMatch(/does not match the receipt/i);
  });

  it("catches an edited proof document", () => {
    const proof = proofFor();
    const tampered = {
      ...proof,
      facts: { ...proof.facts, status: "GRANTED_EVERYTHING" },
    } satisfies SignedConsentProof;

    const result = verifySignedProof({
      proof: tampered,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.integrity).toBe("invalid");
    // And the signature no longer covers these bytes.
    expect(result.signature).toBe("invalid");
  });

  it("catches a moved timestamp", () => {
    const proof = proofFor();
    const tampered = {
      ...proof,
      facts: { ...proof.facts, decidedAt: "2026-04-02T10:00:00.000Z" },
    };
    const result = verifySignedProof({
      proof: tampered,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });
    expect(result.signature).toBe("invalid");
  });

  it("catches a swapped policy version", () => {
    const proof = proofFor();
    const tampered = { ...proof, facts: { ...proof.facts, policyConfigVersion: "v99" } };
    const result = verifySignedProof({
      proof: tampered,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });
    expect(result.signature).toBe("invalid");
  });

  it("catches a signature borrowed from another proof", () => {
    // Proof substitution: take a genuine signature and staple it to a different
    // decision. Both are real, both were signed by us, and the pairing is not.
    const granted = proofFor({ consentRecordId: "record-1" });
    const denied = proofFor({ consentRecordId: "record-2" }, { status: "DENIED" });

    const substituted = { ...denied, signature: granted.signature };
    const result = verifySignedProof({
      proof: substituted,
      evidence: evidence({ status: "DENIED" }),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.signature).toBe("invalid");
    expect(result.ok).toBe(false);
  });

  it("catches a forged signature from a key we do not trust", () => {
    const attacker = keypair("k-2026-04");
    // Same key id, different key: the attacker is claiming to be our signer.
    const forged = buildProof(facts(), evidence(), attacker.signing);

    const result = verifySignedProof({
      proof: forged,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.signature).toBe("invalid");
    expect(result.ok).toBe(false);
  });

  it("rejects a corrupted signature rather than throwing", () => {
    const proof = proofFor();
    const result = verifySignedProof({
      proof: { ...proof, signature: { ...proof.signature!, value: "not-base64url-!!!" } },
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });
    expect(result.signature).toBe("invalid");
  });
});

// ─── Keys ────────────────────────────────────────────────────────────────────

describe("keys and rotation", () => {
  it("reports an unknown key as unknown, not as invalid", () => {
    // These are different facts. "We cannot check this" is not "this is forged",
    // and an operator shown the wrong one will draw the wrong conclusion.
    const result = verifySignedProof({
      proof: proofFor(),
      evidence: evidence(),
      keyRing: { activeKeyId: "k-other", keys: [keypair("k-other").verification] },
      expectedPreviousProofHash: null,
    });

    expect(result.signature).toBe("unknown_key");
  });

  it("still verifies a proof made under a retired key", () => {
    // The whole point of rotation: March's proofs must not become unverifiable
    // in June because a new key was introduced.
    const older = keypair("k-2026-01");
    const march = buildProof(facts(), evidence(), older.signing);

    const result = verifySignedProof({
      proof: march,
      evidence: evidence(),
      keyRing: {
        activeKeyId: alice.signing.keyId,
        keys: [alice.verification, older.verification],
      },
      expectedPreviousProofHash: null,
    });

    expect(result.signature).toBe("valid");
    expect(result.ok).toBe(true);
  });

  it("distinguishes a revoked key from an unknown one", () => {
    const revoked = keypair("k-leaked");
    const proof = buildProof(facts(), evidence(), revoked.signing);

    const result = verifySignedProof({
      proof,
      evidence: evidence(),
      keyRing: {
        activeKeyId: alice.signing.keyId,
        keys: [alice.verification, { ...revoked.verification, revoked: true }],
      },
      expectedPreviousProofHash: null,
    });

    // The signature is genuine and says so; the key is no longer trusted.
    expect(result.signature).toBe("revoked_key");
    expect(result.ok).toBe(false);
    expect(result.findings.join(" ")).toMatch(/genuine/i);
  });
});

// ─── Chaining ────────────────────────────────────────────────────────────────

describe("chaining", () => {
  /** Three decisions by one person, linked as the writer would link them. */
  function chain() {
    const first = proofFor({ consentRecordId: "r1", sequence: 1, previousProofHash: null });
    const second = proofFor(
      { consentRecordId: "r2", sequence: 2, previousProofHash: first.proofHash },
      { status: "WITHDRAWN" },
    );
    const third = proofFor(
      { consentRecordId: "r3", sequence: 3, previousProofHash: second.proofHash },
      { status: "GRANTED" },
    );
    return { first, second, third };
  }

  it("accepts a well-formed chain link", () => {
    const { first, second } = chain();
    const result = verifySignedProof({
      proof: second,
      evidence: evidence({ status: "WITHDRAWN" }),
      keyRing: ring,
      expectedPreviousProofHash: first.proofHash,
    });
    expect(result.chain).toBe("valid");
  });

  it("names the first decision as the first", () => {
    const { first } = chain();
    const result = verifySignedProof({
      proof: first,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });
    expect(result.findings.join(" ")).toMatch(/first recorded decision/i);
  });

  it("catches a decision removed from the middle", () => {
    // Delete the withdrawal, and the third proof no longer links to what now
    // precedes it. This is the property an append-only trigger cannot show an
    // outsider.
    const { first, third } = chain();
    const result = verifySignedProof({
      proof: third,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: first.proofHash,
    });

    expect(result.chain).toBe("broken");
    expect(result.ok).toBe(false);
    expect(result.findings.join(" ")).toMatch(/removed, reordered, or inserted/i);
  });

  it("catches a reordered chain", () => {
    const { first, second, third } = chain();
    const result = verifySignedProof({
      proof: second,
      evidence: evidence({ status: "WITHDRAWN" }),
      keyRing: ring,
      expectedPreviousProofHash: third.proofHash,
    });
    expect(result.chain).toBe("broken");
    void first;
  });

  it("keeps a genuine signature genuine even when the chain is broken", () => {
    // The two claims are independent, and flattening them would hide which one
    // actually failed.
    const { first, third } = chain();
    const result = verifySignedProof({
      proof: third,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: first.proofHash,
    });

    expect(result.signature).toBe("valid");
    expect(result.chain).toBe("broken");
  });
});

// ─── Malformed input ─────────────────────────────────────────────────────────

describe("malformed and unsupported proofs", () => {
  it.each([
    ["null", null],
    ["a string", "proof"],
    ["a number", 7],
    ["an array", []],
  ])("refuses %s without throwing", (_label, value) => {
    const result = verifySignedProof({ proof: value, evidence: evidence(), keyRing: ring });
    expect(result.ok).toBe(false);
    expect(result.malformed).toBeTruthy();
  });

  it("refuses a proof with no facts", () => {
    const result = verifySignedProof({
      proof: { version: PROOF_VERSION, proofHash: "x" },
      evidence: evidence(),
      keyRing: ring,
    });
    expect(result.malformed).toMatch(/no facts/i);
  });

  it("refuses a proof with no digest", () => {
    const result = verifySignedProof({
      proof: { version: PROOF_VERSION, facts: facts() },
      evidence: evidence(),
      keyRing: ring,
    });
    expect(result.malformed).toMatch(/no digest/i);
  });

  it("reports an unsupported version as unsupported, not as forged", () => {
    // A proof from a future scheme may be perfectly valid. Calling it invalid
    // would be a false statement about somebody's evidence.
    const proof = { ...proofFor(), version: "rift-consent-proof/9" };
    const result = verifySignedProof({
      proof,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.unsupportedVersion).toBe(true);
    expect(result.integrity).toBeNull();
    expect(result.signature).toBeNull();
    expect(result.ok).toBe(false);
  });
});

// ─── Secrets ─────────────────────────────────────────────────────────────────

describe("what a proof carries", () => {
  it("holds no private key material", () => {
    const serialised = JSON.stringify(proofFor());
    expect(serialised).not.toContain("PRIVATE KEY");
    expect(serialised).not.toContain(alice.signing.privateKeyPem.slice(40, 80));
  });

  it("holds no personal data beyond the opaque principal id", () => {
    const proof = proofFor();
    // The principal id is the same opaque per-site value the visitor's browser
    // already holds. Nothing else about the person is bound.
    expect(Object.keys(proof.facts)).toEqual([
      "consentRecordId",
      "siteId",
      "principalExternalId",
      "purposeCode",
      "status",
      "decidedAt",
      "policyVersionId",
      "policyConfigVersion",
      "jurisdictions",
      "sequence",
      "previousProofHash",
      "receiptHash",
    ]);
  });
});

// ─── Scheme versions ─────────────────────────────────────────────────────────

describe("proof schemes", () => {
  /**
   * `/2` added experiment attribution by appending two fields to the canonical
   * form. Appending changes bytes, and every byte of a `/1` document was already
   * signed — so the only thing keeping March's proofs verifiable in June is that
   * a `/1` document is still rebuilt under `/1`.
   *
   * These are the tests that fail if somebody "tidies up" by folding the two
   * forms into one.
   */

  it("writes new proofs under the current scheme", () => {
    expect(proofFor().version).toBe(PROOF_VERSION);
    expect(PROOF_VERSION).toBe("rift-consent-proof/2");
  });

  it("binds the experiment and the arm", () => {
    const withExperiment = proofFor({ experimentId: "exp-1", variantKey: "b" });
    const without = proofFor();
    expect(withExperiment.proofHash).not.toBe(without.proofHash);
  });

  it("distinguishes two arms of the same experiment", () => {
    // Otherwise a decision recorded under one banner's copy is
    // indistinguishable from one recorded under another's, and the experiment
    // result rests on attribution nobody can check.
    const a = proofFor({ experimentId: "exp-1", variantKey: "control" });
    const b = proofFor({ experimentId: "exp-1", variantKey: "b" });
    expect(a.proofHash).not.toBe(b.proofHash);
  });

  it("verifies a proof that carries an experiment", () => {
    const proof = proofFor({ experimentId: "exp-1", variantKey: "b" });
    const result = verifySignedProof({
      proof,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.integrity).toBe("valid");
    expect(result.signature).toBe("valid");
  });

  it("catches a swapped variant", () => {
    // Moving a decision from the losing arm to the winning one is the obvious
    // way to fake an experiment result. It is bound, so it is caught.
    const proof = proofFor({ experimentId: "exp-1", variantKey: "control" });
    const tampered = { ...proof, facts: { ...proof.facts, variantKey: "b" } };

    const result = verifySignedProof({
      proof: tampered,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.signature).toBe("invalid");
    expect(result.ok).toBe(false);
  });

  it("still verifies a proof written under the older scheme", () => {
    // Built and signed exactly as the previous release would have.
    const complete = { ...facts(), receiptHash: proofHash(evidence()) };
    const canonical = canonicalProof(complete, PROOF_VERSION_V1);
    const legacy = {
      version: PROOF_VERSION_V1,
      facts: complete,
      proofHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
      signature: {
        algorithm: "ed25519" as const,
        keyId: alice.signing.keyId,
        value: sign(null, Buffer.from(canonical, "utf8"), createPrivateKey(alice.signing.privateKeyPem)).toString("base64url"),
      },
      caveat: "",
      legal_advice: false as const,
    };

    const result = verifySignedProof({
      proof: legacy,
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });

    expect(result.integrity).toBe("valid");
    expect(result.signature).toBe("valid");
    expect(result.ok).toBe(true);
  });

  it("produces different bytes for the two schemes", () => {
    const complete = { ...facts(), receiptHash: proofHash(evidence()) };
    expect(canonicalProof(complete, PROOF_VERSION_V1)).not.toBe(
      canonicalProof(complete, PROOF_VERSION),
    );
  });

  it("leaves the older form untouched by the new fields", () => {
    // A `/1` document must not change when experiment attribution is present:
    // that is precisely the byte change that would break historical proofs.
    const base = { ...facts(), receiptHash: proofHash(evidence()) };
    const withExperiment = { ...base, experimentId: "exp-1", variantKey: "b" };

    expect(canonicalProof(base, PROOF_VERSION_V1)).toBe(
      canonicalProof(withExperiment, PROOF_VERSION_V1),
    );
  });

  it("still reports a genuinely unknown scheme as unsupported", () => {
    const result = verifySignedProof({
      proof: { ...proofFor(), version: "rift-consent-proof/99" },
      evidence: evidence(),
      keyRing: ring,
      expectedPreviousProofHash: null,
    });
    expect(result.unsupportedVersion).toBe(true);
  });
});
