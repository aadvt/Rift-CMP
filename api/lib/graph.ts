import {
  GRAPH_CAVEATS,
  MAX_DEPTH,
  MAX_EDGES,
  MAX_NODES,
  edgeId,
  nodeId,
  type ConsentGraph,
  type EvidenceRef,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphFilters,
  type GraphNode,
  type GraphNodeKind,
  type GraphSeverity,
  type Provenance,
} from "@rift-cmp/shared/graph";
import type {
  DriftFinding,
  ShadowTracker,
  VendorRecommendation,
} from "@rift-cmp/shared";
import type { ScanResultsResponse } from "@rift-cmp/shared";

/**
 * Building the graph from evidence that already exists.
 *
 * ## One rule, applied everywhere
 *
 * An edge is emitted when something in the store supports it, and not
 * otherwise. There is no pass that "connects up" the picture, no inferred
 * relationship added because a node looked lonely, and no node type that cannot
 * be populated.
 *
 * The result is a sparser graph than the specification's node list suggests, and
 * that is the correct outcome. A dense diagram whose lines are the diagram's own
 * idea of what ought to connect is worse than a thin one, because it is
 * indistinguishable from a diagram of real findings.
 *
 * ## Where each provenance comes from
 *
 *   `OBSERVED`   a crawler saw it: a page loaded a script, a request went to a
 *                host, a cookie was set during the scan.
 *   `CONFIGURED` an operator declared it: a purpose, an approved recommendation,
 *                the jurisdictions on a policy version.
 *   `ENFORCED`   the firewall decided about it.
 *   `INFERRED`   Rift matched it: a host against the catalogue, a cookie against
 *                a page. Nobody saw this; something computed it.
 *   `UNKNOWN`    a question that was asked and not answered.
 *
 * The distinction between the first and fourth is the one that matters most. A
 * tracker joined to a vendor by a catalogue lookup and a tracker seen sending
 * data to that vendor render identically on a canvas, and only one is evidence.
 */

export interface GraphInput {
  siteId: string;
  siteHost: string;
  scanId: string | null;
  policyVersion: number | null;
  results: ScanResultsResponse | null;
  approved: readonly VendorRecommendation[];
  purposes: ReadonlyArray<{ code: string; name: string; description: string; is_active: boolean }>;
  jurisdictions: readonly string[];
  shadowTrackers: readonly ShadowTracker[];
  drift: readonly DriftFinding[];
  enforcement: ReadonlyArray<{
    id: string;
    destinationHost: string | null;
    vendor: string | null;
    purpose: string | null;
    decision: string;
    effect: string;
    observedOnly: boolean;
    reason: string;
    severity: string;
    occurredAt: Date;
    source: string;
  }>;
  experiments: ReadonlyArray<{
    experiment_id: string;
    name: string;
    status: string;
    serving: boolean;
    policy_version_id: string | null;
    variants: ReadonlyArray<{ key: string; name: string; allocation: number; is_control: boolean }>;
  }>;
  now?: Date;
}

/** Collects nodes and edges while refusing duplicates and enforcing the caps. */
class Builder {
  readonly nodes = new Map<string, GraphNode>();
  readonly edges = new Map<string, GraphEdge>();
  nodesTruncated = false;
  edgesTruncated = false;

  node(
    kind: GraphNodeKind,
    key: string,
    node: Omit<GraphNode, "id" | "kind">,
  ): string | null {
    const id = nodeId(kind, key);

    const existing = this.nodes.get(id);
    if (existing) {
      // Merge evidence rather than replacing. The same tracker is reached from
      // a script, a request and the catalogue, and each pass knows something the
      // others do not.
      for (const ref of node.evidence) {
        if (!existing.evidence.some((e) => e.source === ref.source && e.ref === ref.ref)) {
          existing.evidence.push(ref);
        }
      }
      // A later, firmer provenance wins: something observed outranks something
      // inferred, and the node should say the strongest thing that is true.
      if (RANK[node.provenance] > RANK[existing.provenance]) {
        existing.provenance = node.provenance;
      }
      if (node.severity && (!existing.severity || SEVERITY_RANK[node.severity] > SEVERITY_RANK[existing.severity])) {
        existing.severity = node.severity;
      }
      return id;
    }

    if (this.nodes.size >= MAX_NODES) {
      this.nodesTruncated = true;
      return null;
    }

    this.nodes.set(id, { id, kind, ...node });
    return id;
  }

