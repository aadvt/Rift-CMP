/**
 * Signed consent proofs: integrity, authenticity, and ordering, kept apart.
 *
 * ## Three different claims, three different mechanisms
 *
 * `consent-proof.ts` already computes a receipt digest, and its own header is
 * careful about what that digest is worth: it is a receipt, not a signature, and
 * it evidences nothing against a party who can write the table. That was true
 * and it stays true — this module does not replace it, it stands on it.
 *
 * What is added here is the two claims the digest could never make:
 *
 *   **Integrity** — the receipt digest, unchanged. Recompute it from the facts
 *   and compare. Detects modification by anyone who cannot recompute it, which
 *   is to say by accident and by a third party.
 *
 *   **Authenticity** — an Ed25519 signature over a canonical proof document,
 *   produced by a private key that never leaves the server. This is the claim
 *   the digest could not make, and it is the one that matters against the
 *   fiduciary: recomputing the hash is free, forging the signature is not.
 *
 *   **Ordering** — each proof names the digest of the previous proof for the
 *   same principal on the same site, plus a sequence number. Removing a decision
 *   from the middle of somebody's history now leaves a hole that verification
 *   finds, which an append-only trigger alone cannot demonstrate to an outsider.
 *
 * The three are reported separately by the verifier and must never be collapsed
 * into one boolean. A proof with valid integrity and an unknown key is a
 * different situation from one with a broken chain, and an operator who is shown
 * "invalid" for both cannot act on either.
 *
 * ## What a valid signature does not mean
 *
 * It means this document was produced by the holder of that key and has not been
 * altered since. It does **not** mean the consent was lawfully obtained, that
 * the notice was adequate, that the policy was configured correctly, or that the
 * person understood what they agreed to. Those are questions about the world,
 * and no amount of cryptography reaches them. `PROOF_CAVEAT` travels on every
 * proof for the same reason the receipt carries its own.
 *
 * ## Canonicalisation
 *
 * Field order is fixed and explicit, never object iteration order, and every
 * value is normalised before it is hashed or signed. The same logical receipt
 * must produce the same bytes in any runtime, or a signature made on one machine
 * fails to verify on another and the failure means nothing.
 */

import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import type { ConsentEvidence } from "./consent-proof";
import { proofHash } from "./consent-proof";

export const PROOF_VERSION = "rift-consent-proof/1";
/** Versions this build can verify. An unknown version is reported, never guessed at. */
export const SUPPORTED_PROOF_VERSIONS = [PROOF_VERSION] as const;

export const PROOF_CAVEAT =
  "A valid signature shows this proof was produced by the holder of the named " +
  "key and has not been altered since. It does not show that the consent was " +
  "lawfully obtained, that the notice was adequate, that the configuration was " +
  "correct, or that the person understood it. Those are not cryptographic " +
  "questions and this proof does not answer them.";

// ─── The proof document ──────────────────────────────────────────────────────

/**
 * The facts a proof binds.
 *
 * Deliberately no more than the receipt already carries. A signature over extra
 * personal data would make the proof itself a disclosure risk, and the thing
 * being evidenced — that this decision was recorded, in this state, under this
 * configuration, at this time — needs none of it.
 */
export interface ConsentProofFacts {
  consentRecordId: string;
  siteId: string;
  /** The opaque per-site principal id. Never an email, never an address. */
  principalExternalId: string;
  purposeCode: string;
  status: string;
  decidedAt: string;
  policyVersionId: string | null;
  policyConfigVersion: string | null;
  jurisdictions: readonly string[];
  /** The receipt digest from `consent-proof.ts`. Integrity travels inside the proof. */
  receiptHash: string;
  /** Position in this principal's chain on this site. 1-based. */
  sequence: number;
  /** The digest of the previous proof in the chain, or null for the first. */
  previousProofHash: string | null;
}

export interface SignedConsentProof {
  version: typeof PROOF_VERSION;
  facts: ConsentProofFacts;
  /** Digest of the canonical document. This is what the next proof links to. */
  proofHash: string;
  /** Null when no signing key is configured; the proof is then integrity-only. */
  signature: {
    algorithm: "ed25519";
    /** Identifies the key, so rotation does not strand old proofs. */
    keyId: string;
    /** base64url over the canonical document. */
    value: string;
  } | null;
  caveat: string;
  legal_advice: false;
}

/**
 * The canonical bytes.
 *
 * Exported because a verification procedure nobody outside this repository can
 * carry out is not a verification procedure. Anyone holding a proof, the public
 * key and this function can check it without us.
 */
