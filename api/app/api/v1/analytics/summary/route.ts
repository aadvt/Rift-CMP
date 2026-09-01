import type { NextRequest } from "next/server";
import { getAnalyticsSummary, prisma } from "database";
import type { AnalyticsSummary } from "@rift-cmp/shared";
import { authenticateManagement } from "@/lib/auth";
import { parseAnalyticsQuery } from "@/lib/analytics-query";

/**
 * Aggregate SDK activity for the authenticated organisation.
 *
 * Counts only. This returns no individual event, no page URL tied to a person,
 * and nothing from the consent or transfer domains. It is deliberately a fixed
 * set of metrics rather than a query API: the platform's job is consent and
 * authorised data movement, and analytics exists here so an operator can
 * confirm the SDK is working.
 *
 * Defaults to the last 30 days when no range is given.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const query = await parseAnalyticsQuery(request, auth.caller.organisationId);
  if (!query.ok) return query.response;

  const summary: AnalyticsSummary = await getAnalyticsSummary(prisma, {
    organisationId: auth.caller.organisationId,
    siteId: query.siteId,
    from: query.from,
    to: query.to,
  });

  return Response.json(summary, { status: 200 });
}
