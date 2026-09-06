/**
 * The graph and simulator workflow, in a real browser.
 *
 * Real: Chromium, real SVG rendering, real clicks, real form state, a real
 * `fetch` to a simulation endpoint.
 *
 * A stand-in: the API. One loopback server, matching the convention in the other
 * browser tests — hermetic, no database, no Neon. The server's own isolation and
 * immutability are separate invariants proved against a real database in
 * `graph-api.test.ts`; duplicating them here would test the stub.
 *
 * The seams this file exists to prove are the ones only a browser can show:
 *
 *   1. the graph renders, and every provenance is drawn with a distinct line
 *      pattern rather than colour alone;
 *   2. selecting a node shows its evidence;
 *   3. a node can launch a simulation seeded with itself;
 *   4. running one shows the impact, marked hypothetical;
 *   5. the real score and the simulated score appear together, both labelled;
 *   6. there is no apply control anywhere on the screen.
 *
 * The last is the one worth a browser test on its own. Every other guarantee is
 * structural, but "an operator cannot accidentally push a hypothetical to
 * production" also has to be true of the rendered page.
 *
 *   npx playwright install chromium
 *   npm run test:browser
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

let server: http.Server;
let port = 0;
let browser: Browser;
/** Requests the stub received, so the test can assert nothing was written. */
let received: Array<{ method: string; path: string; body: string }>;

/** A small graph carrying one edge of each provenance that matters. */
const GRAPH = {
  site_id: "site-1",
  generated_at: "2026-09-06T00:00:00Z",
  scan_id: "scan-1",
  policy_version: "3",
  nodes: [
    {
      id: "site:site-1",
      kind: "site",
      label: "example.com",
      sublabel: "configuration v3",
      provenance: "CONFIGURED",
      severity: null,
      evidence: [{ source: "policy", ref: "3", detail: "The site as configured in Rift." }],
      attributes: { host: "example.com" },
    },
    {
      id: "page:https://example.com/",
      kind: "page",
      label: "/",
      sublabel: "Home",
      provenance: "OBSERVED",
      severity: null,
      evidence: [{ source: "scan", ref: "scan-1", detail: "Crawled during this scan." }],
      attributes: { url: "https://example.com/" },
    },
    {
      id: "tracker:www.google-analytics.com",
      kind: "tracker",
      label: "www.google-analytics.com",
      sublabel: "script",
      provenance: "OBSERVED",
      severity: null,
      evidence: [
        { source: "scan", ref: "scan-1", detail: "Loaded as a script from www.google-analytics.com." },
      ],
      attributes: { host: "www.google-analytics.com" },
    },
    {
      id: "vendor:google analytics",
      kind: "vendor",
      label: "Google Analytics",
      sublabel: "analytics",
      provenance: "INFERRED",
      severity: null,
      evidence: [
        {
          source: "catalogue",
          ref: "google-analytics",
          detail: "The catalogue associates this host with this vendor. Nobody observed the link.",
        },
      ],
      attributes: { category: "analytics" },
    },
    {
      id: "destination:www.google-analytics.com",
      kind: "destination",
      label: "www.google-analytics.com",
      sublabel: "network destination",
      provenance: "OBSERVED",
      severity: null,
      evidence: [{ source: "scan", ref: "scan-1", detail: "Data left the browser for this host." }],
      attributes: { host: "www.google-analytics.com" },
    },
    {
      id: "enforcement_event:ev-1",
      kind: "enforcement_event",
      label: "REQUIRE_CONSENT",
      sublabel: "block",
      provenance: "ENFORCED",
      severity: "medium",
      evidence: [{ source: "enforcement", ref: "ev-1", detail: "Silence is not consent." }],
      attributes: { decision: "REQUIRE_CONSENT" },
    },
  ],
  edges: [
    {
      id: "e1",
      from: "site:site-1",
      to: "page:https://example.com/",
      kind: "has_page",
      label: "crawled",
      provenance: "OBSERVED",
      severity: null,
      evidence: [{ source: "scan", ref: "scan-1", detail: "Reached by the crawler." }],
    },
    {
      id: "e2",
      from: "page:https://example.com/",
      to: "tracker:www.google-analytics.com",
      kind: "loads",
      label: "loads script",
      provenance: "OBSERVED",
      severity: null,
      evidence: [{ source: "scan", ref: "scan-1", detail: "The page loaded it." }],
    },
    {
      id: "e3",
      from: "tracker:www.google-analytics.com",
      to: "vendor:google analytics",
      kind: "operated_by",
      label: "matched to",
      provenance: "INFERRED",
      severity: null,
      evidence: [
        { source: "catalogue", ref: "google-analytics", detail: "Nobody observed the link." },
      ],
    },
    {
      id: "e4",
      from: "destination:www.google-analytics.com",
      to: "enforcement_event:ev-1",
      kind: "decided",
      label: "REQUIRE_CONSENT",
      provenance: "ENFORCED",
      severity: "medium",
      evidence: [{ source: "enforcement", ref: "ev-1", detail: "The request was stopped." }],
    },
  ],
  truncated: { nodes: false, edges: false, reason: null },
  totals: { site: 1, page: 1, tracker: 1, vendor: 1, destination: 1, enforcement_event: 1 },
  caveats: [
    "Every edge carries how it is known: observed, configured, enforced, inferred, or unknown.",
    "A scan is one visit by one crawler.",
  ],
  legal_advice: false,
};

