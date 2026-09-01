import type { NextRequest } from "next/server";
import { z } from "zod";
import { evaluateAuthorisation, prisma } from "database";
import type { AuthorisationDecisionResponse } from "@rift-cmp/shared";
import { authenticateManagement } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation";

/**
 * "Is this action currently authorised?" — asked without committing to it.
 *
 * Creating an authorisation burns a single-use permission and writes a row. A
 * fiduciary often needs to know the answer first: to decide whether to collect
 * the data at all, to show a user why something is unavailable, or to check a
 * batch before starting. This endpoint answers the same question through the
 * same orchestration layer, with no side effect.
 *
 * A refusal is a 200 with `permitted: false`, not an HTTP error. "Consent was
 * withdrawn" is a successful answer to a well-formed question, and conflating it
 * with a malformed request would make both harder to handle.
 */
const decisionSchema = z
  .object({
    site_id: z.string().min(1),
    principal_external_id: z.string().min(1).max(200),
    purpose_code: z.string().min(1).max(100),
  })
  .strict();

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, decisionSchema);
  if (!body.ok) return body.response;

  const decision = await evaluateAuthorisation(prisma, {
    organisationId: auth.caller.organisationId,
    siteId: body.data.site_id,
    principalExternalId: body.data.principal_external_id,
    purposeCode: body.data.purpose_code,
  });

  const shared = {
    site_id: body.data.site_id,
    principal_external_id: body.data.principal_external_id,
    purpose_code: body.data.purpose_code,
  };

  const response: AuthorisationDecisionResponse = decision.permitted
    ? {
        ...shared,
        permitted: true,
        reason: null,
        message: `Consent for "${body.data.purpose_code}" is currently GRANTED.`,
        consent_record_id: decision.context.consentRecordId,
        consent_status: decision.context.consentStatus,
        decided_at: decision.context.decidedAt.toISOString(),
      }
    : {
        ...shared,
        permitted: false,
        reason: decision.reason,
        message: decision.message,
        consent_record_id: null,
        consent_status: null,
        decided_at: null,
      };

  return Response.json(response, { status: 200 });
}