  edge(
    from: string | null,
    kind: GraphEdgeKind,
    to: string | null,
    edge: Omit<GraphEdge, "id" | "from" | "to" | "kind">,
  ): void {
    // A dropped node means its edges are dropped too, rather than pointing at
    // something the response does not contain.
    if (!from || !to) return;

    const id = edgeId(from, kind, to);
    const existing = this.edges.get(id);

    if (existing) {
      for (const ref of edge.evidence) {
        if (!existing.evidence.some((e) => e.source === ref.source && e.ref === ref.ref)) {
          existing.evidence.push(ref);
        }
      }
      if (RANK[edge.provenance] > RANK[existing.provenance]) {
        existing.provenance = edge.provenance;
        existing.label = edge.label;
      }
      return;
    }

    if (this.edges.size >= MAX_EDGES) {
      this.edgesTruncated = true;
      return;
    }

    this.edges.set(id, { id, from, to, kind, ...edge });
  }
}

/**
 * Which provenance outranks which, when two passes disagree.
 *
 * Observed and enforced sit at the top because both mean something happened.
 * Configured is a statement of intent. Inferred is a computation. Unknown is the
 * floor, so anything at all displaces it.
 */
const RANK: Record<Provenance, number> = {
  UNKNOWN: 0,
  INFERRED: 1,
  CONFIGURED: 2,
  ENFORCED: 3,
  OBSERVED: 3,
};

const SEVERITY_RANK: Record<GraphSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pathOf(raw: string): string {
  try {
    return new URL(raw).pathname || "/";
  } catch {
    return raw;
  }
}

/**
 * The graph for one site.
 *
 * Pure: it reads the input and returns a value. Everything that touches the
 * database happens before this is called, which is what lets the simulator run
 * the identical function over a hypothetical input and get a comparable answer.
 */