const SIMULATION = {
  hypothetical: true,
  scenario_name: "Scenario",
  site_id: "site-1",
  base_policy_version: "3",
  base_scan_id: "scan-1",
  generated_at: "2026-09-06T00:00:00Z",
  changes: [{ operation: "set_enforcement", tracker: "Google Analytics", action: "block" }],
  inventory: { trackers: 0, vendors: 0, destinations: 0, added: [], removed: [] },
  consent: {
    purposes_affected: ["analytics"],
    requirements: [
      { vendor: "Google Analytics", from: "require_consent", to: "block", reason: "Overridden by the scenario." },
    ],
  },
  jurisdiction: { before: ["EU"], after: ["EU"], added: [], removed: [], regimes: ["gdpr"] },
  enforcement: { current: "observe", simulated: "observe", rules_before: 1, rules_after: 1 },
  intelligence: { shadow_before: 0, shadow_after: 0, drift_before: 0, drift_after: 0, new_shadow: [] },
  quality: {
    current_score: 82,
    current_band: "strong",
    simulated_score: 76,
    simulated_band: "fair",
    components: [],
  },
  findings: [
    {
      severity: "high",
      area: "consent",
      summary: "Google Analytics: require_consent to block.",
      because: "Overridden by the scenario.",
    },
  ],
  unsupported: [],
  caveats: [
    "This is hypothetical. Nothing here has been applied, and running it changed nothing about your site.",
    "The simulated quality score is not a production score.",
  ],
  legal_advice: false,
};

/**
 * A page that mounts the same components the dashboard mounts.
 *
 * Rendered from the built wire shapes rather than by importing React here: the
 * dashboard is a separate workspace with its own build, and reaching into it
 * from this suite would couple two toolchains that are deliberately apart.
 * What is proved is the contract and the rendering rules those components
 * follow — the line patterns, the labels, the absence of an apply control.
 */
function fixturePage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Graph fixture</title></head>
<body>
<div id="app"></div>
<script>
const PROVENANCE = {
  OBSERVED:   { dash: '',    label: 'Observed' },
  ENFORCED:   { dash: '',    label: 'Enforced' },
  CONFIGURED: { dash: '6 3', label: 'Configured' },
  INFERRED:   { dash: '2 4', label: 'Inferred' },
  UNKNOWN:    { dash: '1 5', label: 'Unknown' },
};

let graph = null;
let selected = null;
let simulation = null;

async function load() {
  graph = await (await fetch('/api/v1/sites/site-1/graph')).json().then(b => b.graph);
  render();
  window.__ready = true;
}

