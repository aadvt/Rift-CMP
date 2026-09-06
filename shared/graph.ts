/**
 * The consent dependency graph: a view, never a second source of truth.
 *
 * ## Derived, not stored
 *
 * Every node and edge here is computed from data that already exists — scan
 * results, the approved configuration, enforcement events, intelligence
 * findings, experiments. Nothing is persisted, and that is the point: a stored
 * graph is a copy, a copy drifts from what it copied, and the first question
 * anyone would ask of a stored edge is whether it is still true.
 *
 * The cost is that a graph request does the gathering work each time. It is
 * bounded by node caps rather than by a cache, because a stale graph that looks
 * current is worse than a slow one.
 *
 * ## Provenance is on every edge, and it is not decoration
 *
 * The same picture can mean four different things:
 *
 *   `OBSERVED`   — a crawler or the runtime saw this happen.
 *   `CONFIGURED` — an operator declared it. Nobody has seen it.
 *   `ENFORCED`   — the firewall acted on it, or would have.
 *   `INFERRED`   — Rift matched it. A catalogue lookup, a host suffix.
 *   `UNKNOWN`    — asked, and not answered.
 *
 * A tracker joined to a vendor by a catalogue match and a tracker seen sending
 * data to that vendor look identical on a canvas, and only one of them is
 * evidence. Rendering an inference as an observation is the specific failure
 * this whole file is shaped to prevent, which is why provenance is a required
 * field rather than an optional annotation, and why `UNKNOWN` exists instead of
 * a default.
 *
 * ## Nothing is invented to fill the picture
 *
 * There is no node type here that the data model cannot populate, and no edge
 * is emitted without something behind it. A sparse graph of real relationships
 * is worth more than a dense one where half the lines are the diagram's own
 * idea of what ought to connect.
 */

// ─── Nodes ───────────────────────────────────────────────────────────────────

/**
 * The node kinds this data model can actually populate.
 *
 * Deliberately shorter than the obvious list. There is no `regulation` node, for
 * instance: regimes are attached to a jurisdiction by the policy engine and
 * carry citations, but nothing in the store makes a regulation an entity with
 * its own relationships, and a node with one edge and no content is a box on a
 * diagram rather than an intelligence.
 */
export type GraphNodeKind =
  | "site"
  | "page"
  | "tracker"
  | "vendor"
  | "destination"
  | "cookie"
  | "purpose"
  | "data_category"
  | "jurisdiction"
  | "policy_version"
  | "enforcement_rule"
  | "enforcement_event"
  | "shadow_finding"
  | "drift_finding"
  | "experiment"
  | "experiment_variant";

export type Provenance = "OBSERVED" | "CONFIGURED" | "ENFORCED" | "INFERRED" | "UNKNOWN";

export type GraphSeverity = "critical" | "high" | "medium" | "low" | "info";

/** A reference back to the thing that produced a node or edge. */
export interface EvidenceRef {
  /** scan | policy | enforcement | intelligence | experiment | catalogue */
  source: string;
  /** The identifier a person could look up. Never an internal secret. */
  ref: string | null;
  detail: string;
  observed_at?: string | null;
}

export interface GraphNode {
  /** `kind:stable-key`. Stable across requests so a selection survives a reload. */
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Short, for a canvas. The drilldown carries the rest. */
  sublabel: string | null;
  /**
   * How firmly this node is known to exist.
   *
   * A tracker seen by the crawler is `OBSERVED`. A purpose an operator declared
   * is `CONFIGURED`. A vendor arrived at by matching a host against the
   * catalogue is `INFERRED`, and saying otherwise would dress a lookup up as a
   * sighting.
   */
  provenance: Provenance;
  severity: GraphSeverity | null;
  evidence: EvidenceRef[];
  /** Kind-specific facts for the drilldown. Never anything about a person. */
  attributes: Record<string, string | number | boolean | null>;
}

// ─── Edges ───────────────────────────────────────────────────────────────────

export type GraphEdgeKind =
  | "has_page"
  | "loads"
  | "operated_by"
  | "sends_to"
  | "serves_purpose"
  | "processes_category"
  | "requires_consent"
  | "governed_by"
  | "applies_in"
  | "enforced_by"
  | "decided"
  | "sets_cookie"
  | "flagged_as"
  | "drifted"
  | "varies"
  | "measured_under";

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: GraphEdgeKind;
  label: string;
  provenance: Provenance;
  severity: GraphSeverity | null;
  evidence: EvidenceRef[];
}

