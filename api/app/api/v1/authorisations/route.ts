import type { NextRequest } from "next/server";
import { z } from "zod";
import { authoriseTransfer, listAuthorisations, prisma } from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Authorisation is its own concern, not a sub-resource of transfers.
 *
 * A transfer is one action that needs permission; the permission itself is the
 * thing being modelled here. Keeping the boundary separate means a future action
 * type can reuse the same decision without reshaping this API, and it keeps the
 * consent domain and the routing prototype from depending on each other.
 *
 * Creating an authorisation runs the orchestration layer first: identify the
 * fiduciary, the principal and the purpose, retrieve the applicable consent, and
 * refuse if it is not currently granted. Only then is a single-use permission
 * minted. Use `POST /api/v1/authorisations/decision` to ask the same question
 * without creating anything.
 */
const createAuthorisationSchema = z
  .object({
    site_id: z.string().min(1),
    principal_external_id: z.string().min(1).max(200),
    purpose_code: z.string().min(1).max(100),
    recipient_code: z.string().min(1).max(100),
    ttl_seconds: z.number().int().min(30).max(3600).optional(),
  })
  // Strict, so a payload cannot ride along with a permission request. The
  // decision must never depend on the data it is authorising.
  .strict();

const MAX_LIMIT = 500;

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, createAuthorisationSchema);
  if (!body.ok) return body.response;

  const result = await authoriseTransfer(prisma, {
    organisationId: auth.caller.organisationId,
    siteId: body.data.site_id,
    principalExternalId: body.data.principal_external_id,
    purposeCode: body.data.purpose_code,
    recipientCode: body.data.recipient_code,
    ttlSeconds: body.data.ttl_seconds,
  });

  if (!result.ok) {
    // 409 when the request was well-formed and the tenant is right but consent
    // does not permit it; 404 for anything the caller does not own, so ids
    // cannot be probed across tenants.
    const status = result.code === "consent_not_granted" ? 409 : 404;
    return managementError(result.code, result.message, [], status);
  }

  return Response.json(result.authorisation, { status: 201 });
}

/** The organisation's own authorisations, newest first. */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const siteId = params.get("site_id")?.trim() || undefined;

  const rawLimit = params.get("limit");
  let limit: number | undefined;
  if (rawLimit !== null) {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return managementError(
        "invalid_request",
        `Query parameter \`limit\` must be an integer between 1 and ${MAX_LIMIT}.`,
      );
    }
    limit = parsed;
  }

  if (siteId && !(await findOwnedWebsite(auth.caller.organisationId, siteId))) {
    return siteNotFound(siteId);
  }

  const authorisations = await listAuthorisations(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    limit,
  });

  return Response.json({ authorisations }, { status: 200 });
}