export function canonicalProof(facts: ConsentProofFacts): string {
  const jurisdictions = [...facts.jurisdictions].map((j) => j.trim()).sort();

  return [
    PROOF_VERSION,
    facts.consentRecordId,
    facts.siteId,
    facts.principalExternalId,
    facts.purposeCode,
    facts.status,
    new Date(facts.decidedAt).toISOString(),
    facts.policyVersionId ?? "",
    facts.policyConfigVersion ?? "",
    jurisdictions.join(","),
    facts.receiptHash,
    String(facts.sequence),
    facts.previousProofHash ?? "",
  ].join("\n");
}

/** The digest of a proof document. The chain link. */
export function proofDigest(facts: ConsentProofFacts): string {
  return createHash("sha256").update(canonicalProof(facts), "utf8").digest("hex");
}

// ─── Keys ────────────────────────────────────────────────────────────────────

export interface SigningKey {
  keyId: string;
  /** PKCS#8 PEM. Never leaves the server, never logged, never returned by an API. */
  privateKeyPem: string;
}

export interface VerificationKey {
  keyId: string;
  /** SPKI PEM. Safe to publish — that is the point of it. */
  publicKeyPem: string;
  /**
   * A revoked key stops being trusted for *new* verification outcomes.
   *
   * It is kept rather than deleted so a proof made under it still reports
   * "signature valid, key revoked" instead of "unknown key" — those are
   * different facts and an auditor needs to be able to tell them apart.
   */
  revoked?: boolean;
}

/** A public key set: the active signer plus every retired key still trusted. */
export interface KeyRing {
  activeKeyId: string | null;
  keys: readonly VerificationKey[];
}

// ─── Signing ─────────────────────────────────────────────────────────────────

/**
 * Build a proof, signing it when a key is available.
 *
 * With no key the proof is still issued and still carries integrity and chain
 * links — it simply says `signature: null`. Refusing to record consent because
 * a signing key was not configured would make an optional hardening feature
 * load-bearing for the product's core function, which is the wrong trade.
 */
export function buildProof(
  facts: Omit<ConsentProofFacts, "receiptHash">,
  evidence: ConsentEvidence,
  key: SigningKey | null,
): SignedConsentProof {
  const complete: ConsentProofFacts = { ...facts, receiptHash: proofHash(evidence) };
  const canonical = canonicalProof(complete);

  let signature: SignedConsentProof["signature"] = null;
  if (key) {
    const privateKey = createPrivateKey(key.privateKeyPem);
    // Ed25519 takes no separate digest algorithm; `null` is the documented and
    // only correct value here.
    const value = sign(null, Buffer.from(canonical, "utf8"), privateKey);
    signature = { algorithm: "ed25519", keyId: key.keyId, value: value.toString("base64url") };
  }

  return {
    version: PROOF_VERSION,
    facts: complete,
    proofHash: createHash("sha256").update(canonical, "utf8").digest("hex"),
    signature,
    caveat: PROOF_CAVEAT,
    legal_advice: false,
  };
}

// ─── Verification ────────────────────────────────────────────────────────────

export type IntegrityResult = "valid" | "invalid";
export type SignatureResult =
  | "valid"
  | "invalid"
  | "unsigned"
  | "unknown_key"
  | "revoked_key";
export type ChainResult = "valid" | "broken" | "unverifiable";

export interface ProofVerification {
  ok: boolean;
  version: string;
  /** Set when the proof could not be read at all; every other field is then null. */
  malformed: string | null;
  unsupportedVersion: boolean;
  integrity: IntegrityResult | null;
  signature: SignatureResult | null;
  keyId: string | null;
  chain: ChainResult | null;
  /** One line per finding, in the order they were checked. */
  findings: string[];
  caveat: string;
  legal_advice: false;
}

function malformed(reason: string, version = "unknown"): ProofVerification {
  return {
    ok: false,
    version,
    malformed: reason,
    unsupportedVersion: false,
    integrity: null,
    signature: null,
    keyId: null,
    chain: null,
    findings: [reason],
    caveat: PROOF_CAVEAT,
    legal_advice: false,
  };
}

/**
 * Check a proof.
 *
 * Needs only public material: the proof, the evidence it claims to cover, the
 * public key ring, and — for the chain — the previous proof's digest. A caller
 * who cannot supply the previous digest gets `chain: "unverifiable"`, which is
 * not the same as `"valid"` and is deliberately not reported as a pass.
 */
