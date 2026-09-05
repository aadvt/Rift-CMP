import type { NextRequest } from "next/server";
import { getConsentAnalytics, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { parseAnalyticsQuery } from "@/lib/analytics-query";

/**
 * What visitors decided, and how that breaks down.
 *
 * **Management plane only.** Consent decisions are the operator's record of
 * their own visitors; nothing here is readable with a site's public key.
 *
 * Takes the same `site_id`, `from` and `to` as the other analytics endpoints,
 * parsed by the same code, so a filter means the same thing everywhere. A
 * dashboard that narrowed one chart and not another would be worse than no
 * filter at all.
 *
 * The response names the dimensions this platform cannot answer alongside the
 * ones it can — see `unavailable_dimensions`. That is deliberate: a caller has
 * to be able to tell "measured, and it was zero" from "never measurable", and
 * an empty array says the first when the truth is often the second.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const query = await parseAnalyticsQuery(request, auth.caller.organisationId);
  if (!query.ok) return query.response;

  const consent = await getConsentAnalytics(prisma, {
    organisationId: auth.caller.organisationId,
    ...(query.siteId ? { siteId: query.siteId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });

  return Response.json({ consent }, { status: 200 });
}
