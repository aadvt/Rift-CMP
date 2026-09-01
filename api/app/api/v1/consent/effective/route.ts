import type { NextRequest } from "next/server";
import { getEffectiveConsent, prisma } from "database";
import type { ConsentStateResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";

/**
 * Current effective consent for one principal, on the management plane.
 *
 * `GET /api/v1/consent` answers the same question but authenticates with a site
 * public key, which an operator tool does not hold. Without this, a dashboard
 * has to re-derive effective consent by reducing the history endpoint, which is
 * only correct if it can see the principal's *entire* history — and history is
 * paginated by `limit`, so past that boundary the derived answer would be
 * silently wrong.
 *
 * Both planes reduce the same append-only log through the same
 * `resolveEffectiveConsent`, so they cannot disagree.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const siteId = params.get("site_id")?.trim();
  const principalExternalId = params.get("principal_external_id")?.trim();

  if (!siteId || !principalExternalId) {
    return managementError(
      "invalid_request",
      "Query parameters `site_id` and `principal_external_id` are both required.",
    );
  }

  // Consent is per-site: the same external id on two sites is two principals,
  // so an effective answer is only meaningful once a site is named.
  if (!(await findOwnedWebsite(auth.caller.organisationId, siteId))) {
    return siteNotFound(siteId);
  }

  const state = await getEffectiveConsent(prisma, { siteId, principalExternalId });

  const body: ConsentStateResponse = {
    site_id: siteId,
    principal_external_id: principalExternalId,
    // An unseen principal is a normal empty state, not an error.
    purposes: state?.effective ?? [],
  };

  return Response.json(body, { status: 200 });
}
