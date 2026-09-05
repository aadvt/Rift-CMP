import type { NextRequest } from "next/server";
import { z } from "zod";
import type { ProofVerificationResponse } from "@rift-cmp/shared";
import { PROOF_CAVEAT, verifySignedProof } from "@rift-cmp/shared/consent-signature";
import { prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { assertNoPrivateMaterial, verificationKeyRing } from "@/lib/proof-keys";
import { managementError } from "@/lib/cors";
import { evidenceFor, proofFor } from "@/lib/consent-proof";
import { parseJsonBody } from "@/lib/validation";

/**
 * Check a proof.
 *
 * **Management plane only.**
 *
 * Two ways to call it, and they answer different questions:
 *
 *   Give it a `consent_record_id`, and it checks the proof against the record as
 *   that record stands *now*, including the neighbouring proof in the chain. This
 *   is the auditor's question: has anything about this decision changed since it
 *   was recorded?
 *
 *   Give it a `proof` document, and it checks that document against the record it
 *   names. This is the holder's question: is the thing I was handed genuine?
 *
 * ## Only public material is used
 *
 * Verification reads the public key ring and nothing else. There is no code path
 * here that can reach a private key, which is the property that makes it safe to
 * expose at all — and it is why the same check can be run by anybody holding the
 * proof, the public key and `verifySignedProof` from `@rift-cmp/shared`.
 *
 * ## Nothing is collapsed into a single boolean
 *
 * Integrity, signature and chain are reported separately, because "the signature
 * is genuine but a decision was removed from the middle of this person's
 * history" and "somebody edited the record" are different findings that call for
 * different responses. An `ok: false` with no breakdown would leave an operator
 * unable to act on either.
 */

const bodySchema = z
  .object({
    consent_record_id: z.string().min(1).max(128).optional(),
    proof: z.unknown().optional(),
  })
  .refine((value) => value.consent_record_id !== undefined || value.proof !== undefined, {
    message: "Supply a consent_record_id, a proof, or both.",
  });

/** The record id a supplied proof claims to be about. */
function claimedRecordId(proof: unknown): string | null {
  if (typeof proof !== "object" || proof === null) return null;
  const facts = (proof as { facts?: unknown }).facts;
  if (typeof facts !== "object" || facts === null) return null;
  const id = (facts as { consentRecordId?: unknown }).consentRecordId;
  return typeof id === "string" ? id : null;
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  // A proof that names a different record than the caller asked about is proof
  // substitution, and resolving it against the record it *names* rather than the
  // one requested is what makes the substitution detectable.
  const recordId = parsed.data.consent_record_id ?? claimedRecordId(parsed.data.proof);

  if (!recordId) {
    return managementError(
      "invalid_request",
      "The proof names no consent record, so there is nothing to check it against.",
      [],
      422,
    );
  }

  const record = await prisma.consentRecord.findFirst({
    where: { id: recordId, organisationId: auth.caller.organisationId },
    include: {
      purpose: { select: { code: true } },
      principal: { select: { externalId: true } },
    },
  });

  if (!record) {
    // Same answer for another tenant's record as for one that does not exist.
    return managementError("not_found", `No consent record found with id: ${recordId}.`, [], 404);
  }

  // The proof that should precede this one, as the store holds it. Supplying it
  // is what turns the chain check from "unverifiable" into a real answer — and a
  // gap here is exactly what a deleted decision looks like.
  const previous =
    record.proofSequence === null
      ? undefined
      : record.proofSequence === 1
        ? null
        : ((
            await prisma.consentRecord.findFirst({
              where: {
                siteId: record.siteId,
                principalId: record.principalId,
                proofSequence: record.proofSequence - 1,
              },
              select: { proofDocumentHash: true },
            })
          )?.proofDocumentHash ?? null);

  const supplied = parsed.data.proof;
  const toCheck =
    supplied !== undefined
      ? supplied
      : (proofFor(record).proof ?? null);

  if (toCheck === null) {
    return managementError(
      "not_found",
      "This decision was recorded before signed proofs existed, so there is nothing to verify. Its receipt digest is still on the record.",
      [],
      404,
    );
  }

  const result = verifySignedProof({
    proof: toCheck,
    evidence: evidenceFor(record),
    keyRing: verificationKeyRing(),
    ...(previous === undefined ? {} : { expectedPreviousProofHash: previous }),
  });

  const body: ProofVerificationResponse = {
    result: {
      ok: result.ok,
      version: result.version,
      malformed: result.malformed,
      unsupported_version: result.unsupportedVersion,
      integrity: result.integrity,
      signature: result.signature,
      key_id: result.keyId,
      chain: result.chain,
      findings: result.findings,
    },
    caveat: PROOF_CAVEAT,
    legal_advice: false,
  };

  assertNoPrivateMaterial(body);
  return Response.json(body, { status: 200 });
}
