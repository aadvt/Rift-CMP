import type { NextRequest } from "next/server";
import { getExperimentComparison, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";

/**
 * How the arms of one experiment compared.
 *
 * **Management plane only.**
 *
 * Serves the numbers together with what they do not show. A comparison table
 * reads as a verdict unless something says otherwise, and the two most likely
 * misreadings are both addressed on the response rather than in documentation:
 * that an observed difference is a result, and that higher acceptance is a
 * better outcome.
 *
 * There is no `winner` field. A significance result names a method, a sample and
 * an interval, and stops there — deciding what to ship is a judgement about the
 * site, not an output of a z-test.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ experimentId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { experimentId } = await context.params;

  const fromRaw = request.nextUrl.searchParams.get("from");
  const toRaw = request.nextUrl.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return managementError("invalid_request", "`from` and `to` must be ISO 8601 timestamps.");
  }

  const comparison = await getExperimentComparison(prisma, {
    organisationId: auth.caller.organisationId,
    experimentId,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  if (!comparison) {
    // Same answer as for an experiment that does not exist.
    return managementError("not_found", `No experiment found with id: ${experimentId}.`, [], 404);
  }

  return Response.json({ comparison }, { status: 200 });
}
