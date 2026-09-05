import type { NextRequest } from "next/server";
import { getPolicyVersionComparison, prisma } from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { parseLimit } from "@/lib/validation";

/**
 * Consent behaviour, version by version.
 *
 * **Management plane only.**
 *
 * Answers "what changed after the configuration changed" and refuses to answer
 * "what did the configuration cause". Every difference is labelled an *observed
 * change*, because a version ships alongside everything else that happened that
 * week and nothing in this data separates them. An experiment can support a
 * causal claim; a before-and-after cannot, and the wording is the only thing
 * stopping somebody reading one as the other.
 *
 * Decisions are matched to the configuration snapshot on the record rather than
 * to when they happened — a decision taken a minute after approval was still
 * served the old banner.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const limit = parseLimit(request, 20);
  if (!limit.ok) return limit.response;

  const comparison = await getPolicyVersionComparison(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    ...(limit.limit ? { limit: limit.limit } : {}),
  });

  return Response.json({ comparison }, { status: 200 });
}
