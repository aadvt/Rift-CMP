import type { ConsentEvidence } from "@rift-cmp/shared/consent-proof";
import {
  PROOF_CAVEAT,
  PROOF_VERSION_V1,
  proofDigest,
  type SignedConsentProof,
} from "@rift-cmp/shared/consent-signature";

/**
 * Rebuilding a stored proof for the wire.
 *
 * The proof was signed once, at write time, over the canonical document. What is
 * stored is the signature and the chain links — not the document, because the
 * document is entirely derivable from the row and storing it twice would create
 * two copies that can disagree.
 *
 * So this reassembles it. The reassembly must be exact: if it differs from what
 * was signed by a single byte, the signature fails to verify and an honest
 * record looks forged. That is the one thing this file has to get right, and it
 * is why the digest is recomputed here and compared against the stored one
 * rather than simply trusted — a mismatch means the reassembly drifted from the
 * signer, and it is better to say so than to serve a proof that will not verify.
 */

export interface ProofRow {
  id: string;
  siteId: string;
  status: string;
  decidedAt: Date;
  noticeId: string | null;
  policyVersionId: string | null;
  policyConfigVersion: string | null;
  jurisdictions: string[];
  vendors: string[];
  mechanism: string | null;
  source: string;
  proofHash: string | null;
  proofSignature: string | null;
  proofKeyId: string | null;
  proofDocumentHash: string | null;
  proofPreviousHash: string | null;
  proofSequence: number | null;
  proofVersion: string | null;
  experimentId: string | null;
  variantKey: string | null;
  purpose: { code: string };
  principal: { externalId: string };
}

export interface BuiltProof {
  /** Null for a record written before proofs existed. */
  proof: SignedConsentProof | null;
  evidence: ConsentEvidence;
  /**
   * Set when the reassembled document does not match the digest that was stored
   * with it. Serving the proof anyway would look like tampering to the verifier.
   */
  reassemblyMismatch: boolean;
}

export function evidenceFor(record: ProofRow): ConsentEvidence {
  return {
    siteId: record.siteId,
    principalExternalId: record.principal.externalId,
    purposeCode: record.purpose.code,
    status: record.status,
    decidedAt: record.decidedAt,
    noticeId: record.noticeId,
    policyVersionId: record.policyVersionId,
    policyConfigVersion: record.policyConfigVersion,
    jurisdictions: record.jurisdictions,
    vendors: record.vendors,
    mechanism: record.mechanism,
    source: record.source,
  };
}

export function proofFor(record: ProofRow): BuiltProof {
  const evidence = evidenceFor(record);

  // A record from before Phase 11B has a receipt digest and no proof. That is a
  // real state and is reported as one: an absent proof is not an invalid proof.
  if (record.proofSequence === null || record.proofDocumentHash === null) {
    return { proof: null, evidence, reassemblyMismatch: false };
  }

  // The scheme that signed it. Null means the original one: every record
  // written before proof versioning existed was signed under `/1`, and
  // rebuilding it under a newer canonical form would break a signature that is
  // perfectly good.
  const version = (record.proofVersion ?? PROOF_VERSION_V1) as SignedConsentProof["version"];

  const facts = {
    consentRecordId: record.id,
    siteId: record.siteId,
    principalExternalId: record.principal.externalId,
    purposeCode: record.purpose.code,
    status: record.status,
    decidedAt: record.decidedAt.toISOString(),
    policyVersionId: record.policyVersionId,
    policyConfigVersion: record.policyConfigVersion,
    jurisdictions: record.jurisdictions,
    receiptHash: record.proofHash ?? "",
    sequence: record.proofSequence,
    previousProofHash: record.proofPreviousHash,
    experimentId: record.experimentId,
    variantKey: record.variantKey,
  };

  const recomputed = proofDigest(facts, version);

  return {
    proof: {
      version,
      facts,
      proofHash: record.proofDocumentHash,
      signature: record.proofSignature
        ? {
            algorithm: "ed25519",
            keyId: record.proofKeyId ?? "unknown",
            value: record.proofSignature,
          }
        : null,
      caveat: PROOF_CAVEAT,
      legal_advice: false,
    },
    evidence,
    reassemblyMismatch: recomputed !== record.proofDocumentHash,
  };
}

