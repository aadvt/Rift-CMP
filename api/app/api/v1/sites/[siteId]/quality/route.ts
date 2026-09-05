import type { NextRequest } from "next/server";
import type { ConsentQualityResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { gatherSiteEvidence } from "@/lib/intelligence-inputs";
import { buildSiteIntelligence } from "@/lib/intelligence";
import { computeConsentQuality } from "@/lib/consent-quality";

/**
 * How well set up a site is, and why.
 *
 * **Management plane only.**
 *
 * Reads the same evidence the intelligence endpoint does, because the score is
 * a summary of those findings and not a second opinion about them. A score that
 * disagreed with the list underneath it would be worse than no score.
 *
 * It is an operational posture score, not a compliance certification, and the
 * response says so on every request rather than in a footnote somebody has to
 * find. Nothing here is legal advice.
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

  const active = evidence.purposes.filter((p) => p.is_active);
  const declaredCodes = new Set(active.map((p) => p.code));
  const undeclared = new Set(
    evidence.approved
      .map((r) => r.suggested_purpose)
      .filter((code): code is string => Boolean(code) && !declaredCodes.has(code as string)),
  );

  const quality = computeConsentQuality({
    siteId,
    declaredPurposes: active.length,
    undeclaredPurposes: undeclared.size,
    approved: evidence.approved,
    // With no approved version there is nothing to compare coverage against, so
    // the approved set stands in — a site is not penalised for recommendations
    // it has not been shown yet.
    proposed: evidence.approved,
    hasApprovedPolicy: evidence.policyVersion !== null,
    enforcementMode: website.analyticsConsentPurpose ? "enforce" : "observe",
    enforcementRules: evidence.approved.filter(
      (r) => r.recommended_action === "require_consent" || r.recommended_action === "block",
    ).length,
    lastCompletedScanAt: evidence.lastCompletedScanAt,
    shadowTrackers: intelligence.shadow_trackers,
    drift: intelligence.drift,
    jurisdictions: evidence.jurisdictions,
    decisions: evidence.decisions,
    decisionsWithProof: evidence.decisionsWithProof,
  });

  const body: ConsentQualityResponse = { quality };
  return Response.json(body, { status: 200 });
}
