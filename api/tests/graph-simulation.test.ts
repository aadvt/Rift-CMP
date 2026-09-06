/**
 * The graph and the simulator, without a database.
 *
 * Both are pure functions over an evidence set, which is what makes this file
 * possible at all — and the fact that it *is* possible is the strongest
 * statement of the design. A simulator that needed a database to be tested would
 * be a simulator that could write to one.
 *
 * The properties worth holding:
 *
 *   **Nothing is invented.** No edge without evidence behind it, no node type
 *   that cannot be populated. A dense diagram whose lines are the diagram's own
 *   idea of what connects is indistinguishable from a diagram of real findings.
 *
 *   **Provenance is never upgraded.** A catalogue lookup joining a tracker to a
 *   vendor is `INFERRED`. Rendering it as `OBSERVED` is this feature's most
 *   likely and most damaging failure, because on a canvas the two look the same
 *   and only one is evidence.
 *
 *   **The simulator changes nothing.** Asserted here as a value-level property:
 *   the evidence handed in comes back untouched.
 */
import { describe, expect, it } from "vitest";
import { buildConsentGraph, filterGraph, neighbourhood, type GraphInput } from "@/lib/graph";
import { simulate } from "@/lib/simulation";
import { MAX_DEPTH, nodeId } from "@rift-cmp/shared/graph";
import type { ScanResultsResponse, VendorRecommendation } from "@rift-cmp/shared";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function scanResults(over: Partial<ScanResultsResponse> = {}): ScanResultsResponse {
  return {
    scan: {
      scan_id: "scan-1",
      site_id: "site-1",
      status: "completed",
      started_at: "2026-09-01T10:00:00Z",
      completed_at: "2026-09-01T10:05:00Z",
      root_url: "https://example.com",
      error: null,
    } as unknown as ScanResultsResponse["scan"],
    summary: {} as ScanResultsResponse["summary"],
    consent_ui: { detected: false, signals: [] },
    pages: [
      { url: "https://example.com/", title: "Home", status: 200 } as never,
      { url: "https://example.com/checkout", title: "Checkout", status: 200 } as never,
    ],
    cookies: [
      { name: "_ga", domain: ".google-analytics.com", path: "/", expires: null, secure: true, http_only: false, same_site: null, third_party: true },
    ],
    scripts: [
      { url: "https://www.google-analytics.com/analytics.js", host: "www.google-analytics.com", inline: false, third_party: true, observed_on: "https://example.com/" },
      { url: null, host: null, inline: true, third_party: false, observed_on: "https://example.com/" },
    ],
    requests: [
      { host: "www.google-analytics.com", resource_type: "xhr", method: "POST", sample_path: "/collect", third_party: true, request_count: 4, failed_count: 0, status: 200 },
    ],
    storage: [],
    technologies: [
      {
        detector_id: "google-analytics",
        name: "Google Analytics",
        category: "analytics",
        confidence: "high",
        evidence: [{ type: "network_host", value: "www.google-analytics.com" }],
        destination_country: "US",
        crosses_border: true,
      },
    ],
    ...over,
  } as ScanResultsResponse;
}

function recommendation(over: Partial<VendorRecommendation> = {}): VendorRecommendation {
  return {
    detector_id: "google-analytics",
    vendor_name: "Google Analytics",
    category: "analytics",
    suggested_purpose: "analytics",
    data_categories: ["behavioural_data"],
    jurisdictions: ["EU"],
    consent_requirement: "required",
    opt_out_requirement: "unknown",
    recommended_action: "require_consent",
    reason: "Analytics requires consent in the declared markets.",
    confidence: "high",
    evidence: [],
    rule_references: ["gdpr-art6"],
    overridden: false,
    override_note: null,
    observed_in_latest_scan: true,
    ...over,
  } as VendorRecommendation;
}

function graphInput(over: Partial<GraphInput> = {}): GraphInput {
  return {
    siteId: "site-1",
    siteHost: "example.com",
    scanId: "scan-1",
    policyVersion: 3,
    results: scanResults(),
    approved: [recommendation()],
    purposes: [
      { code: "analytics", name: "Analytics", description: "Usage", is_active: true },
      { code: "retired", name: "Retired", description: "Old", is_active: false },
    ],
    jurisdictions: ["EU"],
    shadowTrackers: [],
    drift: [],
    enforcement: [],
    experiments: [],
    now: new Date("2026-09-06T00:00:00Z"),
    ...over,
  };
}

// ─── Nodes ───────────────────────────────────────────────────────────────────