export function buildConsentGraph(input: GraphInput): ConsentGraph {
  const b = new Builder();
  const now = input.now ?? new Date();

  // ── Site ──
  const site = b.node("site", input.siteId, {
    label: input.siteHost,
    sublabel: input.policyVersion ? `configuration v${input.policyVersion}` : "no approved configuration",
    provenance: "CONFIGURED",
    severity: null,
    evidence: [
      { source: "policy", ref: input.policyVersion ? String(input.policyVersion) : null, detail: "The site as configured in Rift." },
    ],
    attributes: { host: input.siteHost, policy_version: input.policyVersion },
  });

  // ── Jurisdictions ──
  //
  // Declared by the operator as markets they serve, never derived from a
  // visitor. `CONFIGURED` for exactly that reason.
  for (const jurisdiction of input.jurisdictions) {
    const node = b.node("jurisdiction", jurisdiction, {
      label: jurisdiction,
      sublabel: "declared market",
      provenance: "CONFIGURED",
      severity: null,
      evidence: [
        {
          source: "policy",
          ref: input.policyVersion ? String(input.policyVersion) : null,
          detail: "Named on the approved configuration. Rift never geolocates a visitor.",
        },
      ],
      attributes: { code: jurisdiction },
    });

    b.edge(site, "applies_in", node, {
      label: "declared market",
      provenance: "CONFIGURED",
      severity: null,
      evidence: [{ source: "policy", ref: null, detail: "The operator declared this market." }],
    });
  }

  // ── Policy version ──
  const policyNode =
    input.policyVersion === null
      ? null
      : b.node("policy_version", String(input.policyVersion), {
          label: `Configuration v${input.policyVersion}`,
          sublabel: "approved",
          provenance: "CONFIGURED",
          severity: null,
          evidence: [
            { source: "policy", ref: String(input.policyVersion), detail: "The approved consent configuration." },
          ],
          attributes: { version: input.policyVersion },
        });

  if (policyNode) {
    b.edge(site, "governed_by", policyNode, {
      label: "approved configuration",
      provenance: "CONFIGURED",
      severity: null,
      evidence: [{ source: "policy", ref: String(input.policyVersion), detail: "In force for this site." }],
    });

    for (const jurisdiction of input.jurisdictions) {
      b.edge(policyNode, "applies_in", nodeId("jurisdiction", jurisdiction), {
        label: "judged under",
        provenance: "CONFIGURED",
        severity: null,
        evidence: [
          { source: "policy", ref: String(input.policyVersion), detail: "The configuration was generated against this jurisdiction." },
        ],
      });
    }
  }

  // ── Purposes and the categories they process ──
  for (const purpose of input.purposes) {
    if (!purpose.is_active) continue;

    const node = b.node("purpose", purpose.code, {
      label: purpose.name,
      sublabel: purpose.code,
      provenance: "CONFIGURED",
      severity: null,
      evidence: [
        { source: "policy", ref: purpose.code, detail: "Declared by the operator in the consent domain." },
      ],
      attributes: { code: purpose.code, description: purpose.description },
    });

    b.edge(site, "serves_purpose", node, {
      label: "declared",
      provenance: "CONFIGURED",
      severity: null,
      evidence: [{ source: "policy", ref: purpose.code, detail: "A purpose this site collects consent for." }],
    });
  }

  // ── Approved recommendations: vendor, purpose, categories, consent ──
  //
  // These are `CONFIGURED`: an operator approved them. Whether the vendor was
  // actually seen is a separate question, answered by the scan below.
  for (const rec of input.approved) {
    const vendor = b.node("vendor", rec.vendor_name, {
      label: rec.vendor_name,
      sublabel: rec.category,
      provenance: "CONFIGURED",
      severity: null,
      evidence: [
        {
          source: "policy",
          ref: rec.detector_id,
          detail: `Approved with the action "${rec.recommended_action}".`,
        },
      ],
      attributes: {
        category: rec.category,
        consent_requirement: rec.consent_requirement,
        recommended_action: rec.recommended_action,
        confidence: rec.confidence,
        observed_in_latest_scan: rec.observed_in_latest_scan,
      },
    });

    if (rec.suggested_purpose) {
      const purpose = b.node("purpose", rec.suggested_purpose, {
        label: rec.suggested_purpose,
        sublabel: "purpose",
        provenance: "CONFIGURED",
        severity: null,
        evidence: [{ source: "policy", ref: rec.detector_id, detail: "Named by the approved configuration." }],
        attributes: { code: rec.suggested_purpose },
      });

      b.edge(vendor, "serves_purpose", purpose, {
        label: "approved for",
        provenance: "CONFIGURED",
        severity: null,
        evidence: [{ source: "policy", ref: rec.detector_id, detail: rec.reason }],
      });

      // The engine's own answer, carried verbatim. `conditional` and `unknown`
      // are real answers and are never flattened into required/not required.
      if (rec.consent_requirement !== "not_required") {
        b.edge(purpose, "requires_consent", policyNode, {
          label: rec.consent_requirement,
          provenance: "CONFIGURED",
          severity: rec.consent_requirement === "unknown" ? "medium" : null,
          evidence: [
            {
              source: "policy",
              ref: rec.rule_references[0] ?? null,
              detail: `The engine found consent ${rec.consent_requirement} for ${rec.vendor_name}.`,
            },
          ],
        });
      }
    }

    for (const category of rec.data_categories) {
      const node = b.node("data_category", category, {
        label: category.replace(/_/g, " "),
        sublabel: "data category",
        provenance: "CONFIGURED",
        severity: null,
        evidence: [
          { source: "policy", ref: rec.detector_id, detail: "Attached by the regimes in play." },
        ],
        attributes: { code: category },
      });

      b.edge(vendor, "processes_category", node, {
        label: "may process",
        provenance: "CONFIGURED",
        severity: null,
        evidence: [
          { source: "policy", ref: rec.detector_id, detail: "Canonical category from the policy engine." },
        ],
      });

      if (rec.suggested_purpose) {
        b.edge(nodeId("purpose", rec.suggested_purpose), "processes_category", node, {
          label: "covers",
          provenance: "CONFIGURED",
          severity: null,
          evidence: [{ source: "policy", ref: rec.detector_id, detail: "Purpose to category, as configured." }],
        });
      }
    }

    // An approved action that gates or blocks is an enforcement rule.
    if (rec.recommended_action === "block" || rec.recommended_action === "require_consent") {
      const rule = b.node("enforcement_rule", rec.detector_id, {
        label: `${rec.recommended_action.replace(/_/g, " ")} ${rec.vendor_name}`,
        sublabel: "approved rule",
        provenance: "CONFIGURED",
        severity: null,
        evidence: [
          { source: "policy", ref: rec.detector_id, detail: `Derived from the approved action "${rec.recommended_action}".` },
        ],
        attributes: { action: rec.recommended_action, vendor: rec.vendor_name },
      });

      b.edge(vendor, "enforced_by", rule, {
        label: rec.recommended_action.replace(/_/g, " "),
        provenance: "CONFIGURED",
        severity: null,
        evidence: [{ source: "policy", ref: rec.detector_id, detail: "What the configuration says to do." }],
      });

      if (policyNode) {
        b.edge(policyNode, "enforced_by", rule, {
          label: "contains",
          provenance: "CONFIGURED",
          severity: null,
          evidence: [{ source: "policy", ref: String(input.policyVersion), detail: "Part of the approved set." }],
        });
      }
    }
  }

  // ── The scan: what was actually seen ──
  if (input.results) {
    const scanRef = (detail: string, observedAt?: string | null): EvidenceRef => ({
      source: "scan",
      ref: input.scanId,
      detail,
      observed_at: observedAt ?? input.results?.scan.completed_at ?? null,
    });

    for (const page of input.results.pages) {
      const pageNode = b.node("page", page.url, {
        label: pathOf(page.url),
        sublabel: page.title ?? page.url,
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef("Crawled during this scan.")],
        attributes: { url: page.url, status: page.status ?? null, title: page.title ?? null },
      });

      b.edge(site, "has_page", pageNode, {
        label: "crawled",
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef("Reached by the crawler.")],
      });
    }

    // Scripts: a page loading a third-party script is the clearest observation
    // in the whole dataset. An inline script has no host and nothing to point
    // at, so it contributes no node rather than an empty one.
    for (const script of input.results.scripts) {
      if (!script.third_party || !script.host) continue;

      const tracker = b.node("tracker", script.host, {
        label: script.host,
        sublabel: "script",
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef(`Loaded as a script from ${script.host}.`)],
        attributes: { host: script.host, kind: "script" },
      });

      b.edge(nodeId("page", script.observed_on), "loads", tracker, {
        label: "loads script",
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef(`The page loaded ${script.url ?? script.host}.`)],
      });
    }

    // Requests: a destination the page actually sent something to.
    // Requests are aggregated per host across the scan rather than per page, so
    // they connect a tracker to a destination and never a page to a request.
    // Claiming a page here would be an attribution the data does not carry.
    for (const request of input.results.requests) {
      if (!request.third_party) continue;

      const tracker = b.node("tracker", request.host, {
        label: request.host,
        sublabel: request.resource_type,
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef(`Requested during the scan (${request.resource_type}).`)],
        attributes: { host: request.host, kind: request.resource_type },
      });

      const destination = b.node("destination", request.host, {
        label: request.host,
        sublabel: "network destination",
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef("Data left the browser for this host.")],
        attributes: { host: request.host },
      });

      b.edge(tracker, "sends_to", destination, {
        label: request.method,
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef(`${request.method} to ${request.host}.`)],
      });
    }

    // Cookies. Attributed to the site rather than to a page, and marked
    // `INFERRED` where a page is claimed: the crawler records cookies per scan,
    // so a page attribution is a host match rather than a sighting.
    for (const cookie of input.results.cookies) {
      const node = b.node("cookie", `${cookie.domain}:${cookie.name}`, {
        label: cookie.name,
        sublabel: cookie.domain,
        provenance: "OBSERVED",
        severity: null,
        evidence: [scanRef(`Set during the scan for ${cookie.domain}.`)],
        attributes: {
          name: cookie.name,
          domain: cookie.domain,
          third_party: cookie.third_party,
        },
      });

      const owner = cookie.domain.replace(/^\./, "");
      b.edge(nodeId("tracker", owner), "sets_cookie", node, {
        label: "sets",
        provenance: "INFERRED",
        severity: null,
        evidence: [
          {
            source: "scan",
            ref: input.scanId,
            detail:
              "Matched to this host by domain. The crawler records cookies for a whole scan, not per page.",
          },
        ],
      });
    }

    // Technologies: the catalogue's opinion about a host. An inference, and
    // labelled as one — this is the edge most likely to be mistaken for a
    // sighting.
    for (const tech of input.results.technologies) {
      const vendor = b.node("vendor", tech.name, {
        label: tech.name,
        sublabel: tech.category,
        provenance: "INFERRED",
        severity: null,
        evidence: [
          {
            source: "catalogue",
            ref: tech.detector_id,
            detail: `Matched by the tracker catalogue with ${tech.confidence} confidence.`,
          },
        ],
        attributes: {
          category: tech.category,
          confidence: tech.confidence,
          destination_country: tech.destination_country ?? null,
          crosses_border: tech.crosses_border,
        },
      });

      // The hosts a detector actually matched on, from its own evidence. There
      // is no host list on a technology, and inventing one from the name would
      // fabricate exactly the kind of edge this file refuses to draw.
      const hosts = tech.evidence
        .filter((e) => e.type === "network_host" || e.type === "script")
        .map((e) => hostOf(e.value) ?? e.value)
        .filter((host): host is string => Boolean(host));

      for (const host of new Set(hosts)) {
        b.edge(nodeId("tracker", host), "operated_by", vendor, {
          label: "matched to",
          provenance: "INFERRED",
          severity: null,
          evidence: [
            {
              source: "catalogue",
              ref: tech.detector_id,
              // The distinction that matters: a lookup, not an observation.
              detail: "The catalogue associates this host with this vendor. Nobody observed the link.",
            },
          ],
        });
      }
    }
  }

  // ── Intelligence findings ──
  for (const finding of input.shadowTrackers) {
    const node = b.node("shadow_finding", finding.id, {
      label: finding.vendor ?? finding.host,
      sublabel: "unaccounted for",
      provenance: "OBSERVED",
      severity: finding.severity,
      evidence: finding.evidence.map((e) => ({
        source: e.source,
        ref: e.scan_id ?? null,
        detail: e.detail,
        observed_at: e.observed_at ?? null,
      })),
      attributes: {
        host: finding.host,
        reason: finding.reason,
        confidence: finding.confidence,
        crosses_border: finding.crosses_border,
        destination_country: finding.destination_country,
      },
    });

    b.edge(nodeId("tracker", finding.host), "flagged_as", node, {
      label: finding.reason.replace(/_/g, " "),
      provenance: "OBSERVED",
      severity: finding.severity,
      evidence: [{ source: "intelligence", ref: finding.id, detail: finding.recommended_action }],
    });

    for (const page of finding.pages) {
      b.edge(nodeId("page", page), "flagged_as", node, {
        label: "seen on",
        provenance: "OBSERVED",
        severity: finding.severity,
        evidence: [{ source: "intelligence", ref: finding.id, detail: `Observed on ${page}.` }],
      });
    }
  }

  for (const finding of input.drift) {
    const node = b.node("drift_finding", finding.id, {
      label: finding.vendor ?? finding.host ?? "Configuration",
      sublabel: finding.kind.replace(/_/g, " "),
      provenance: "OBSERVED",
      severity: finding.severity,
      evidence: finding.evidence.map((e) => ({
        source: e.source,
        ref: e.scan_id ?? null,
        detail: e.detail,
        observed_at: e.observed_at ?? null,
      })),
      attributes: {
        kind: finding.kind,
        previous_state: finding.previous_state,
        current_state: finding.current_state,
        policy_version: finding.policy_version,
      },
    });

    if (finding.host) {
      b.edge(nodeId("tracker", finding.host), "drifted", node, {
        label: finding.kind.replace(/_/g, " "),
        provenance: "OBSERVED",
        severity: finding.severity,
        evidence: [{ source: "intelligence", ref: finding.id, detail: finding.recommended_action }],
      });
    }
    if (finding.page) {
      b.edge(nodeId("page", finding.page), "drifted", node, {
        label: "changed on",
        provenance: "OBSERVED",
        severity: finding.severity,
        evidence: [{ source: "intelligence", ref: finding.id, detail: finding.current_state }],
      });
    }
  }

  // ── Enforcement ──
  //
  // What Rift actually did, as distinct from what the scan saw. The two are
  // deliberately separate node kinds so a reader can hold "data flowed here" and
  // "we acted on it" apart.
  for (const event of input.enforcement) {
    if (!event.destinationHost) continue;

    const node = b.node("enforcement_event", event.id, {
      label: event.decision,
      sublabel: event.observedOnly ? "observed, not applied" : event.effect,
      provenance: "ENFORCED",
      severity: (event.severity as GraphSeverity) ?? "info",
      evidence: [
        {
          source: "enforcement",
          ref: event.id,
          detail:
            event.source === "client"
              ? `${event.reason} Reported by a browser, so this is a claim about what the SDK did.`
              : event.reason,
          observed_at: event.occurredAt.toISOString(),
        },
      ],
      attributes: {
        decision: event.decision,
        effect: event.effect,
        observed_only: event.observedOnly,
        plane: event.source,
        purpose: event.purpose,
      },
    });

    b.edge(nodeId("destination", event.destinationHost), "decided", node, {
      label: event.decision,
      provenance: "ENFORCED",
      severity: (event.severity as GraphSeverity) ?? "info",
      evidence: [
        {
          source: "enforcement",
          ref: event.id,
          detail: event.observedOnly
            ? "Recorded in observe mode; nothing was actually stopped."
            : `The request was ${event.effect === "block" ? "stopped" : "permitted"}.`,
        },
      ],
    });
  }

  // ── Experiments ──
  //
  // An inactive experiment is shown and marked, never treated as production
  // truth: a draft describes a banner nobody has seen.
  for (const experiment of input.experiments) {
    const node = b.node("experiment", experiment.experiment_id, {
      label: experiment.name,
      sublabel: experiment.serving ? "assigning visitors" : experiment.status.toLowerCase(),
      provenance: "CONFIGURED",
      severity: null,
      evidence: [
        {
          source: "experiment",
          ref: experiment.experiment_id,
          detail: experiment.serving
            ? "Currently assigning visitors to arms."
            : `Status ${experiment.status}. Not serving, so it describes a banner nobody is being shown.`,
        },
      ],
      attributes: { status: experiment.status, serving: experiment.serving },
    });

    b.edge(site, "varies", node, {
      label: experiment.serving ? "running on" : experiment.status.toLowerCase(),
      provenance: "CONFIGURED",
      severity: null,
      evidence: [{ source: "experiment", ref: experiment.experiment_id, detail: "Consent UX experiment." }],
    });

    for (const variant of experiment.variants) {
      const variantNode = b.node("experiment_variant", `${experiment.experiment_id}:${variant.key}`, {
        label: variant.name,
        sublabel: `${variant.allocation}%${variant.is_control ? " · control" : ""}`,
        provenance: "CONFIGURED",
        severity: null,
        evidence: [
          {
            source: "experiment",
            ref: experiment.experiment_id,
            detail: "Varies banner copy only. It cannot change a purpose, a rule or enforcement.",
          },
        ],
        attributes: { key: variant.key, allocation: variant.allocation, is_control: variant.is_control },
      });

      b.edge(node, "varies", variantNode, {
        label: `${variant.allocation}%`,
        provenance: "CONFIGURED",
        severity: null,
        evidence: [{ source: "experiment", ref: experiment.experiment_id, detail: "One arm." }],
      });

      // Only when it is actually serving. Linking a draft to the live
      // configuration would suggest it is measured against it.
      if (experiment.serving && policyNode) {
        b.edge(variantNode, "measured_under", policyNode, {
          label: "runs against",
          provenance: "CONFIGURED",
          severity: null,
          evidence: [
            {
              source: "experiment",
              ref: experiment.experiment_id,
              detail: "Both arms are evaluated against this configuration; only the copy differs.",
            },
          ],
        });
      }
    }
  }

  const graph: ConsentGraph = {
    site_id: input.siteId,
    generated_at: now.toISOString(),
    scan_id: input.scanId,
    policy_version: input.policyVersion === null ? null : String(input.policyVersion),
    nodes: [...b.nodes.values()],
    edges: [...b.edges.values()],
    truncated: {
      nodes: b.nodesTruncated,
      edges: b.edgesTruncated,
      reason:
        b.nodesTruncated || b.edgesTruncated
          ? `This site has more than the ${MAX_NODES}-node limit. What is shown is a real subset, and an absent tracker here is not evidence it is absent from the site.`
          : null,
    },
    totals: {},
    caveats: [...GRAPH_CAVEATS],
    legal_advice: false,
  };

  for (const node of graph.nodes) {
    graph.totals[node.kind] = (graph.totals[node.kind] ?? 0) + 1;
  }

  return graph;
}

