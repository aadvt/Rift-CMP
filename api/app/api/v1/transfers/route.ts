import type { NextRequest } from "next/server";
import { z } from "zod";
import { listTransfers, prisma, recordTransfer } from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Submitting a sealed payload, and reading a source organisation's own transfer
 * metadata.
 *
 * The submission schema accepts an envelope and nothing else that could carry
 * readable data. It is `.strict()`, so a client that tried to attach `plaintext`
 * — by mistake or otherwise — gets a validation error rather than having Rift
 * quietly store it.
 */
const envelopeSchema = z
  .object({
    ciphertext: z.string().min(1),
    iv: z.string().min(1),
    auth_tag: z.string().min(1),
    ephemeral_public_key: z.string().min(1).max(256),
  })
  .strict();

const submitSchema = z
  .object({
    authorisation_id: z.string().uuid(),
    nonce: z.string().min(1).max(200),
    envelope: envelopeSchema,
  })
  .strict();

const FAILURE_STATUS: Record<string, number> = {
  not_found: 404,
  invalid_envelope: 400,
  authorisation_expired: 409,
  authorisation_consumed: 409,
  conflict: 409,
};

/** Records a sealed transfer, consuming its single-use authorisation. */
export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, submitSchema);
  if (!body.ok) return body.response;

  const result = await recordTransfer(prisma, {
    organisationId: auth.caller.organisationId,
    authorisationId: body.data.authorisation_id,
    nonce: body.data.nonce,
    envelope: {
      ciphertext: body.data.envelope.ciphertext,
      iv: body.data.envelope.iv,
      authTag: body.data.envelope.auth_tag,
      ephemeralPublicKey: body.data.envelope.ephemeral_public_key,
    },
  });

  if (!result.ok) {
    return managementError(result.code, result.message, [], FAILURE_STATUS[result.code] ?? 400);
  }

  return Response.json(result.transfer, { status: 201 });
}

/**
 * The organisation's own transfer records: routing metadata and integrity
 * digests only. The envelope is never returned here — it is collected by the
 * recipient, on the delivery plane.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const siteId = request.nextUrl.searchParams.get("site_id")?.trim() || undefined;
  if (siteId && !(await findOwnedWebsite(auth.caller.organisationId, siteId))) {
    return siteNotFound(siteId);
  }

  const transfers = await listTransfers(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
  });

  return Response.json({ transfers }, { status: 200 });
}
