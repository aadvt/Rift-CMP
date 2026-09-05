import type { NextRequest } from "next/server";
import { getScanWithObservations, listScans, prisma } from "database";
import { diffScans } from "@rift-cmp/crawler";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { toScanMetadata, toScanResults } from "@/lib/scan-view";

/**
 * What changed on a site between two scans.
 *
 * **Management plane only**, like every other scan endpoint.
 *
 * The comparison itself already exists in `@rift-cmp/crawler`'s `diffScans`,
 * which is where it belongs: identity and materiality per resource kind are
 * properties of what the crawler observes, not of how an API happens to
 * serialise it. This route resolves two scans, hands their observations over,
 * and renames the result. It decides nothing.
 *
 * ## Choosing the baseline
 *
 * `?baseline=<scanId>` names it explicitly. Without one, the baseline is the
 * most recent *completed* scan of the same site that finished before this one —
 * which is the comparison anybody asking "what changed?" means. A scan with no
 * predecessor is not an error: it returns an empty diff and says
 * `baseline_scan_id: null`, because "this is the first scan" and "nothing
 * changed" are different answers and a caller must be able to tell them apart.
 *
 * Both scans are resolved under the caller's organisation, so a baseline
 * belonging to another tenant is indistinguishable from one that does not
 * exist.
 */

/** What a scan with no predecessor compares to: nothing, reported as nothing. */
const EMPTY_DIFF = {
  entries: [],
  totals: { new: 0, removed: 0, changed: 0, unchanged: 0 },
  byKind: {
    cookie: { new: 0, removed: 0, changed: 0, unchanged: 0 },
    script: { new: 0, removed: 0, changed: 0, unchanged: 0 },
    request: { new: 0, removed: 0, changed: 0, unchanged: 0 },
    storage: { new: 0, removed: 0, changed: 0, unchanged: 0 },
    technology: { new: 0, removed: 0, changed: 0, unchanged: 0 },
  },
  legalAdvice: false as const,
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ scanId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { scanId } = await context.params;

  const compared = await getScanWithObservations(prisma, auth.caller.organisationId, scanId);
  if (!compared) {
    return managementError("not_found", `No scan with id "${scanId}".`, [], 404);
  }

  const requestedBaseline = new URL(request.url).searchParams.get("baseline")?.trim();

  let baselineId: string | null = null;
  if (requestedBaseline) {
    baselineId = requestedBaseline;
  } else {
    // The previous completed scan of the same site. `listScans` returns newest
    // first, so the first one that both completed and started earlier is it.
    const history = await listScans(prisma, auth.caller.organisationId, {
      siteId: compared.siteId,
      limit: 50,
    });
    const previous = history.find(
      (scan) =>
        scan.id !== compared.id &&
        scan.status === "completed" &&
        scan.createdAt < compared.createdAt,
    );
    baselineId = previous?.id ?? null;
  }

  const baseline = baselineId
    ? await getScanWithObservations(prisma, auth.caller.organisationId, baselineId)
    : null;

  if (baselineId && !baseline) {
    return managementError("not_found", `No scan with id "${baselineId}".`, [], 404);
  }

  if (baseline && baseline.siteId !== compared.siteId) {
    // Diffing two different websites produces a list in which every row is
    // "new" or "removed" and none of it means anything.
    return managementError(
      "invalid_request",
      "Both scans must belong to the same site to be compared.",
      [],
      400,
    );
  }

  const after = toScanResults(compared);
  const before = baseline ? toScanResults(baseline) : null;

  /**
   * With no baseline the answer is an empty diff, not "everything is new".
   *
   * Diffing against empty arrays is the obvious implementation and it is wrong:
   * it reports a site's first scan as twenty-five things having just appeared,
   * which is what a screen then renders as "Added 25 · seen for the first time".
   * Nothing was added. Rift had simply never looked before, and "this is the
   * first scan" and "these things appeared since last time" are different
   * statements — a caller has to be able to tell them apart, which is exactly
   * what `baseline_scan_id: null` alongside an empty diff says.
   */
  const diff = before
    ? diffScans(
        {
          cookies: before.cookies,
          scripts: before.scripts,
          requests: before.requests,
          storage: before.storage,
          technologies: before.technologies,
        },
        {
          cookies: after.cookies,
          scripts: after.scripts,
          requests: after.requests,
          storage: after.storage,
          technologies: after.technologies,
        },
      )
    : EMPTY_DIFF;

  return Response.json(
    {
      baseline_scan_id: baseline?.id ?? null,
      compared_scan_id: compared.id,
      baseline: baseline ? toScanMetadata(baseline) : null,
      compared: toScanMetadata(compared),
      diff,
    },
    { status: 200 },
  );
}