describe("nodes come from evidence", () => {
  it("builds a site, its pages and its purposes", () => {
    const graph = buildConsentGraph(graphInput());

    expect(graph.nodes.find((n) => n.kind === "site")?.label).toBe("example.com");
    expect(graph.nodes.filter((n) => n.kind === "page")).toHaveLength(2);
    // Only the active purpose. An inactive one is not something the site asks
    // about, and a node for it would be a box with no meaning.
    expect(graph.nodes.filter((n) => n.kind === "purpose").map((n) => n.attributes.code)).toContain(
      "analytics",
    );
    expect(graph.nodes.some((n) => n.attributes.code === "retired")).toBe(false);
  });

  it("makes a tracker from an observed script", () => {
    const graph = buildConsentGraph(graphInput());
    const tracker = graph.nodes.find((n) => n.id === nodeId("tracker", "www.google-analytics.com"));

    expect(tracker?.provenance).toBe("OBSERVED");
    expect(tracker?.evidence.some((e) => e.source === "scan")).toBe(true);
  });

  it("does not make a node from an inline script", () => {
    // An inline script has no host and nothing to point at. A node for it would
    // be an empty box.
    const graph = buildConsentGraph(graphInput());
    expect(graph.nodes.some((n) => n.kind === "tracker" && n.label === "")).toBe(false);
  });

  it("builds no scan nodes at all when there is no scan", () => {
    const graph = buildConsentGraph(graphInput({ results: null, scanId: null }));

    expect(graph.nodes.some((n) => n.kind === "page")).toBe(false);
    // The configured half still exists: purposes and jurisdictions are declared,
    // not observed.
    expect(graph.nodes.some((n) => n.kind === "purpose")).toBe(true);
    expect(graph.nodes.some((n) => n.kind === "jurisdiction")).toBe(true);
  });

  it("counts what it produced", () => {
    const graph = buildConsentGraph(graphInput());
    expect(graph.totals.page).toBe(2);
    expect(graph.totals.site).toBe(1);
  });
});

// ─── Provenance ──────────────────────────────────────────────────────────────

describe("provenance says how a thing is known", () => {
  it("marks a page loading a script as observed", () => {
    const graph = buildConsentGraph(graphInput());
    const edge = graph.edges.find((e) => e.kind === "loads");
    expect(edge?.provenance).toBe("OBSERVED");
  });

  it("marks a catalogue match as inferred, never observed", () => {
    // The single most important assertion in this file. A tracker joined to a
    // vendor by a lookup and one seen sending data to that vendor render
    // identically, and only the second is evidence.
    const graph = buildConsentGraph(graphInput());
    const edge = graph.edges.find((e) => e.kind === "operated_by");

    expect(edge?.provenance).toBe("INFERRED");
    expect(edge?.evidence[0]?.detail).toMatch(/nobody observed/i);
  });

  it("marks a declared jurisdiction as configured", () => {
    const graph = buildConsentGraph(graphInput());
    const edge = graph.edges.find((e) => e.kind === "applies_in");

    expect(edge?.provenance).toBe("CONFIGURED");
    expect(
      graph.nodes.find((n) => n.kind === "jurisdiction")?.evidence[0]?.detail,
    ).toMatch(/never geolocates/i);
  });

  it("marks a cookie attribution as inferred", () => {
    // The crawler records cookies for a whole scan, not per page, so tying one
    // to a host is a match rather than a sighting.
    const graph = buildConsentGraph(graphInput());
    const edge = graph.edges.find((e) => e.kind === "sets_cookie");

    expect(edge?.provenance).toBe("INFERRED");
    expect(edge?.evidence[0]?.detail).toMatch(/not per page/i);
  });

  it("marks an enforcement decision as enforced", () => {
    const graph = buildConsentGraph(
      graphInput({
        enforcement: [
          {
            id: "ev-1",
            destinationHost: "www.google-analytics.com",
            vendor: "Google Analytics",
            purpose: "analytics",
            decision: "REQUIRE_CONSENT",
            effect: "block",
            observedOnly: false,
            reason: "Silence is not consent.",
            severity: "medium",
            occurredAt: new Date("2026-09-02T00:00:00Z"),
            source: "server",
          },
        ],
      }),
    );

    const edge = graph.edges.find((e) => e.kind === "decided");
    expect(edge?.provenance).toBe("ENFORCED");
  });

  it("says a client-reported decision is a claim", () => {
    const graph = buildConsentGraph(
      graphInput({
        enforcement: [
          {
            id: "ev-2",
            destinationHost: "www.google-analytics.com",
            vendor: null,
            purpose: null,
            decision: "BLOCK",
            effect: "block",
            observedOnly: false,
            reason: "Blocked.",
            severity: "medium",
            occurredAt: new Date("2026-09-02T00:00:00Z"),
            source: "client",
          },
        ],
      }),
    );

    const node = graph.nodes.find((n) => n.kind === "enforcement_event");
    expect(node?.evidence[0]?.detail).toMatch(/claim about what the SDK did/i);
  });

  it("keeps the firmer provenance when two passes disagree", () => {
    // A vendor is inferred from the catalogue and configured by an approval. The
    // node should say the strongest true thing, not the last one written.
    const graph = buildConsentGraph(graphInput());
    const vendor = graph.nodes.find((n) => n.id === nodeId("vendor", "google analytics"));
    expect(vendor?.provenance).toBe("CONFIGURED");
  });
});