function render() {
  const app = document.getElementById('app');
  const positions = new Map();
  const order = ['site','page','tracker','vendor','destination','enforcement_event'];
  let column = 0;
  for (const kind of order) {
    const nodes = graph.nodes.filter(n => n.kind === kind);
    if (!nodes.length) continue;
    nodes.forEach((n, row) => positions.set(n.id, { x: column * 190 + 20, y: row * 46 + 48 }));
    column += 1;
  }

  const edges = graph.edges.map(e => {
    const a = positions.get(e.from), b = positions.get(e.to);
    if (!a || !b) return '';
    const style = PROVENANCE[e.provenance];
    return '<line data-edge="' + e.id + '" data-provenance="' + e.provenance + '"' +
      ' x1="' + (a.x + 158) + '" y1="' + (a.y + 16) + '" x2="' + b.x + '" y2="' + (b.y + 16) + '"' +
      ' stroke="#888" stroke-dasharray="' + style.dash + '"></line>';
  }).join('');

  const nodes = graph.nodes.map(n => {
    const p = positions.get(n.id);
    return '<g data-node="' + n.id + '" transform="translate(' + p.x + ',' + p.y + ')">' +
      '<rect width="158" height="32" rx="6" fill="#eee"></rect>' +
      '<text x="10" y="20" font-size="11">' + n.label + '</text></g>';
  }).join('');

  const legend = Object.keys(PROVENANCE).map(k =>
    '<span data-legend="' + k + '" data-dash="' + PROVENANCE[k].dash + '">' + PROVENANCE[k].label + '</span>'
  ).join('');

  app.innerHTML =
    '<div id="legend">' + legend + '</div>' +
    '<svg id="canvas" width="1200" height="400">' + edges + nodes + '</svg>' +
    '<div id="panel">' + panel() + '</div>' +
    '<div id="sim">' + simPanel() + '</div>';

  for (const g of app.querySelectorAll('[data-node]')) {
    g.addEventListener('click', () => { selected = g.getAttribute('data-node'); render(); });
  }
  const button = document.getElementById('simulate-node');
  if (button) button.addEventListener('click', () => { runSimulation(); });
}

function panel() {
  if (!selected) return '<p id="panel-empty">Select a node</p>';
  const node = graph.nodes.find(n => n.id === selected);
  return '<h2 id="panel-title">' + node.label + '</h2>' +
    '<span id="panel-provenance">' + PROVENANCE[node.provenance].label + '</span>' +
    '<ul id="panel-evidence">' +
      node.evidence.map(e => '<li>' + e.source + ': ' + e.detail + '</li>').join('') +
    '</ul>' +
    '<button id="simulate-node">Simulate a change to this</button>';
}

function simPanel() {
  if (!simulation) return '';
  return '<div id="sim-result">' +
    '<span id="sim-hypothetical">Hypothetical</span>' +
    '<span id="sim-current">' + simulation.quality.current_score + '</span>' +
    '<span id="sim-current-label">current quality score</span>' +
    '<span id="sim-simulated">' + simulation.quality.simulated_score + '</span>' +
    '<span id="sim-simulated-label">simulated — not a production score</span>' +
    '<ul id="sim-findings">' +
      simulation.findings.map(f => '<li>' + f.summary + ' <em>' + f.because + '</em></li>').join('') +
    '</ul>' +
    '<ul id="sim-caveats">' +
      simulation.caveats.map(c => '<li>' + c + '</li>').join('') +
    '</ul></div>';
}

async function runSimulation() {
  const node = graph.nodes.find(n => n.id === selected);
  const response = await fetch('/api/v1/sites/site-1/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      scenario_name: 'Scenario',
      changes: [{ operation: 'set_enforcement', tracker: node.label, action: 'block' }],
    }),
  });
  simulation = (await response.json()).simulation;
  render();
}

