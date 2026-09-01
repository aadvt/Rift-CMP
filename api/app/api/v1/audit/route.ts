import type { NextRequest } from "next/server";
import { getAuditTrail, prisma } from "database";
import type { AuditResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { parseLimit } from "@/lib/validation";

/**
 * The audit trail: consent decisions, authorisations and transfers for one
 * tenant, interleaved into a single timeline.
 *
 * The three domains are stored separately and deliberately not joined in the
 * database. This is a read model that joins them for a reader, so a decision can
 * be followed through to the authorisation it justified and the transfer that
 * resulted, without exposing any table shape.
 *
 * Management plane: reading across principals is an operator capability, so it
 * needs the organisation secret. A site public key cannot reach this.
 */
const MAX_LIMIT = 1000;

export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const siteId = params.get("site_id")?.trim() || undefined;
  const principalExternalId = params.get("principal_external_id")?.trim() || undefined;
  const purposeCode = params.get("purpose_code")?.trim() || undefined;

  const parsedLimit = parseLimit(request, MAX_LIMIT);
  if (!parsedLimit.ok) return parsedLimit.response;

  if (siteId && !(await findOwnedWebsite(auth.caller.organisationId, siteId))) {
    return siteNotFound(siteId);
  }

  const entries = await getAuditTrail(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    principalExternalId,
    purposeCode,
    limit: parsedLimit.limit,
  });

  const body: AuditResponse = { entries };
  return Response.json(body, { status: 200 });
}
