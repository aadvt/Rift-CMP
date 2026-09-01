import type { NextRequest } from "next/server";
import { getConsentHistory, prisma } from "database";
import type { ConsentHistoryResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { parseLimit } from "@/lib/validation";

const MAX_LIMIT = 1000;

/**
 * The complete consent audit trail for the authenticated organisation.
 *
 * This is on the management plane, not the browser plane: reading decision
 * history across principals is an operator capability and requires the
 * organisation secret. A site public key - which is visible to anyone who views
 * the page source - can only read the single principal it already has the id
 * for.
 *
 * Filters narrow within the tenant; none of them can widen beyond it, because
 * `organisationId` is always applied.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;
  const { organisationId } = auth.caller;

  const params = request.nextUrl.searchParams;
  const siteId = params.get("site_id")?.trim() || undefined;
  const principalExternalId = params.get("principal_external_id")?.trim() || undefined;
  const purposeCode = params.get("purpose_code")?.trim() || undefined;

  const parsedLimit = parseLimit(request, MAX_LIMIT);
  if (!parsedLimit.ok) return parsedLimit.response;

  // Narrowing to a site the caller does not own is a 404, matching how every
  // other site-addressed endpoint behaves, rather than silently returning [].
  if (siteId && !(await findOwnedWebsite(organisationId, siteId))) {
    return siteNotFound(siteId);
  }

  const records = await getConsentHistory(prisma, {
    organisationId,
    siteId,
    principalExternalId,
    purposeCode,
    limit: parsedLimit.limit,
  });

  const body: ConsentHistoryResponse = { records };
  return Response.json(body, { status: 200 });
}
