import type { NextRequest } from "next/server";
import type { ConsentProofResponse } from "@rift-cmp/shared";
import { PROOF_CAVEAT } from "@rift-cmp/shared/consent-signature";
import { prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { assertNoPrivateMaterial } from "@/lib/proof-keys";
import { managementError } from "@/lib/cors";
import { proofFor } from "@/lib/consent-proof";

/**
 * The signed proof for one consent decision.
 *
 * **Management plane only.**
 *
 * Returns the proof document, the evidence it covers, and the id of the key that
 * signed it — everything a holder needs to verify it themselves, without us and
 * without any secret. `canonicalProof` and `verifySignedProof` are exported from
 * `@rift-cmp/shared/consent-signature` for exactly that reason: a verification
 * procedure only we can carry out is not a verification procedure.
 *
 * What it never returns is private key material, in any shape. That is enforced
 * twice — once by only ever reading `proofKeyId`, and once by
 * `assertNoPrivateMaterial` over the finished body, which keeps holding when
 * somebody later widens a `select` or spreads a config object into the response.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ recordId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { recordId } = await context.params;

  // Scoped by organisation in the same query, so a record in another tenant is
  // indistinguishable from one that does not exist.
  const record = await prisma.consentRecord.findFirst({
    where: { id: recordId, organisationId: auth.caller.organisationId },
    include: {
      purpose: { select: { code: true } },
      principal: { select: { externalId: true } },
    },
  });

  if (!record) {
    return managementError("not_found", `No consent record found with id: ${recordId}.`, [], 404);
  }

  const built = proofFor(record);

  const body: ConsentProofResponse = {
    proof: built.proof,
    evidence: {
      site_id: record.siteId,
      principal_external_id: record.principal.externalId,
      purpose_code: record.purpose.code,
      status: record.status,
      decided_at: record.decidedAt.toISOString(),
      notice_id: record.noticeId,
      policy_version_id: record.policyVersionId,
      policy_config_version: record.policyConfigVersion,
      jurisdictions: record.jurisdictions,
      vendors: record.vendors,
      mechanism: record.mechanism,
      source: record.source,
    },
    // The identifier, never the key.
    key_id: record.proofKeyId,
    caveat: PROOF_CAVEAT,
    legal_advice: false,
  };

  assertNoPrivateMaterial(body);
  return Response.json(body, { status: 200 });
}