export function verifySignedProof(input: {
  proof: unknown;
  /** The record as it stands now, to recompute integrity against. */
  evidence: ConsentEvidence;
  keyRing: KeyRing;
  /**
   * The digest of the proof that should precede this one, as the store holds it.
   * `null` asserts this is the first proof in the chain; `undefined` means the
   * caller does not know, and the chain is reported unverifiable.
   */
  expectedPreviousProofHash?: string | null;
}): ProofVerification {
  const { proof } = input;

  if (typeof proof !== "object" || proof === null) {
    return malformed("The proof is not an object.");
  }

  const candidate = proof as Partial<SignedConsentProof>;
  const version = typeof candidate.version === "string" ? candidate.version : "unknown";

  if (!candidate.facts || typeof candidate.facts !== "object") {
    return malformed("The proof carries no facts.", version);
  }
  if (typeof candidate.proofHash !== "string") {
    return malformed("The proof carries no digest.", version);
  }

  if (!(SUPPORTED_PROOF_VERSIONS as readonly string[]).includes(version)) {
    // Not malformed — it may be perfectly valid under a scheme this build does
    // not know. Reporting it as invalid would be a lie about somebody's proof.
    return {
      ok: false,
      version,
      malformed: null,
      unsupportedVersion: true,
      integrity: null,
      signature: null,
      keyId: null,
      chain: null,
      findings: [
        `This build understands ${SUPPORTED_PROOF_VERSIONS.join(", ")} and cannot check "${version}".`,
      ],
      caveat: PROOF_CAVEAT,
      legal_advice: false,
    };
  }

  const facts = candidate.facts as ConsentProofFacts;
  const findings: string[] = [];

  // ── Integrity ──
  //
  // Two checks, and both are needed. The receipt hash must match the record as
  // it stands now, or the record changed after the proof was made; and the
  // proof digest must match the document, or the document itself was edited.
  const expectedReceipt = proofHash(input.evidence);
  const recomputed = proofDigest(facts);

  let integrity: IntegrityResult = "valid";
  if (facts.receiptHash !== expectedReceipt) {
    integrity = "invalid";
    findings.push("The record does not match the receipt digest this proof was made over.");
  }
  if (recomputed !== candidate.proofHash) {
    integrity = "invalid";
    findings.push("The proof document does not match its own digest.");
  }
  if (integrity === "valid") findings.push("The record matches the proof.");

  // ── Authenticity ──
  let signatureResult: SignatureResult;
  let keyId: string | null = null;

  const sig = candidate.signature ?? null;
  if (!sig) {
    signatureResult = "unsigned";
    findings.push("This proof is not signed, so it evidences integrity only.");
  } else {
    keyId = sig.keyId;
    const key = input.keyRing.keys.find((k) => k.keyId === sig.keyId) ?? null;
    if (!key) {
      signatureResult = "unknown_key";
      findings.push(`No public key is held for "${sig.keyId}", so the signature cannot be checked.`);
    } else {
      let good = false;
      try {
        good = verify(
          null,
          Buffer.from(canonicalProof(facts), "utf8"),
          createPublicKey(key.publicKeyPem),
          Buffer.from(sig.value, "base64url"),
        );
      } catch {
        // A malformed signature or key fails closed. It is never a pass.
        good = false;
      }

      if (!good) {
        signatureResult = "invalid";
        findings.push("The signature does not verify against the named key.");
      } else if (key.revoked) {
        signatureResult = "revoked_key";
        findings.push(
          `The signature is genuine, but "${sig.keyId}" has been revoked. It still shows what was signed and when it was recorded.`,
        );
      } else {
        signatureResult = "valid";
        findings.push(`The signature verifies against "${sig.keyId}".`);
      }
    }
  }

  // ── Ordering ──
  let chain: ChainResult;
  if (input.expectedPreviousProofHash === undefined) {
    chain = "unverifiable";
    findings.push("The preceding proof was not supplied, so ordering was not checked.");
  } else if ((facts.previousProofHash ?? null) === (input.expectedPreviousProofHash ?? null)) {
    chain = "valid";
    findings.push(
      facts.previousProofHash === null
        ? "This is the first recorded decision for this person on this site."
        : "It links to the preceding proof.",
    );
  } else {
    chain = "broken";
    findings.push(
      "It does not link to the proof that precedes it. A decision may have been removed, reordered, or inserted.",
    );
  }

  return {
    ok:
      integrity === "valid" &&
      (signatureResult === "valid" || signatureResult === "unsigned") &&
      chain !== "broken",
    version,
    malformed: null,
    unsupportedVersion: false,
    integrity,
    signature: signatureResult,
    keyId,
    chain,
    findings,
    caveat: PROOF_CAVEAT,
    legal_advice: false,
  };
}
