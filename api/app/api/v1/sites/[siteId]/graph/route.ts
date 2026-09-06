import type { NextRequest } from "next/server";
import type { ConsentGraphResponse, GraphFilters, GraphSeverity, Provenance } from "@rift-cmp/shared/graph";
import { MAX_DEPTH } from "@rift-cmp/shared/graph";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { filterGraph } from "@/lib/graph";
import { gatherGraph } from "@/lib/graph-inputs";

/**
 * The consent dependency graph for one site.
 *
 * **Management plane only.**
 *
 * Scoped by site, never by organisation: returning every site's graph because
 * the caller owns several would be a large response answering a question nobody
 * asked, and the interesting question is always about one site.
 *
 * Filters narrow what is shown and never change what an edge means. They are
 * applied after the graph is built for that reason — filtering during
 * construction would let a narrow query produce a *different* graph, and two
 * views of one site that disagree is worse than a slow one.
 *
 * Nothing here is stored. The graph is derived on each request from scans, the
 * approved configuration, enforcement events and intelligence findings, because
 * a cached graph is a copy and the first question anyone would ask of a copied
 * edge is whether it is still true.
 */
const PROVENANCES = new Set(["OBSERVED", "CONFIGURED", "ENFORCED", "INFERRED", "UNKNOWN"]);
const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const params = request.nextUrl.searchParams;

  const provenance = params.get("provenance");
  if (provenance && !PROVENANCES.has(provenance)) {
    return managementError(
      "invalid_request",
      `Unknown provenance "${provenance}". Expected one of: ${[...PROVENANCES].join(", ")}.`,
    );
  }

  const severity = params.get("severity");
  if (severity && !SEVERITIES.has(severity)) {
    return managementError(
      "invalid_request",
      `Unknown severity "${severity}". Expected one of: ${[...SEVERITIES].join(", ")}.`,
    );
  }

  const depthRaw = params.get("depth");
  const depth = depthRaw === null ? undefined : Number(depthRaw);
  if (depth !== undefined && (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH)) {
    return managementError(
      "invalid_request",
      `\`depth\` must be a whole number between 1 and ${MAX_DEPTH}.`,
    );
  }

  const filters: GraphFilters = {
    ...(params.get("page") ? { page: params.get("page")! } : {}),
    ...(params.get("tracker") ? { tracker: params.get("tracker")! } : {}),
    ...(params.get("vendor") ? { vendor: params.get("vendor")! } : {}),
    ...(params.get("purpose") ? { purpose: params.get("purpose")! } : {}),
    ...(params.get("data_category") ? { data_category: params.get("data_category")! } : {}),
    ...(params.get("jurisdiction") ? { jurisdiction: params.get("jurisdiction")! } : {}),
    ...(params.get("focus") ? { focus: params.get("focus")! } : {}),
    ...(provenance ? { provenance: provenance as Provenance } : {}),
    ...(severity ? { severity: severity as GraphSeverity } : {}),
    ...(depth === undefined ? {} : { depth }),
  };

  const { graph } = await gatherGraph(auth.caller.organisationId, siteId, website.domain);

  const body: ConsentGraphResponse = { graph: filterGraph(graph, filters) };
  return Response.json(body, { status: 200 });
}