// ─── The response ────────────────────────────────────────────────────────────

export interface GraphFilters {
  page?: string;
  tracker?: string;
  vendor?: string;
  purpose?: string;
  data_category?: string;
  jurisdiction?: string;
  policy_version?: string;
  severity?: GraphSeverity;
  provenance?: Provenance;
  /** Restrict to one node and what it touches. The drilldown's own query. */
  focus?: string;
  /** How far to walk from `focus`. Bounded; see `MAX_DEPTH`. */
  depth?: number;
}

export interface ConsentGraph {
  site_id: string;
  generated_at: string;
  scan_id: string | null;
  policy_version: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /**
   * What was left out, and why.
   *
   * A truncated graph that does not say it was truncated is a graph an operator
   * will read as complete — and "no tracker on that page" is exactly the
   * conclusion they must not draw from a node cap.
   */
  truncated: {
    nodes: boolean;
    edges: boolean;
    reason: string | null;
  };
  /** Counts by kind, so a reader can see the shape before the picture loads. */
  totals: Record<string, number>;
  /** What this graph does not show. Served with it, not filed elsewhere. */
  caveats: string[];
  legal_advice: false;
}

/** A graph is capped rather than paged: half a picture is not half an answer. */
export const MAX_NODES = 600;
export const MAX_EDGES = 1500;
/** Neighbourhood expansion depth. Two hops is a readable picture; four is a spiderweb. */
export const MAX_DEPTH = 3;

export const GRAPH_CAVEATS = [
  "Every edge carries how it is known: observed by a scan, configured by an operator, enforced by the firewall, inferred by matching, or unknown. An inferred relationship is not evidence that anything happened.",
  "A scan is one visit by one crawler. A tracker that did not fire during it is absent from this graph, and absence here is not evidence of absence on the site.",
  "Enforcement events reported by a browser are claims made by that browser. A blocked decision means the SDK declined to make a request, not that nothing left the page.",
  "Cookies are attributed to a page by host match. The crawler records cookies per scan rather than per page, so those edges are inferred.",
];

// ─── Node detail ─────────────────────────────────────────────────────────────

export interface GraphNodeDetail {
  node: GraphNode;
  /** Immediate neighbours, grouped by the edge that reaches them. */
  neighbours: Array<{
    edge: GraphEdge;
    node: GraphNode;
    direction: "out" | "in";
  }>;
  /** Simulations this node can start. See `shared/simulation.ts`. */
  simulations: Array<{ operation: string; label: string; description: string }>;
  legal_advice: false;
}

export interface ConsentGraphResponse {
  graph: ConsentGraph;
}

export interface GraphNodeDetailResponse {
  detail: GraphNodeDetail;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Node ids are `kind:key`, so an id names its own type and cannot collide. */
export function nodeId(kind: GraphNodeKind, key: string): string {
  return `${kind}:${key.toLowerCase().trim()}`;
}

export function edgeId(from: string, kind: GraphEdgeKind, to: string): string {
  return `${from}|${kind}|${to}`;
}

/** The kind encoded in a node id, or null when the id is not one of ours. */
export function kindOf(id: string): GraphNodeKind | null {
  const kind = id.split(":")[0];
  return KINDS.has(kind as GraphNodeKind) ? (kind as GraphNodeKind) : null;
}

const KINDS = new Set<GraphNodeKind>([
  "site",
  "page",
  "tracker",
  "vendor",
  "destination",
  "cookie",
  "purpose",
  "data_category",
  "jurisdiction",
  "policy_version",
  "enforcement_rule",
  "enforcement_event",
  "shadow_finding",
  "drift_finding",
  "experiment",
  "experiment_variant",
]);

/**
 * Visual encoding that does not rest on colour.
 *
 * A reader who cannot distinguish the palette must still be able to tell an
 * observation from an inference, so provenance carries a line pattern and a
 * short word as well as a hue. Colour is the redundant channel here, not the
 * primary one.
 */
export const PROVENANCE_PATTERN: Record<Provenance, { dash: string; label: string }> = {
  OBSERVED: { dash: "none", label: "Observed" },
  CONFIGURED: { dash: "6 3", label: "Configured" },
  ENFORCED: { dash: "none", label: "Enforced" },
  INFERRED: { dash: "2 4", label: "Inferred" },
  UNKNOWN: { dash: "1 5", label: "Unknown" },
};
