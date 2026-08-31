import type { NextRequest } from "next/server";
import { collectTransfer, prisma } from "database";
import { authenticateDelivery } from "@/lib/auth";
import { managementError } from "@/lib/cors";

/**
 * The delivery plane: a target fiduciary collects a sealed envelope addressed to
 * it.
 *
 * This endpoint hands over ciphertext, the ephemeral public key, and the routing
 * metadata needed to rebuild the AAD. That is everything required to decrypt
 * *except* the recipient's X25519 private key, which never left the recipient
 * and which Rift has therefore never been able to supply.
 *
 * The lookup is scoped to the authenticated recipient, so a delivery credential
 * cannot collect envelopes sealed for anyone else — and could not read them if
 * it did.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/v1/transfers/[transferId]/envelope">,
) {
  const auth = await authenticateDelivery(request);
  if (!auth.ok) return auth.response;

  const { transferId } = await ctx.params;

  const result = await collectTransfer(prisma, {
    recipientId: auth.caller.recipientId,
    transferId,
  });

  if (!result.ok) {
    return managementError(result.code, result.message, [], 404);
  }

  return Response.json(result.delivery, { status: 200 });
}