// ─── Evidence ────────────────────────────────────────────────────────────────

describe("evidence is traceable", () => {
  it("names the scan behind an observation", () => {
    const graph = buildConsentGraph(graphInput());
    const page = graph.nodes.find((n) => n.kind === "page");
    expect(page?.evidence[0]).toMatchObject({ source: "scan", ref: "scan-1" });
  });

  it("names the configuration behind an approval", () => {
    const graph = buildConsentGraph(graphInput());
    const vendor = graph.nodes.find((n) => n.kind === "vendor");
    expect(vendor?.evidence.some((e) => e.source === "policy")).toBe(true);
  });

  it("carries no personal data", () => {
    const graph = buildConsentGraph(graphInput());
    const serialised = JSON.stringify(graph);

    // Nothing about a visitor reaches the graph: no principal, no session, no
    // address. The consent log is deliberately not a source here.
    expect(serialised).not.toMatch(/principal/i);
    expect(serialised).not.toMatch(/session_token|principal_secret/i);
  });

  it("ships its caveats with the data", () => {
    const graph = buildConsentGraph(graphInput());
    expect(graph.caveats.join(" ")).toMatch(/inferred relationship is not evidence/i);
    expect(graph.caveats.join(" ")).toMatch(/absence here is not evidence of absence/i);
  });
});

// ─── Findings ────────────────────────────────────────────────────────────────

describe("intelligence findings appear as nodes", () => {
  const shadow = {
    id: "shadow-1",
    host: "www.google-analytics.com",
    vendor: "Google Analytics",
    category: "analytics",
    reason: "not_configured" as const,
    severity: "medium" as const,
    pages: ["https://example.com/"],
    destination_country: "US",
    crosses_border: true,
    confidence: "high" as const,
    approved: false,
    purpose: null,
    policy_action: null,
    evidence: [{ source: "scan" as const, detail: "Observed.", scan_id: "scan-1" }],
    recommended_action: "Review it.",
    first_seen: null,
    last_seen: null,
  };

  it("connects a shadow finding to its tracker and page", () => {
    const graph = buildConsentGraph(graphInput({ shadowTrackers: [shadow] as never }));

    expect(graph.nodes.some((n) => n.kind === "shadow_finding")).toBe(true);
    expect(
      graph.edges.some((e) => e.kind === "flagged_as" && e.from === nodeId("page", "https://example.com/")),
    ).toBe(true);
  });

  it("carries the finding's severity onto the edge", () => {
    const graph = buildConsentGraph(graphInput({ shadowTrackers: [shadow] as never }));
    const edge = graph.edges.find((e) => e.kind === "flagged_as");
    expect(edge?.severity).toBe("medium");
  });

  it("connects a drift finding", () => {
    const graph = buildConsentGraph(
      graphInput({
        drift: [
          {
            id: "drift-1",
            kind: "tracker_added",
            severity: "high",
            host: "www.google-analytics.com",
            vendor: "Google Analytics",
            page: null,
            previous_state: "Not present",
            current_state: "Observed",
            policy_version: 3,
            evidence: [{ source: "scan", detail: "Present now.", scan_id: "scan-1" }],
            recommended_action: "Review.",
          } as never,
        ],
      }),
    );

    expect(graph.nodes.some((n) => n.kind === "drift_finding")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "drifted")).toBe(true);
  });
});

// ─── Experiments ─────────────────────────────────────────────────────────────

