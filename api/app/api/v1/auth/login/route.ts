import type { NextRequest } from "next/server";
import { z } from "zod";
import { authenticateUser, createDashboardSession, prisma } from "database";
import { managementError } from "@/lib/cors";

/**
 * Signing in as a person.
 *
 * ## What this does and does not establish
 *
 * A password proves **which human is asking**. It does not produce an
 * organisation key, and deliberately cannot: `secret_key_hash` is a digest, and
 * the plaintext `sk_` was shown once at creation and never stored. Nothing in
 * the platform can recover it, which is the property that makes a database leak
 * survivable — so a login mints a session bound to the organisation instead, and
 * `authenticateManagement` accepts that session as proof of membership.
 *
 * The two credential systems stay separate, which is the point: users prove who
 * they are, keys prove which organisation a request represents. A password can
 * be reset, an account removed, a session revoked — none of which should ever
 * require rotating a key that customers have pasted into their websites.
 *
 * ## Why the failures are all the same failure
 *
 * Unknown address, wrong password, no organisation: one 401 with one sentence.
 * Distinguishing them turns this endpoint into an oracle for which addresses
 * have accounts, which is the first thing a credential-stuffing run wants. The
 * password is verified even when no user matched, so the timing does not report
 * what the message refused to.
 */

const Body = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(512),
});

export async function POST(request: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return managementError("invalid_request", "Body must be JSON.", [], 400);
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return managementError("invalid_request", "An email and password are required.", [], 400);
  }

  const user = await authenticateUser(prisma, parsed.data);
  if (!user) {
    return managementError("unauthorized", "That email and password do not match.", [], 401);
  }

  const session = await createDashboardSession(prisma, {
    organisationId: user.organisationId,
    userId: user.id,
  });

  return Response.json(
    {
      session_token: session.token,
      expires_at: session.expiresAt.toISOString(),
      user: {
        user_id: user.id,
        email: user.email,
        role: user.role,
        organisation_id: user.organisationId,
      },
    },
    { status: 201 },
  );
}
