import type { NextRequest } from "next/server";
import { z } from "zod";
import { authoriseTransfer, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Step 1-6 of the authorisation flow. Deliberately payload-free: Rift decides
 * whether a transfer may happen before any ciphertext exists, so the ciphertext
 * can never influence the decision.
 *
 * `.strict()` keeps a payload out by construction - sending `plaintext`, `data`
 * or an envelope here is a validation error, not something quietly ignored.
 */
const authoriseSchema = z
  .object({
    site_id: z.string().min(1),
    principal_external_id: z.string().min(1).max(200),
    purpose_code: z.string().min(1).max(100),
    recipient_code: z.string().min(1).max(100),
    ttl_seconds: z.number().int().min(30).max(3600).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, authoriseSchema);
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
    // 404 for anything the caller does not own, matching the rest of the API so
    // ids cannot be probed across tenants. 409 when consent is simply not given.
    const status = result.code === "consent_not_granted" ? 409 : 404;
    return managementError(result.code, result.message, [], status);
  }

  return Response.json(result.authorisation, { status: 201 });
}
