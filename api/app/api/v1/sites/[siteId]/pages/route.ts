import type { NextRequest } from "next/server";
import type { PageIntelligenceResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { gatherSiteEvidence } from "@/lib/intelligence-inputs";
import { buildPageIntelligence } from "@/lib/intelligence";

/**
 * What privacy behaviour exists on each page of a site.
 *
 * **Management plane only.**
 *
 * Every item says how firmly it is held. Scripts and runtime requests carry the
 * page they were seen on and are `observed`; cookies do not — the crawler
 * records them for the whole scan — so a cookie against a page is `inferred`
 * from a host match. Presenting the two alike is how an inference ends up
 * quoted back as a measurement.
 *
 * Derived on read from the same evidence the site-level endpoint uses, so the
 * two can never disagree about the same page.
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

  const evidence = await gatherSiteEvidence(auth.caller.organisationId, siteId);

  const pages = buildPageIntelligence({
    siteId,
    scanId: evidence.scanId,
    baselineScanId: evidence.baselineScanId,
    results: evidence.results,
    baseline: evidence.baseline,
    approved: evidence.approved,
    policyVersion: evidence.policyVersion,
    runtime: evidence.runtime,
  });

  const body: PageIntelligenceResponse = { pages };
  return Response.json(body, { status: 200 });
}
