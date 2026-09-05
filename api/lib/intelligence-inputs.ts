import {
  getApprovedPolicyVersion,
  getDiscoveryInventory,
  getScanWithObservations,
  listPurposes,
  listScans,
  prisma,
} from "database";
import { toScanResults } from "./scan-view";

/**
 * Everything the intelligence layer reads, gathered once.
 *
 * Lives here rather than in a route because two endpoints need the same
 * evidence and a third will. A route module may only export HTTP methods, so
 * sharing from one would have meant duplicating the gathering — which is how
 * two endpoints end up quietly disagreeing about the same site.
 */
export async function gatherSiteEvidence(organisationId: string, siteId: string) {
  // Newest first: the first completed scan is current, the second is the
  // baseline any difference is measured against.
  const scans = await listScans(prisma, organisationId, { siteId, limit: 25 });
  const completed = scans.filter((scan) => scan.status === "completed");
  const latest = completed[0] ?? null;
  const previous = completed[1] ?? null;

  const [latestRows, previousRows, approved, discovery, purposes, decisions, decisionsWithProof] =
    await Promise.all([
      latest ? getScanWithObservations(prisma, organisationId, latest.id) : Promise.resolve(null),
      previous ? getScanWithObservations(prisma, organisationId, previous.id) : Promise.resolve(null),
      getApprovedPolicyVersion(prisma, organisationId, siteId),
      // In-page discovery exists only once the SDK is installed and reporting.
      // Absent is the ordinary state, not a failure.
      getDiscoveryInventory(prisma, { organisationId, siteId }).catch(() => null),
      listPurposes(prisma, organisationId),
      prisma.consentRecord.count({ where: { organisationId, siteId } }),
      prisma.consentRecord.count({
        where: { organisationId, siteId, proofHash: { not: null } },
      }),
    ]);

  return {
    scanId: latest?.id ?? null,
    baselineScanId: previous?.id ?? null,
    lastCompletedScanAt: latest?.completedAt ?? null,
    results: latestRows ? toScanResults(latestRows) : null,
    baseline: previousRows ? toScanResults(previousRows) : null,
    approved: approved?.recommendations ?? [],
    policyVersion: approved?.version ?? null,
    jurisdictions: approved?.jurisdictions ?? [],
    runtime: discovery?.components ?? [],
    purposes,
    decisions,
    decisionsWithProof,
  };
}
