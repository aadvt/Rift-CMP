/**
 * The graph and simulation endpoints, viewed as an attack surface.
 *
 * A graph is an unusually attractive target. It is, by design, a complete
 * picture of what runs on a site, what it sends where, and what governs it —
 * which is precisely the report a competitor would most like about somebody
 * else's business. And a traversal API invites exactly the attack a REST
 * endpoint does not: hand it an identifier and see what comes back.
 *
 * So the isolation here is structural rather than a check. A node id is resolved
 * *inside the graph built for the requested site*. There is no id-to-record
 * lookup that could be pointed elsewhere, which means a crafted id from another
 * tenant is not forbidden — it is simply not present.
 *
 * The second half is Step 34's mandate: production state is captured before a
 * simulation and compared after. That is the value-level check. The structural
 * one is that `lib/simulation.ts` imports no database client at all, so there is
 * no write path to exercise.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { GET as siteGraph } from "@/app/api/v1/sites/[siteId]/graph/route";
import { GET as nodeDetail } from "@/app/api/v1/sites/[siteId]/graph/nodes/[nodeId]/route";
import { POST as runSimulation } from "@/app/api/v1/sites/[siteId]/simulate/route";
import { createOwnershipTree, managementRequest, resetDatabase, siteParams } from "./helpers/fixtures";

let tree: Awaited<ReturnType<typeof createOwnershipTree>>;

beforeEach(async () => {
  await resetDatabase();
  tree = await createOwnershipTree();
});

function graph(siteId: string, key: string, query: Record<string, string> = {}) {
  return siteGraph(
    managementRequest(`/api/v1/sites/${siteId}/graph`, { key, query }),
    siteParams(siteId),
  );
}

function node(siteId: string, nodeId: string, key: string) {
  return nodeDetail(
    managementRequest(`/api/v1/sites/${siteId}/graph/nodes/${encodeURIComponent(nodeId)}`, { key }),
    { params: Promise.resolve({ siteId, nodeId: encodeURIComponent(nodeId) }) },
  );
}

function simulate(siteId: string, key: string, body: Record<string, unknown>) {
  return runSimulation(
    managementRequest(`/api/v1/sites/${siteId}/simulate`, { key, method: "POST", body }),
    siteParams(siteId),
  );
}

// ─── Graph access ────────────────────────────────────────────────────────────

describe("GET /sites/[siteId]/graph", () => {
  it("returns a graph for a site the caller owns", async () => {
    const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      graph: { site_id: string; nodes: unknown[]; caveats: string[] };
    };
    expect(body.graph.site_id).toBe(tree.siteA1.siteId);
    // A site with no scan still has a graph: purposes and jurisdictions are
    // declared rather than observed.
    expect(Array.isArray(body.graph.nodes)).toBe(true);
    expect(body.graph.caveats.length).toBeGreaterThan(0);
  });

  it("refuses a site in another organisation, with a real key", async () => {
    const response = await graph(tree.siteA1.siteId, tree.orgB.secretKey);
    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await siteGraph(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/graph`),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(401);
  });

  it("refuses the site's own public key", async () => {
    // `pk_` is in every visitor's page source. If it opened the graph, a site's
    // entire tracker inventory and configuration would be public.
    const response = await graph(tree.siteA1.siteId, tree.siteA1.publicKey);
    expect(response.status).toBe(401);
  });

  it("never contains another site's data", async () => {
    const response = await graph(tree.siteB1.siteId, tree.orgB.secretKey);
    const text = await response.text();

    expect(text).not.toContain(tree.siteA1.siteId);
    expect(text).not.toContain(tree.siteA2.siteId);
  });

  it("rejects an unknown provenance rather than ignoring it", async () => {
    // Silently dropping it would return an unfiltered graph to somebody who
    // asked for a filtered one, and they would read it as filtered.
    const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey, {
      provenance: "DEFINITELY_TRUE",
    });
    expect(response.status).toBe(400);
  });

  it("rejects an unknown severity", async () => {
    const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey, { severity: "urgent" });
    expect(response.status).toBe(400);
  });

  it("rejects a depth outside the bound", async () => {
    // An unbounded traversal on a large site is a way to make the server do
    // arbitrary work on request.
    for (const depth of ["0", "99", "-1", "abc"]) {
      const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey, { depth });
      expect(response.status, depth).toBe(400);
    }
  });

  it("accepts a depth inside the bound", async () => {
    const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey, { depth: "2" });
    expect(response.status).toBe(200);
  });

  it("says when it truncated", async () => {
    const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey);
    const body = (await response.json()) as { graph: { truncated: { nodes: boolean } } };
    // A truncated graph that does not say so is one an operator reads as
    // complete, and "no tracker on that page" is the conclusion they must not
    // draw from a node cap.
    expect(body.graph.truncated).toHaveProperty("nodes");
    expect(body.graph.truncated).toHaveProperty("reason");
  });
});

// ─── Node traversal ──────────────────────────────────────────────────────────

describe("GET /sites/[siteId]/graph/nodes/[nodeId]", () => {
  async function anyNodeId(): Promise<string> {
    const response = await graph(tree.siteA1.siteId, tree.orgA.secretKey);
    const body = (await response.json()) as { graph: { nodes: Array<{ id: string }> } };
    return body.graph.nodes[0]!.id;
  }

  it("returns a node with its neighbours and evidence", async () => {
    const id = await anyNodeId();
    const response = await node(tree.siteA1.siteId, id, tree.orgA.secretKey);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      detail: { node: { id: string; evidence: unknown[] }; neighbours: unknown[] };
    };
    expect(body.detail.node.id).toBe(id);
    expect(Array.isArray(body.detail.neighbours)).toBe(true);
  });

  it("offers only simulations the engine can actually evaluate", async () => {
    const id = await anyNodeId();
    const response = await node(tree.siteA1.siteId, id, tree.orgA.secretKey);
    const body = (await response.json()) as {
      detail: { simulations: Array<{ operation: string }> };
    };

    const supported = new Set([
      "add_tracker",
      "remove_tracker",
      "reclassify_tracker",
      "add_jurisdiction",
      "remove_jurisdiction",
      "set_enforcement",
      "set_enforcement_mode",
    ]);
    for (const simulation of body.detail.simulations) {
      expect(supported.has(simulation.operation)).toBe(true);
    }
  });

  it("refuses a node id in another tenant's site", async () => {
    const id = await anyNodeId();
    const response = await node(tree.siteA1.siteId, id, tree.orgB.secretKey);
    expect(response.status).toBe(404);
  });

  it("refuses a node from one site when asked on another", async () => {
    // The isolation is structural: a node from site A is not present in the
    // graph built for site B, so there is nothing to forbid.
    const id = await anyNodeId();
    const response = await node(tree.siteA2.siteId, id, tree.orgA.secretKey);
    expect(response.status).toBe(404);
  });

  it.each([
    ["a made-up id", "tracker:not-a-real-node"],
    ["a wrong-shaped id", "definitely-not-a-node"],
    ["a path traversal", "../../../etc/passwd"],
    ["a SQL fragment", "tracker:'; DROP TABLE websites;--"],
    ["an empty kind", ":value"],
  ])("refuses %s", async (_label, id) => {
    const response = await node(tree.siteA1.siteId, id, tree.orgA.secretKey);
    // Either not a node identifier at all, or not one in this graph. Neither
    // reaches a record.
    expect([400, 404]).toContain(response.status);
  });

  it("refuses an unauthenticated caller", async () => {
    const id = await anyNodeId();
    const response = await nodeDetail(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/graph/nodes/${id}`),
      { params: Promise.resolve({ siteId: tree.siteA1.siteId, nodeId: id }) },
    );
    expect(response.status).toBe(401);
  });
});

// ─── Simulation access ───────────────────────────────────────────────────────

describe("POST /sites/[siteId]/simulate", () => {
  it("runs a scenario for a site the caller owns", async () => {
    const response = await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "Add a session recorder",
      changes: [
        { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
      ],
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      simulation: { hypothetical: boolean; caveats: string[]; quality: Record<string, unknown> };
    };

    expect(body.simulation.hypothetical).toBe(true);
    expect(body.simulation.caveats.join(" ")).toMatch(/changed nothing/i);
    // Two named fields, so no consumer can mistake one for the other.
    expect(body.simulation.quality).toHaveProperty("current_score");
    expect(body.simulation.quality).toHaveProperty("simulated_score");
  });

  it("refuses a site in another organisation", async () => {
    const response = await simulate(tree.siteA1.siteId, tree.orgB.secretKey, {
      scenario_name: "x",
      changes: [],
    });
    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await runSimulation(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/simulate`, {
        method: "POST",
        body: { scenario_name: "x", changes: [] },
      }),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(401);
  });

  it("refuses the site's own public key", async () => {
    const response = await simulate(tree.siteA1.siteId, tree.siteA1.publicKey, {
      scenario_name: "x",
      changes: [],
    });
    expect(response.status).toBe(401);
  });

  it("rejects an operation the engine cannot evaluate", async () => {
    const response = await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: [{ operation: "delete_all_consent_records" }],
    });
    expect(response.status).toBe(400);
  });

  it("bounds how many changes one scenario may carry", async () => {
    // A hundred changes is not a scenario, it is a migration, and it belongs in
    // the configuration workflow rather than here.
    const response = await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: Array.from({ length: 40 }, () => ({
        operation: "add_jurisdiction",
        jurisdiction: "EU",
      })),
    });
    expect(response.status).toBe(400);
  });

  it("returns live and simulated graphs separately when asked", async () => {
    const response = await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "Compare",
      changes: [{ operation: "add_jurisdiction", jurisdiction: "US-CA" }],
      include_graph: true,
    });

    const body = (await response.json()) as {
      live: { site_id: string };
      simulated: { site_id: string };
      simulation: { hypothetical: boolean };
    };

    // Two graphs, never merged. Mixing hypothetical nodes into the production
    // picture is the one presentation this feature must not offer.
    expect(body.live).toBeDefined();
    expect(body.simulated).toBeDefined();
    expect(body.simulation.hypothetical).toBe(true);
  });
});

// ─── Step 34: production is untouched ────────────────────────────────────────

describe("a simulation mutates nothing", () => {
  /** Everything a simulation could plausibly be accused of changing. */
  async function snapshot() {
    const [
      policyVersions,
      purposes,
      consentRecords,
      enforcementEvents,
      experiments,
      experimentEvents,
      scans,
      overrides,
      websites,
    ] = await Promise.all([
      prisma.consentPolicyVersion.findMany({ orderBy: { id: "asc" } }),
      prisma.purpose.findMany({ orderBy: { id: "asc" } }),
      prisma.consentRecord.findMany({ orderBy: { id: "asc" } }),
      prisma.enforcementEvent.findMany({ orderBy: { id: "asc" } }),
      prisma.experiment.findMany({ orderBy: { id: "asc" } }),
      prisma.experimentEvent.findMany({ orderBy: { id: "asc" } }),
      prisma.scan.findMany({ orderBy: { id: "asc" } }),
      prisma.consentRecommendationOverride.findMany({ orderBy: { id: "asc" } }),
      prisma.website.findMany({ orderBy: { id: "asc" } }),
    ]);

    return JSON.stringify({
      policyVersions,
      purposes,
      consentRecords,
      enforcementEvents,
      experiments,
      experimentEvents,
      scans,
      overrides,
      websites,
    });
  }

  it("leaves every production table byte-identical", async () => {
    // Seeded so the snapshot has something to be identical about — comparing two
    // empty databases would pass whether or not the guarantee held.
    await prisma.purpose.create({
      data: {
        organisationId: tree.orgA.organisationId,
        code: "analytics",
        name: "Analytics",
        description: "Usage",
      },
    });
    await prisma.consentPolicyVersion.create({
      data: {
        siteId: tree.siteA1.siteId,
        organisationId: tree.orgA.organisationId,
        version: 1,
        status: "approved",
        jurisdictions: ["EU"],
        regimes: ["gdpr"],
        approvedAt: new Date(),
        recommendations: [],
      },
    });

    const before = await snapshot();

    // Every operation the simulator supports, in one scenario, including ones
    // that sound like writes.
    const response = await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "Everything at once",
      changes: [
        { operation: "add_tracker", tracker: "hotjar.com", vendor: "Hotjar", category: "session_replay" },
        { operation: "remove_tracker", tracker: "Google Analytics" },
        { operation: "reclassify_tracker", tracker: "Hotjar", category: "advertising" },
        { operation: "add_jurisdiction", jurisdiction: "US-CA" },
        { operation: "remove_jurisdiction", jurisdiction: "EU" },
        { operation: "set_enforcement", tracker: "Hotjar", action: "block" },
        { operation: "set_enforcement_mode", mode: "enforce" },
      ],
      include_graph: true,
    });

    expect(response.status).toBe(200);
    expect(await snapshot()).toBe(before);
  });

  it("writes no consent record", async () => {
    const before = await prisma.consentRecord.count();
    await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: [{ operation: "set_enforcement_mode", mode: "enforce" }],
    });
    expect(await prisma.consentRecord.count()).toBe(before);
  });

  it("writes no enforcement event", async () => {
    const before = await prisma.enforcementEvent.count();
    await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: [{ operation: "set_enforcement", tracker: "Hotjar", action: "block" }],
    });
    expect(await prisma.enforcementEvent.count()).toBe(before);
  });

  it("creates no policy version", async () => {
    const before = await prisma.consentPolicyVersion.count();
    await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: [{ operation: "add_jurisdiction", jurisdiction: "US-CA" }],
    });
    expect(await prisma.consentPolicyVersion.count()).toBe(before);
  });

  it("creates no experiment", async () => {
    const before = await prisma.experiment.count();
    await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: [{ operation: "add_tracker", tracker: "h.example", vendor: "H", category: "analytics" }],
    });
    expect(await prisma.experiment.count()).toBe(before);
  });

  it("offers no apply action on this path", async () => {
    // There is deliberately no way from here to production. Applying goes
    // through the ordinary configuration workflow, with its own approval — a
    // shortcut here would be a policy bypass wearing a different name.
    const response = await simulate(tree.siteA1.siteId, tree.orgA.secretKey, {
      scenario_name: "x",
      changes: [],
      apply: true,
    });

    // The extra field is simply not part of the contract and changes nothing.
    expect(response.status).toBe(200);
    expect(await prisma.consentPolicyVersion.count()).toBe(0);
  });
});
