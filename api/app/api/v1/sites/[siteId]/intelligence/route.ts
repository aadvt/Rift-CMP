import type { NextRequest } from "next/server";
import {
  getApprovedPolicyVersion,
  getDiscoveryInventory,
  getScanWithObservations,
  listScans,
  prisma,
} from "database";
import type { SiteIntelligenceResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { toScanResults } from "@/lib/scan-view";
import { buildSiteIntelligence } from "@/lib/intelligence";

/**
 * What is running on a site that nobody decided about, and what has changed.
 *
 * **Management plane only.** These are observations about a tenant's own site,
 * and the evidence attached to them names pages and hosts.
 *
 * ## Everything here is derived, nothing is stored
 *
 * Findings are computed from the latest completed scan, the one before it, the
 * approved policy version and any in-page discovery — all of which are already
 * recorded. Persisting the findings as well would create a second copy that
 * goes stale the moment a scan finishes, and an operator would then have two
 * answers with no way to tell which is current. The inputs are the record; this
 * is a reading of them.
 *
 * The cost is that a large site recomputes on each request. That is a real
 * trade and the right one at this size: a stale finding about privacy is worse
 * than a slow one, and the alternative is invalidation logic that has to be
 * correct in more places than this endpoint touches.
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

  const organisationId = auth.caller.organisationId;

  // Newest first, so the first completed scan is current and the second is the
  // baseline a difference is measured against.
  const scans = await listScans(prisma, organisationId, { siteId, limit: 25 });
  const completed = scans.filter((scan) => scan.status === "completed");
  const latest = completed[0] ?? null;
  const previous = completed[1] ?? null;

  const [latestRows, previousRows, approved, discovery] = await Promise.all([
    latest ? getScanWithObservations(prisma, organisationId, latest.id) : Promise.resolve(null),
    previous ? getScanWithObservations(prisma, organisationId, previous.id) : Promise.resolve(null),
    getApprovedPolicyVersion(prisma, organisationId, siteId),
    // In-page discovery only exists once the SDK is installed and reporting.
    // Absent is the ordinary state, not an error.
    getDiscoveryInventory(prisma, { organisationId, siteId }).catch(() => null),
  ]);

  const intelligence = buildSiteIntelligence({
    siteId,
    scanId: latest?.id ?? null,
    baselineScanId: previous?.id ?? null,
    results: latestRows ? toScanResults(latestRows) : null,
    baseline: previousRows ? toScanResults(previousRows) : null,
    approved: approved?.recommendations ?? [],
    policyVersion: approved?.version ?? null,
    runtime: discovery?.components ?? [],
  });

  const body: SiteIntelligenceResponse = { intelligence };
  return Response.json(body, { status: 200 });
}
