import type { NextRequest } from "next/server";
import type { AutopilotIntelligenceResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { gatherSiteEvidence } from "@/lib/intelligence-inputs";
import { buildPageIntelligence, buildSiteIntelligence } from "@/lib/intelligence";
import { buildAutopilotIntelligence } from "@/lib/autopilot-intelligence";
import { assistRecommendations } from "@/lib/ai/assist";
import { getAiProvider } from "@/lib/ai/provider";

/**
 * The approved recommendations, ordered by what most needs a person.
 *
 * **Management plane only.**
 *
 * Not a second recommendation engine. `generatePolicy` still decides what each
 * recommendation is; this orders them by evidence and attaches the findings
 * that explain the order. Nothing here applies anything: the workflow stays
 * evidence → analysis → recommendation → human review → explicit approval, and
 * approval remains `POST /consent-policy`.
 *
 * AI assistance is attached when a provider is configured and its reply passes
 * validation, and is absent otherwise. Ordering is computed from severity, page
 * count and unresolved status either way — a list that reordered itself when an
 * API key changed would not be one to trust.
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

  const intelligence = buildSiteIntelligence({
    siteId,
    scanId: evidence.scanId,
    baselineScanId: evidence.baselineScanId,
    results: evidence.results,
    baseline: evidence.baseline,
    approved: evidence.approved,
    policyVersion: evidence.policyVersion,
    runtime: evidence.runtime,
  });

  const pages = buildPageIntelligence({
    siteId,
    scanId: evidence.scanId,
    baselineScanId: evidence.baselineScanId,
    results: evidence.results,
    baseline: evidence.baseline,
    approved: evidence.approved,
    policyVersion: evidence.policyVersion,
    runtime: evidence.runtime,
    shadowTrackers: intelligence.shadow_trackers,
    drift: intelligence.drift,
  });

  // Breadth is part of urgency: one vendor across fourteen pages is a larger
  // decision than the same vendor on one.
  const pagesByVendor = new Map<string, string[]>();
  for (const page of pages) {
    for (const rec of evidence.approved) {
      const onPage = page.components.some(
        (c) => c.vendor === rec.vendor_name || c.host.includes(rec.detector_id),
      );
      if (!onPage) continue;
      pagesByVendor.set(rec.detector_id, [...(pagesByVendor.get(rec.detector_id) ?? []), page.url]);
    }
  }

  // Advisory, optional, and discarded entirely if it fails validation.
  const assistance = await assistRecommendations({
    recommendations: evidence.approved,
    jurisdictions: evidence.jurisdictions,
  });

  const autopilot = buildAutopilotIntelligence({
    siteId,
    recommendations: evidence.approved,
    shadowTrackers: intelligence.shadow_trackers,
    drift: intelligence.drift,
    pagesByVendor,
    assistance,
    aiConfigured: getAiProvider() !== null,
  });

  const body: AutopilotIntelligenceResponse = { autopilot };
  return Response.json(body, { status: 200 });
}
