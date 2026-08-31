import type { NextRequest } from "next/server";
import { z } from "zod";
import { createRecipient, listRecipients, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Target fiduciaries a source organisation may send data to.
 *
 * Only the recipient's X25519 *public* key is registered. Rift never receives,
 * requests or stores the matching private key - that is what makes the recipient
 * the sole party able to read anything addressed to it.
 */
const createRecipientSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/, "code must be lowercase alphanumeric with - or _"),
    name: z.string().min(1).max(200),
    /** base64 SPKI X25519 public key, supplied by the target out of band. */
    public_key: z.string().min(1).max(256),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const recipients = await listRecipients(prisma, auth.caller.organisationId);
  return Response.json({ recipients }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, createRecipientSchema);
  if (!body.ok) return body.response;

  const existing = await prisma.dataRecipient.findFirst({
    where: { organisationId: auth.caller.organisationId, code: body.data.code },
    select: { id: true },
  });
  if (existing) {
    return managementError(
      "conflict",
      `A recipient with code "${body.data.code}" already exists.`,
      [],
      409,
    );
  }

  // The delivery key is returned once here and stored only as a digest.
  const recipient = await createRecipient(prisma, {
    organisationId: auth.caller.organisationId,
    code: body.data.code,
    name: body.data.name,
    publicKey: body.data.public_key,
  });

  return Response.json(recipient, { status: 201 });
}
