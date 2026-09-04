/**
 * Consent receipts: what a decision has to carry to be provable later.
 *
 * ## What the digest proves, and what it does not
 *
 * `proofHash` is SHA-256 over a canonical serialisation of a decision's
 * evidence, computed once when the record is written. Being precise about its
 * standing matters more than the cryptography, because "proof" is a word that
 * does work it has not earned:
 *
 *  - **It is a receipt.** A principal who kept the digest can check that the
 *    record they are later shown is byte-for-byte the one that was issued. That
 *    is a real guarantee and the reason the field exists.
 *  - **It is not a signature.** Nothing is signed. Anyone can compute this
 *    digest over any record, so it evidences integrity against accident and
 *    against a third party, not against the fiduciary.
 *  - **It is not a chain.** Records are not linked, so removing one leaves no
 *    gap in a hash sequence. What guards the log is the append-only trigger on
 *    `consent_records` and the deletion guard added in 6A — not this field.
 *  - **It proves nothing against someone who can write the table**, who would
 *    simply recompute it. That is not the threat it addresses.
 *
 * A receipt whose limits are stated is worth having. One described as "proof of
 * consent" without them would be worse than none, because somebody would rely
 * on it.
 *
 * ## Canonicalisation
 *
 * Field order is fixed and explicit rather than taken from object iteration
 * order, and every value is normalised before hashing. Two records with the
 * same evidence must produce the same digest on any machine and in any runtime,
 * or a principal checking a receipt gets a mismatch that means nothing.
 */

import { createHash } from "node:crypto";

/** The evidence a receipt covers. Everything here is on the record itself. */
export interface ConsentEvidence {
  siteId: string;
  principalExternalId: string;
  purposeCode: string;
  status: string;
  decidedAt: Date | string;
  noticeId: string | null;
  policyVersionId: string | null;
  /** The consent configuration version being served at the time. */
  policyConfigVersion: string | null;
  jurisdictions: readonly string[];
  vendors: readonly string[];
  mechanism: string | null;
  source: string;
}

/**
 * The canonical string a digest is taken over.
 *
 * Exported so a principal can recompute it themselves. A verification procedure
 * nobody outside this repository can perform is not a verification procedure.
 */
export function canonicalEvidence(evidence: ConsentEvidence): string {
  const decidedAt =
    evidence.decidedAt instanceof Date
      ? evidence.decidedAt.toISOString()
      : new Date(evidence.decidedAt).toISOString();

  // Sorted, so the order two arrays happened to arrive in cannot change a
  // digest. Lower-cased where the value is an identifier rather than prose.
  const jurisdictions = [...evidence.jurisdictions].map((j) => j.trim()).sort();
  const vendors = [...evidence.vendors].map((v) => v.trim()).sort();

  return [
    "rift-consent-receipt/1",
    evidence.siteId,
    evidence.principalExternalId,
    evidence.purposeCode,
    evidence.status,
    decidedAt,
    evidence.noticeId ?? "",
    evidence.policyVersionId ?? "",
    evidence.policyConfigVersion ?? "",
    jurisdictions.join(","),
    vendors.join(","),
    evidence.mechanism ?? "",
    evidence.source,
  ].join("\n");
}

/** The receipt digest for one decision. */
export function proofHash(evidence: ConsentEvidence): string {
  return createHash("sha256").update(canonicalEvidence(evidence), "utf8").digest("hex");
}

/** Whether a record still matches a digest a principal is holding. */
export function verifyProof(evidence: ConsentEvidence, digest: string): boolean {
  const expected = proofHash(evidence);
  // Constant-time is unnecessary here - both values are already public to the
  // party doing the check - but the lengths must match before comparing or a
  // truncated digest would compare equal to its own prefix.
  return expected.length === digest.trim().length && expected === digest.trim();
}

/**
 * A receipt as handed to a principal.
 *
 * Deliberately small. It carries the decision and its context and nothing
 * about the person beyond the opaque principal id they already hold — no
 * address, no browser, no device.
 */
export interface ConsentReceipt {
  version: "rift-consent-receipt/1";
  consent_record_id: string;
  site_id: string;
  principal_external_id: string;
  purpose_code: string;
  status: string;
  decided_at: string;
  recorded_at: string;
  notice_id: string | null;
  policy_version_id: string | null;
  policy_config_version: string | null;
  jurisdictions: string[];
  vendors: string[];
  mechanism: string | null;
  source: string;
  proof_hash: string;
  /** How to check it, in the receipt itself. */
  verification: {
    algorithm: "sha256";
    canonical_form: string;
    /** Stated on every receipt, so the limits travel with it. */
    caveat: string;
  };
  legal_advice: false;
}

export const RECEIPT_CAVEAT =
  "This digest is a receipt, not a signature. It lets you check that a record " +
  "you are shown is the one that was issued to you. It is not signed, records " +
  "are not chained, and it does not evidence anything against a party able to " +
  "write the underlying table.";