// ─── Filtering and traversal ─────────────────────────────────────────────────

/**
 * Narrow a graph.
 *
 * Applied after building rather than during, so a filter cannot change what an
 * edge means — only whether it is shown. Filtering during construction would let
 * a narrow query produce a *different* graph, and two views of one site that
 * disagree is worse than a slow one.
 */
export function filterGraph(graph: ConsentGraph, filters: GraphFilters): ConsentGraph {
  let nodes = graph.nodes;

  const matches = (node: GraphNode): boolean => {
    if (filters.severity && node.severity !== filters.severity) return false;
    if (filters.provenance && node.provenance !== filters.provenance) return false;
    if (filters.page && node.kind === "page" && !node.label.includes(filters.page)) return false;
    if (filters.tracker && node.kind === "tracker" && !node.label.includes(filters.tracker)) return false;
    if (filters.vendor && node.kind === "vendor" && !node.label.toLowerCase().includes(filters.vendor.toLowerCase())) {
      return false;
    }
    if (filters.purpose && node.kind === "purpose" && node.attributes.code !== filters.purpose) return false;
    if (filters.data_category && node.kind === "data_category" && node.attributes.code !== filters.data_category) {
      return false;
    }
    if (filters.jurisdiction && node.kind === "jurisdiction" && node.label !== filters.jurisdiction) return false;
    return true;
  };

  if (
    filters.severity ||
    filters.provenance ||
    filters.page ||
    filters.tracker ||
    filters.vendor ||
    filters.purpose ||
    filters.data_category ||
    filters.jurisdiction
  ) {
    nodes = nodes.filter(matches);
  }

  if (filters.focus) {
    nodes = neighbourhood(graph, filters.focus, Math.min(filters.depth ?? 1, MAX_DEPTH));
  }

  const keep = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((edge) => keep.has(edge.from) && keep.has(edge.to));

  const totals: Record<string, number> = {};
  for (const node of nodes) totals[node.kind] = (totals[node.kind] ?? 0) + 1;

  return { ...graph, nodes, edges, totals };
}

/** Nodes within `depth` hops of one node, in either direction. */
export function neighbourhood(graph: ConsentGraph, focus: string, depth: number): GraphNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  if (!byId.has(focus)) return [];

  const reached = new Set([focus]);
  let frontier = [focus];

  for (let hop = 0; hop < Math.max(1, Math.min(depth, MAX_DEPTH)); hop += 1) {
    const next: string[] = [];
    for (const edge of graph.edges) {
      if (frontier.includes(edge.from) && !reached.has(edge.to)) {
        reached.add(edge.to);
        next.push(edge.to);
      }
      if (frontier.includes(edge.to) && !reached.has(edge.from)) {
        reached.add(edge.from);
        next.push(edge.from);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  return graph.nodes.filter((node) => reached.has(node.id));
}
