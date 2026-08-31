import type { NextRequest } from "next/server";
import { listPendingForRecipient, prisma } from "database";
import { authenticateDelivery } from "@/lib/auth";

/**
 * Envelopes waiting for the authenticated recipient.
 *
 * Without this a target could only fetch a transfer whose id it had been told
 * out of band, which would make the delivery plane unusable on its own. Returns
 * routing metadata only — the envelope itself is fetched per transfer.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateDelivery(request);
  if (!auth.ok) return auth.response;

  const transfers = await listPendingForRecipient(prisma, auth.caller.recipientId);
  return Response.json({ transfers }, { status: 200 });
}
