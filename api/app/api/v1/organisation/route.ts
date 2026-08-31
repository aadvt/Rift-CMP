import type { NextRequest } from "next/server";
import { prisma, toOrganisationSummary } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";

/** Returns the organisation the presented secret key belongs to. */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const organisation = await prisma.organisation.findUnique({
    where: { id: auth.caller.organisationId },
  });

  if (!organisation) {
    return managementError("not_found", "Organisation no longer exists.", [], 404);
  }

  return Response.json(toOrganisationSummary(organisation), { status: 200 });
}
