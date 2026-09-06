import type { NextRequest } from "next/server";
import type { GraphNodeDetailResponse } from "@rift-cmp/shared/graph";
import { kindOf } from "@rift-cmp/shared/graph";
import { NODE_SIMULATIONS } from "@rift-cmp/shared/simulation";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { gatherGraph } from "@/lib/graph-inputs";

/**
 * One node, with its immediate neighbours and its evidence.
 *
 * **Management plane only.**
 *
 * The node id is resolved *inside* this site's graph rather than looked up
 * globally. That is the whole isolation argument: a node id from another
 * tenant's site is simply not present in the graph built here, so a crafted id
 * returns 404 rather than reaching anything. There is no id-to-record lookup
 * that could be pointed elsewhere.
 *
 * Neighbours are the drilldown. The graph endpoint answers "what does this site
 * look like"; this answers "what is this thing, and what does it touch", which
 * is the question somebody has after clicking.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string; nodeId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId, nodeId: rawNodeId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const nodeId = decodeURIComponent(rawNodeId);

  // An id that is not shaped like one of ours cannot name a node, and rejecting
  // it here keeps a malformed value out of the traversal entirely.
  if (!kindOf(nodeId)) {
    return managementError("invalid_request", `"${nodeId}" is not a node identifier.`);
  }

  const { graph } = await gatherGraph(auth.caller.organisationId, siteId, website.domain);
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    // Same answer for a node in another tenant's site as for one that does not
    // exist, because from here they are the same thing: neither is in this
    // graph.
    return managementError("not_found", `No node found with id: ${nodeId}.`, [], 404);
  }

  const byId = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));
  const neighbours: GraphNodeDetailResponse["detail"]["neighbours"] = [];

  for (const edge of graph.edges) {
    if (edge.from === nodeId) {
      const other = byId.get(edge.to);
      if (other) neighbours.push({ edge, node: other, direction: "out" });
    } else if (edge.to === nodeId) {
      const other = byId.get(edge.from);
      if (other) neighbours.push({ edge, node: other, direction: "in" });
    }
  }

  const body: GraphNodeDetailResponse = {
    detail: {
      node,
      neighbours,
      // What this node can ask of the simulator. Served rather than hard-coded
      // in the UI, so the offered operations cannot drift from the ones the
      // engine can actually evaluate.
      simulations: NODE_SIMULATIONS[node.kind] ?? [],
      legal_advice: false,
    },
  };

  return Response.json(body, { status: 200 });
}