describe("experiments are shown without being treated as production", () => {
  const experiment = (serving: boolean, status: string) => ({
    experiment_id: "exp-1",
    name: "Reject wording",
    status,
    serving,
    policy_version_id: null,
    variants: [
      { key: "control", name: "Control", allocation: 50, is_control: true },
      { key: "b", name: "B", allocation: 50, is_control: false },
    ],
  });

  it("links a serving experiment to the live configuration", () => {
    const graph = buildConsentGraph(graphInput({ experiments: [experiment(true, "RUNNING")] }));
    expect(graph.edges.some((e) => e.kind === "measured_under")).toBe(true);
  });

  it("does not link a draft to the live configuration", () => {
    // A draft describes a banner nobody has been shown. Linking it would suggest
    // it is being measured against the live configuration.
    const graph = buildConsentGraph(graphInput({ experiments: [experiment(false, "DRAFT")] }));

    expect(graph.nodes.some((n) => n.kind === "experiment")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "measured_under")).toBe(false);
  });

  it("says an inactive experiment is not serving", () => {
    const graph = buildConsentGraph(graphInput({ experiments: [experiment(false, "PAUSED")] }));
    const node = graph.nodes.find((n) => n.kind === "experiment");

    expect(node?.sublabel).toBe("paused");
    expect(node?.evidence[0]?.detail).toMatch(/nobody is being shown/i);
  });
});

// ─── Filtering and traversal ─────────────────────────────────────────────────

describe("filtering and traversal", () => {
  it("narrows to one provenance", () => {
    const graph = buildConsentGraph(graphInput());
    const observed = filterGraph(graph, { provenance: "OBSERVED" });

    expect(observed.nodes.every((n) => n.provenance === "OBSERVED")).toBe(true);
    // Edges to dropped nodes go too, rather than pointing at something absent.
    const kept = new Set(observed.nodes.map((n) => n.id));
    expect(observed.edges.every((e) => kept.has(e.from) && kept.has(e.to))).toBe(true);
  });

  it("narrows to a neighbourhood", () => {
    const graph = buildConsentGraph(graphInput());
    const focused = filterGraph(graph, {
      focus: nodeId("tracker", "www.google-analytics.com"),
      depth: 1,
    });

    expect(focused.nodes.length).toBeLessThan(graph.nodes.length);
    expect(focused.nodes.some((n) => n.id === nodeId("tracker", "www.google-analytics.com"))).toBe(true);
  });

  it("caps traversal depth", () => {
    const graph = buildConsentGraph(graphInput());
    const deep = neighbourhood(graph, nodeId("site", "site-1"), 99);
    const capped = neighbourhood(graph, nodeId("site", "site-1"), MAX_DEPTH);
    expect(deep.length).toBe(capped.length);
  });

  it("returns nothing for a node that does not exist", () => {
    // A made-up id must not become a traversal into somebody else's data.
    const graph = buildConsentGraph(graphInput());
    expect(neighbourhood(graph, "tracker:not-a-real-node", 2)).toEqual([]);
  });

  it("recounts totals after filtering", () => {
    const graph = buildConsentGraph(graphInput());
    const filtered = filterGraph(graph, { provenance: "CONFIGURED" });
    expect(filtered.totals.page ?? 0).toBe(0);
  });
});

// ─── The simulator ───────────────────────────────────────────────────────────

function evidence() {
  return {
    scanId: "scan-1",
    baselineScanId: null,
    lastCompletedScanAt: new Date("2026-09-01T10:05:00Z"),
    results: scanResults(),
    baseline: null,
    approved: [recommendation()],
    policyVersion: 3,
    jurisdictions: ["EU"],
    runtime: [],
    purposes: [
      { code: "analytics", name: "Analytics", description: "Usage", is_active: true } as never,
    ],
    decisions: 10,
    decisionsWithProof: 10,
  };
}

const currentQuality = {
  score: 82,
  band: "strong",
  components: [{ id: "consent_coverage", label: "Consent coverage", earned: 15 }],
};

function run(changes: Parameters<typeof simulate>[0]["changes"]) {
  return simulate({
    siteId: "site-1",
    scenarioName: "Scenario",
    evidence: evidence() as never,
    changes,
    currentQuality,
    now: new Date("2026-09-06T00:00:00Z"),
  });
}

