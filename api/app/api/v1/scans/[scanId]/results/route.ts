import type { NextRequest } from "next/server";
import { getScanWithObservations, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { toScanResults } from "@/lib/scan-view";

/**
 * A scan's full observations.
 *
 * This is the endpoint the onboarding flow reads once a scan completes, and the
 * one the consent layer will read to seed a category configuration.
 *
 * Everything it returns is an **observation**: pages visited, cookies present,
 * hosts contacted, technologies believed present and the evidence for believing
 * it. Nothing here says a cookie requires consent or that a site is compliant.
 * That call belongs to the compliance layer, which reads this and the
 * requirement matrix in `docs/regulations/` — see `docs/crawler.md`.
 *
 * Results are readable for a scan in any state. A `running` scan simply has
 * fewer rows, and a `failed` one may still carry the pages it managed before it
 * stopped, which is more useful than an empty response plus an error.
 */

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/v1/scans/[scanId]/results">,
) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { scanId } = await ctx.params;

  // Tenant scoping is in the query, not a check after the fetch.
  const scan = await getScanWithObservations(prisma, auth.caller.organisationId, scanId);
  if (!scan) return managementError("not_found", `No scan with id "${scanId}".`, [], 404);

  return Response.json(toScanResults(scan), { status: 200 });
}
