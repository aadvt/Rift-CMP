import type { NextRequest } from "next/server";
import { getPlatformOverview, prisma } from "database";
import type { PlatformOverview } from "@rift-cmp/shared";
import { authenticateManagement } from "@/lib/auth";
import { parseAnalyticsQuery } from "@/lib/analytics-query";

/**
 * Operational counts across every domain: sites, consent decisions,
 * authorisations, transfers, and SDK activity.
 *
 * This is what the dashboard overview renders. Like the summary endpoint it
 * returns aggregates only — never a consent record, an envelope, or a payload.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const query = await parseAnalyticsQuery(request, auth.caller.organisationId);
  if (!query.ok) return query.response;

  const overview: PlatformOverview = await getPlatformOverview(prisma, {
    organisationId: auth.caller.organisationId,
    siteId: query.siteId,
    from: query.from,
    to: query.to,
  });

  return Response.json(overview, { status: 200 });
}