describe("the simulator changes nothing", () => {
  it("leaves the evidence it was given untouched", () => {
    // The value-level statement of the guarantee. The structural one is that
    // this module imports no database client at all.
    const original = evidence();
    const snapshot = JSON.stringify(original);

    simulate({
      siteId: "site-1",
      scenarioName: "Scenario",
      evidence: original as never,
      changes: [
        { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
        { operation: "remove_tracker", tracker: "Google Analytics" },
        { operation: "add_jurisdiction", jurisdiction: "US-CA" },
      ],
      currentQuality,
      now: new Date(),
    });

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("marks every result hypothetical", () => {
    const result = run([{ operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" }]);

    expect(result.hypothetical).toBe(true);
    expect(result.caveats.join(" ")).toMatch(/running it changed nothing/i);
    expect(result.caveats.join(" ")).toMatch(/not a production score/i);
  });

  it("names the real configuration it started from", () => {
    const result = run([]);
    expect(result.base_policy_version).toBe("3");
    expect(result.base_scan_id).toBe("scan-1");
  });
});

describe("simulation operations", () => {
  it("adds a tracker and finds its consent requirement", () => {
    const result = run([
      { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
    ]);

    expect(result.inventory.added).toContain("Hotjar");
    expect(result.inventory.trackers).toBe(1);
    expect(result.findings.some((f) => f.area === "inventory")).toBe(true);
  });

  it("refuses to add a tracker with no category, and says why", () => {
    // The engine derives a purpose and a consent finding from the category. A
    // scenario without one asks a question the engine cannot answer, and
    // guessing would produce a confident wrong answer.
    const result = run([{ operation: "add_tracker", tracker: "unknown.example" }]);

    expect(result.unsupported).toHaveLength(1);
    expect(result.unsupported[0]?.reason).toMatch(/category is needed/i);
    expect(result.inventory.added).toHaveLength(0);
  });

  it("removes a tracker", () => {
    const result = run([{ operation: "remove_tracker", tracker: "Google Analytics" }]);
    expect(result.inventory.removed).toContain("Google Analytics");
    expect(result.inventory.trackers).toBe(-1);
  });

  it("says so when there is nothing to remove", () => {
    const result = run([{ operation: "remove_tracker", tracker: "not-on-this-site.example" }]);
    expect(result.unsupported[0]?.reason).toMatch(/nothing to remove/i);
  });

  it("adds a jurisdiction and reports the regimes it brings", () => {
    const result = run([{ operation: "add_jurisdiction", jurisdiction: "US-CA" }]);

    expect(result.jurisdiction.added).toContain("US-CA");
    expect(result.findings.some((f) => f.area === "jurisdiction")).toBe(true);
  });

  it("removes a jurisdiction", () => {
    const result = run([{ operation: "remove_jurisdiction", jurisdiction: "EU" }]);
    expect(result.jurisdiction.removed).toContain("EU");
    expect(result.jurisdiction.after).not.toContain("EU");
  });

  it("overrides an approved action", () => {
    const result = run([
      { operation: "set_enforcement", tracker: "Google Analytics", action: "block" },
    ]);
    expect(result.consent.requirements.some((r) => r.to === "block")).toBe(true);
  });

  it("rejects an action the configuration cannot hold", () => {
    const result = run([
      { operation: "set_enforcement", tracker: "Google Analytics", action: "delete_everything" },
    ]);
    expect(result.unsupported[0]?.reason).toMatch(/not an action/i);
  });

  it("models turning enforcement on", () => {
    const result = run([{ operation: "set_enforcement_mode", mode: "enforce" }]);
    expect(result.enforcement.simulated).toBe("enforce");
  });

  it("rejects an unknown mode", () => {
    const result = run([{ operation: "set_enforcement_mode", mode: "maximum" }]);
    expect(result.unsupported[0]?.reason).toMatch(/off, observe or enforce/i);
  });

  it("reports an operation it cannot evaluate rather than ignoring it", () => {
    const result = run([{ operation: "teleport_tracker" as never }]);
    expect(result.unsupported).toHaveLength(1);
    expect(result.findings.every((f) => f.area !== "inventory")).toBe(true);
  });

  it("handles an empty scenario without inventing a change", () => {
    const result = run([]);
    expect(result.inventory.added).toEqual([]);
    expect(result.inventory.removed).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });
});

describe("what a simulation reports", () => {
  it("gives every finding a reason", () => {
    // A result an operator cannot check is one they cannot defend, and this
    // surface exists to support a decision somebody will have to argue for.
    const result = run([
      { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
      { operation: "add_jurisdiction", jurisdiction: "US-CA" },
    ]);

    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.because.length).toBeGreaterThan(0);
    }
  });

  it("keeps the real score and the simulated one apart", () => {
    const result = run([
      { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
    ]);

    expect(result.quality.current_score).toBe(82);
    expect(typeof result.quality.simulated_score).toBe("number");
    // Two named fields, never one number that could be mistaken for the other.
    expect(Object.keys(result.quality)).toContain("simulated_score");
    expect(Object.keys(result.quality)).toContain("current_score");
  });

  it("reports a new shadow tracker when a change would create one", () => {
    const result = run([
      { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
    ]);
    expect(result.intelligence.shadow_after).toBeGreaterThanOrEqual(result.intelligence.shadow_before);
  });

  it("never claims to be a legal conclusion", () => {
    expect(run([]).legal_advice).toBe(false);
  });
});