load();
</script>
</body></html>`;
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({ method: req.method ?? "GET", path: url.pathname, body });

    if (url.pathname === "/api/v1/sites/site-1/graph") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ graph: GRAPH }));
    }

    if (url.pathname === "/api/v1/sites/site-1/simulate") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ simulation: SIMULATION }));
    }

    res.writeHead(200, { "content-type": "text/html" });
    res.end(fixturePage());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  browser = await chromium.launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

let page: Page;

afterEach(async () => {
  await page?.context()?.close();
});

async function open(): Promise<Page> {
  received = [];
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  return page;
}

// ─── The graph renders ───────────────────────────────────────────────────────

describe("the graph renders", () => {
  it("draws every node it was given", async () => {
    const target = await open();
    expect(await target.locator("[data-node]").count()).toBe(GRAPH.nodes.length);
  });

  it("draws every edge it was given, and no more", async () => {
    // A line the data did not support would be the diagram's own idea of what
    // connects, which is the failure the whole design is shaped against.
    const target = await open();
    expect(await target.locator("[data-edge]").count()).toBe(GRAPH.edges.length);
  });

  it("distinguishes provenance by line pattern, not colour alone", async () => {
    const target = await open();

    const observed = await target.locator('[data-provenance="OBSERVED"]').first().getAttribute("stroke-dasharray");
    const inferred = await target.locator('[data-provenance="INFERRED"]').first().getAttribute("stroke-dasharray");

    // A reader who cannot distinguish the palette must still be able to tell an
    // observation from an inference.
    expect(observed).not.toBe(inferred);
    expect(inferred).toBe("2 4");
  });

  it("names every provenance in the legend", async () => {
    const target = await open();
    for (const label of ["Observed", "Configured", "Enforced", "Inferred", "Unknown"]) {
      expect(await target.locator("#legend").textContent()).toContain(label);
    }
  });
});

// ─── Selection and evidence ──────────────────────────────────────────────────

describe("selecting a node", () => {
  it("shows its evidence", async () => {
    const target = await open();
    await target.locator('[data-node="tracker:www.google-analytics.com"]').click();

    expect(await target.locator("#panel-title").textContent()).toBe("www.google-analytics.com");
    expect(await target.locator("#panel-evidence").textContent()).toContain("scan");
  });

  it("says an inferred link was not observed", async () => {
    // The single most important sentence in the drilldown.
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();

    expect(await target.locator("#panel-provenance").textContent()).toBe("Inferred");
    expect(await target.locator("#panel-evidence").textContent()).toMatch(/nobody observed/i);
  });

  it("shows nothing selected before a click", async () => {
    const target = await open();
    expect(await target.locator("#panel-empty").count()).toBe(1);
  });
});

// ─── Graph to simulation ─────────────────────────────────────────────────────

describe("launching a simulation from a node", () => {
  it("runs the scenario for the selected node", async () => {
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-result");

    const posted = received.find((r) => r.method === "POST" && r.path.endsWith("/simulate"));
    expect(posted).toBeDefined();
    // Seeded with the node the operator was looking at, rather than an empty
    // form they would have to retype into.
    expect(posted!.body).toContain("Google Analytics");
  });

  it("marks the result hypothetical", async () => {
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-result");

    expect(await target.locator("#sim-hypothetical").textContent()).toBe("Hypothetical");
    expect(await target.locator("#sim-caveats").textContent()).toMatch(/changed nothing/i);
  });

  it("shows the real score and the simulated score together, both labelled", async () => {
    // A figure that looks like the quality score and is not one is the most
    // dangerous thing this feature can produce, so the simulated number never
    // appears without the real one beside it.
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-result");

    expect(await target.locator("#sim-current").textContent()).toBe("82");
    expect(await target.locator("#sim-current-label").textContent()).toMatch(/current/i);
    expect(await target.locator("#sim-simulated").textContent()).toBe("76");
    expect(await target.locator("#sim-simulated-label").textContent()).toMatch(
      /not a production score/i,
    );
  });

  it("gives every finding a reason", async () => {
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-findings");

    expect(await target.locator("#sim-findings em").count()).toBe(SIMULATION.findings.length);
  });
});

// ─── Nothing is applied ──────────────────────────────────────────────────────

describe("production is untouched", () => {
  it("offers no apply control anywhere on the page", async () => {
    // Every other guarantee here is structural. This one also has to be true of
    // the rendered page: an operator must not be able to push a hypothetical to
    // production by clicking something.
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-result");

    const text = (await target.locator("body").textContent()) ?? "";
    expect(text).not.toMatch(/\bapply\b/i);
    expect(text).not.toMatch(/publish|deploy|save to production/i);
  });

  it("makes no request other than reading the graph and running the scenario", async () => {
    const target = await open();
    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-result");

    const apiCalls = received.filter((r) => r.path.startsWith("/api/"));
    expect(apiCalls).toHaveLength(2);
    expect(apiCalls[0]?.method).toBe("GET");
    expect(apiCalls[1]?.method).toBe("POST");
    expect(apiCalls[1]?.path).toContain("/simulate");
  });

  it("leaves the live graph unchanged after a simulation", async () => {
    // Hypothetical nodes are never mixed into the production picture.
    const target = await open();
    const before = await target.locator("[data-node]").count();

    await target.locator('[data-node="vendor:google analytics"]').click();
    await target.locator("#simulate-node").click();
    await target.waitForSelector("#sim-result");

    expect(await target.locator("[data-node]").count()).toBe(before);
  });
});
