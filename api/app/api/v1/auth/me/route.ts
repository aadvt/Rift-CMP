import type { NextRequest } from "next/server";
import { prisma } from "database";
import { authenticateManagement } from "@/lib/auth";

/**
 * Who the current credential belongs to.
 *
 * Answers for either credential: a session opened by signing in reports the
 * person, and one opened with an organisation key reports `user: null`, because
 * a key is not a person. A dashboard uses this to decide whether to show a
 * sign-out control.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const user = auth.caller.userId
    ? await prisma.user.findUnique({
        where: { id: auth.caller.userId },
        select: { id: true, email: true, role: true },
      })
    : null;

  return Response.json({
    organisation: {
      organisation_id: auth.caller.organisationId,
      name: auth.caller.name,
      slug: auth.caller.slug,
    },
    user: user ? { user_id: user.id, email: user.email, role: user.role } : null,
  });
}
