import type { NextRequest } from "next/server";
import { prisma, revokeDashboardSession } from "database";
import { managementError } from "@/lib/cors";
import { readBearerToken } from "@/lib/auth";

/**
 * Signing out.
 *
 * Always answers 204, whether or not the token existed. A caller that has just
 * discarded its session has nothing to do with the difference, and reporting it
 * would say whether a token was real.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return managementError("invalid_request", "A session token is required.", [], 400);
  }

  await revokeDashboardSession(prisma, token);
  return new Response(null, { status: 204 });
}
