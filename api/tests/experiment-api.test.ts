/**
 * The experiment endpoints, viewed as an attack surface.
 *
 * An experiment changes what a real visitor is shown on a real site. That makes
 * these routes more dangerous than the read-only ones: a successful write here
 * does not leak information, it alters somebody's consent banner. So the tests
 * are weighted towards refusal, and towards the specific refusals that matter:
 *
 *   **Cross-tenant writes.** A caller authenticates against their own
 *   organisation and names another tenant's site or experiment.
 *
 *   **Policy bypass.** A variant that tries to carry purposes, enforcement, or a
 *   policy version the tenant never approved.
 *
 *   **Allocation manipulation.** Percentages that leave visitors unassigned or
 *   double-assigned, so a rate is taken over a denominator nobody can state.
 *
 *   **Lifecycle abuse.** Restarting a completed experiment, editing one that has
 *   already assigned people, running two at once on the same banner.
 *
 * And one that is not refusal: an experiment's copy must actually reach the
 * banner, or none of the rest matters.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { GET as listExperiments, POST as createExperiment } from "@/app/api/v1/experiments/route";
import {
  GET as getExperiment,
  PATCH as patchExperiment,
} from "@/app/api/v1/experiments/[experimentId]/route";
import { POST as setStatus } from "@/app/api/v1/experiments/[experimentId]/status/route";
import { GET as experimentAnalytics } from "@/app/api/v1/experiments/[experimentId]/analytics/route";
import { GET as policyAnalytics } from "@/app/api/v1/sites/[siteId]/policy-analytics/route";
import { GET as consentConfig } from "@/app/api/v1/consent/config/route";
import { createOwnershipTree, managementRequest, resetDatabase, siteRequest } from "./helpers/fixtures";

let tree: Awaited<ReturnType<typeof createOwnershipTree>>;

beforeEach(async () => {
  await resetDatabase();
  tree = await createOwnershipTree();
});

function experimentParams(experimentId: string) {
  return { params: Promise.resolve({ experimentId }) };
}

const TWO_ARMS = [
  { key: "control", name: "Control", allocation: 50, is_control: true },
  { key: "b", name: "Softer refusal", allocation: 50, text: { reject_all: "No thanks" } },
];

function create(body: Record<string, unknown>, key = tree.orgA.secretKey) {
  return createExperiment(
    managementRequest("/api/v1/experiments", { key, method: "POST", body }),
  );
}

/**
 * The response body is read here, so callers get it back rather than reading it
 * again — a `Response` body is a stream and can only be consumed once.
 */
async function createOne(over: Record<string, unknown> = {}) {
  const response = await create({
    site_id: tree.siteA1.siteId,
    name: "Reject wording",
    variants: TWO_ARMS,
    ...over,
  });
  const body = (await response.json()) as {
    experiment?: {
      experiment_id: string;
      status: string;
      serving: boolean;
      variants: unknown[];
    };
  };
  return { response, body, id: body.experiment?.experiment_id ?? "" };
}

// ─── Creation ────────────────────────────────────────────────────────────────

describe("POST /experiments", () => {
  it("creates an experiment in DRAFT", async () => {
    const { response, body } = await createOne();
    expect(response.status).toBe(201);

    // Nothing serves a visitor until an operator starts it deliberately, the
    // same posture enforcement takes about observe mode.
    expect(body.experiment?.status).toBe("DRAFT");
    expect(body.experiment?.serving).toBe(false);
    expect(body.experiment?.variants).toHaveLength(2);
  });

  it("refuses a site in another organisation", async () => {
    const response = await create(
      { site_id: tree.siteA1.siteId, name: "x", variants: TWO_ARMS },
      tree.orgB.secretKey,
    );
    expect(response.status).toBe(404);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await createExperiment(
      managementRequest("/api/v1/experiments", {
        method: "POST",
        body: { site_id: tree.siteA1.siteId, name: "x", variants: TWO_ARMS },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("refuses the site's own public key", async () => {
    const response = await create(
      { site_id: tree.siteA1.siteId, name: "x", variants: TWO_ARMS },
      tree.siteA1.publicKey,
    );
    expect(response.status).toBe(401);
  });

  it("rejects allocations that do not sum to 100", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "control", name: "C", allocation: 40, is_control: true },
        { key: "b", name: "B", allocation: 40 },
      ],
    });

    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toMatch(/sum to exactly 100/i);
    expect(await prisma.experiment.count()).toBe(0);
  });

  it("rejects a negative allocation", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "control", name: "C", allocation: 120, is_control: true },
        { key: "b", name: "B", allocation: -20 },
      ],
    });
    expect(response.status).toBe(422);
  });

  it("rejects duplicate variant keys", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "a", name: "A", allocation: 50, is_control: true },
        { key: "a", name: "A2", allocation: 50 },
      ],
    });
    expect(response.status).toBe(422);
  });

  it("rejects an experiment with one arm", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [{ key: "only", name: "Only", allocation: 100, is_control: true }],
    });
    expect(response.status).toBe(422);
  });

  it("rejects an experiment with no control", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "a", name: "A", allocation: 50 },
        { key: "b", name: "B", allocation: 50 },
      ],
    });
    expect(response.status).toBe(422);
  });
});

// ─── The safety boundary ─────────────────────────────────────────────────────

describe("a variant cannot carry a policy", () => {
  it.each([
    ["purposes", { purposes: [] }],
    ["enforcement", { enforcement: { mode: "off" } }],
    ["policy_version_id", { policy_version_id: "x" }],
    ["consent_required", { consent_required: false }],
    ["jurisdictions", { jurisdictions: ["EU"] }],
  ])("rejects a variant carrying %s", async (_label, text) => {
    // Rejected at the schema boundary rather than stripped: an operator whose
    // override was silently dropped would believe the experiment varies
    // something it does not, and read the null result as evidence.
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "control", name: "C", allocation: 50, is_control: true },
        { key: "b", name: "B", allocation: 50, text },
      ],
    });

    expect(response.status).toBe(400);
    expect(await prisma.experiment.count()).toBe(0);
  });

  it("refuses to blank the reject control", async () => {
    // An experiment may reword refusal. It may not remove it.
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "control", name: "C", allocation: 50, is_control: true },
        { key: "b", name: "B", allocation: 50, text: { reject_all: "   " } },
      ],
    });

    expect(response.status).toBe(422);
    expect(await response.text()).toMatch(/may not remove it/i);
  });

  it("refuses to blank the preference control", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      variants: [
        { key: "control", name: "C", allocation: 50, is_control: true },
        { key: "b", name: "B", allocation: 50, text: { manage: "" } },
      ],
    });
    expect(response.status).toBe(422);
  });

  it("refuses a policy version this tenant never approved", async () => {
    const response = await create({
      site_id: tree.siteA1.siteId,
      name: "x",
      policy_version_id: "00000000-0000-4000-8000-000000000000",
      variants: TWO_ARMS,
    });

    expect(response.status).toBe(422);
    expect(await response.text()).toMatch(/not the approved consent configuration/i);
  });

  it("accepts an experiment that only rewords", async () => {
    const { response } = await createOne();
    expect(response.status).toBe(201);
  });
});

// ─── Reading ─────────────────────────────────────────────────────────────────

describe("reading experiments", () => {
  it("lists only this tenant's experiments", async () => {
    await createOne();

    const response = await listExperiments(
      managementRequest("/api/v1/experiments", { key: tree.orgB.secretKey }),
    );
    const body = (await response.json()) as { experiments: unknown[] };
    expect(body.experiments).toHaveLength(0);
  });

  it("refuses a site filter naming another tenant's site", async () => {
    const response = await listExperiments(
      managementRequest("/api/v1/experiments", {
        key: tree.orgB.secretKey,
        query: { site_id: tree.siteA1.siteId },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("refuses to fetch another tenant's experiment", async () => {
    const { id } = await createOne();
    const response = await getExperiment(
      managementRequest(`/api/v1/experiments/${id}`, { key: tree.orgB.secretKey }),
      experimentParams(id),
    );
    // The same answer as for one that does not exist, so ids cannot be
    // enumerated by watching the status code.
    expect(response.status).toBe(404);
  });

  it("rejects an unknown status filter", async () => {
    const response = await listExperiments(
      managementRequest("/api/v1/experiments", {
        key: tree.orgA.secretKey,
        query: { status: "LAUNCHED" },
      }),
    );
    expect(response.status).toBe(400);
  });
});

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe("lifecycle", () => {
  function move(id: string, status: string, key = tree.orgA.secretKey) {
    return setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        key,
        method: "POST",
        body: { status },
      }),
      experimentParams(id),
    );
  }

  it("starts a draft experiment", async () => {
    const { id } = await createOne();
    const response = await move(id, "RUNNING");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { experiment: { status: string; serving: boolean } };
    expect(body.experiment.status).toBe("RUNNING");
    expect(body.experiment.serving).toBe(true);
  });

  it("refuses to restart a completed experiment", async () => {
    const { id } = await createOne();
    await move(id, "RUNNING");
    await move(id, "COMPLETED");

    const response = await move(id, "RUNNING");
    expect(response.status).toBe(409);
    expect(await response.text()).toMatch(/cannot become running/i);
  });

  it("refuses to jump from draft to completed", async () => {
    const { id } = await createOne();
    expect((await move(id, "COMPLETED")).status).toBe(409);
  });

  it("refuses a second running experiment on the same site", async () => {
    // Two experiments varying one banner interact, and the two results cannot
    // be separated afterwards from anything that was kept.
    const first = await createOne();
    await move(first.id, "RUNNING");

    const second = await createOne({ name: "Another" });
    const response = await move(second.id, "RUNNING");

    expect(response.status).toBe(409);
    expect(await response.text()).toMatch(/already running/i);
  });

  it("allows a second experiment once the first has completed", async () => {
    const first = await createOne();
    await move(first.id, "RUNNING");
    await move(first.id, "COMPLETED");

    const second = await createOne({ name: "Another" });
    expect((await move(second.id, "RUNNING")).status).toBe(200);
  });

  it("refuses to change another tenant's experiment", async () => {
    const { id } = await createOne();
    expect((await move(id, "RUNNING", tree.orgB.secretKey)).status).toBe(404);

    const row = await prisma.experiment.findFirst({ where: { id } });
    expect(row?.status).toBe("DRAFT");
  });

  it("refuses an unauthenticated status change", async () => {
    const { id } = await createOne();
    const response = await setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        method: "POST",
        body: { status: "RUNNING" },
      }),
      experimentParams(id),
    );
    expect(response.status).toBe(401);
  });

  it("rejects an unknown status", async () => {
    const { id } = await createOne();
    expect((await move(id, "LAUNCHED")).status).toBe(400);
  });
});

// ─── Editing ─────────────────────────────────────────────────────────────────

describe("editing", () => {
  function patch(id: string, body: Record<string, unknown>, key = tree.orgA.secretKey) {
    return patchExperiment(
      managementRequest(`/api/v1/experiments/${id}`, { key, method: "PATCH", body }),
      experimentParams(id),
    );
  }

  it("edits a draft", async () => {
    const { id } = await createOne();
    const response = await patch(id, { name: "Renamed" });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { experiment: { name: string } };
    expect(body.experiment.name).toBe("Renamed");
  });

  it("refuses to edit a running experiment", async () => {
    // Changing an allocation mid-run moves some visitors between arms, so a
    // decision taken under one banner would be counted against another.
    const { id } = await createOne();
    await setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { status: "RUNNING" },
      }),
      experimentParams(id),
    );

    const response = await patch(id, { name: "Renamed" });
    expect(response.status).toBe(409);
    expect(await response.text()).toMatch(/already assigned|cannot be edited/i);
  });

  it("rejects an edit that breaks the allocation", async () => {
    const { id } = await createOne();
    const response = await patch(id, {
      variants: [
        { key: "control", name: "C", allocation: 10, is_control: true },
        { key: "b", name: "B", allocation: 10 },
      ],
    });
    expect(response.status).toBe(422);
  });

  it("refuses to edit another tenant's experiment", async () => {
    const { id } = await createOne();
    expect((await patch(id, { name: "Hijacked" }, tree.orgB.secretKey)).status).toBe(404);

    const row = await prisma.experiment.findFirst({ where: { id } });
    expect(row?.name).toBe("Reject wording");
  });
});

// ─── The banner actually changes ─────────────────────────────────────────────

describe("a running experiment reaches the browser", () => {
  it("is absent from the config while the experiment is a draft", async () => {
    await createOne();
    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await response.json()) as { experiment?: unknown };
    expect(body.experiment ?? null).toBeNull();
  });

  it("appears once it is running, with copy and allocation only", async () => {
    const { id } = await createOne();
    await setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { status: "RUNNING" },
      }),
      experimentParams(id),
    );

    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await response.json()) as {
      experiment: { experiment_id: string; variants: Array<Record<string, unknown>> };
    };

    expect(body.experiment.experiment_id).toBe(id);
    expect(body.experiment.variants).toHaveLength(2);

    // Copy and allocation, and nothing that would let a browser reason about
    // the experiment or reach anything else.
    for (const variant of body.experiment.variants) {
      expect(Object.keys(variant).sort()).toEqual(["allocation", "key", "text"]);
    }
  });

  it("does not leak status, dates or the policy version to the browser", async () => {
    const { id } = await createOne();
    await setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { status: "RUNNING" },
      }),
      experimentParams(id),
    );

    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await response.json()) as { experiment: Record<string, unknown> };
    expect(Object.keys(body.experiment).sort()).toEqual(["experiment_id", "variants"]);
  });

  it("changes the config version, so caches do not serve the old banner", async () => {
    const before = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const beforeBody = (await before.json()) as { config_version: string };

    const { id } = await createOne();
    await setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { status: "RUNNING" },
      }),
      experimentParams(id),
    );

    const after = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const afterBody = (await after.json()) as { config_version: string };

    // Otherwise every cached banner serves the old copy for its full lifetime,
    // and the first minutes of a run read as evidence the variant did nothing.
    expect(afterBody.config_version).not.toBe(beforeBody.config_version);
  });

  it("does not serve another site's experiment", async () => {
    const { id } = await createOne();
    await setStatus(
      managementRequest(`/api/v1/experiments/${id}/status`, {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { status: "RUNNING" },
      }),
      experimentParams(id),
    );

    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteB1.publicKey }),
    );
    const body = (await response.json()) as { experiment?: unknown };
    expect(body.experiment ?? null).toBeNull();
  });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

describe("analytics", () => {
  it("returns a comparison with no data rather than failing", async () => {
    const { id } = await createOne();
    const response = await experimentAnalytics(
      managementRequest(`/api/v1/experiments/${id}/analytics`, { key: tree.orgA.secretKey }),
      experimentParams(id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      comparison: { variants: Array<{ acceptance_rate: number | null; impressions: number }> };
    };

    // Null, not zero. "Nobody accepted" and "nobody has been asked" are
    // different findings.
    expect(body.comparison.variants[0]?.acceptance_rate).toBeNull();
    expect(body.comparison.variants[0]?.impressions).toBe(0);
  });

  it("carries the caveats with the numbers", async () => {
    const { id } = await createOne();
    const response = await experimentAnalytics(
      managementRequest(`/api/v1/experiments/${id}/analytics`, { key: tree.orgA.secretKey }),
      experimentParams(id),
    );
    const body = (await response.json()) as { comparison: { caveats: string[] } };

    expect(body.comparison.caveats.join(" ")).toMatch(/not a quality measure/i);
    expect(body.comparison.caveats.join(" ")).toMatch(/site-wide/i);
  });

  it("never names a winner", async () => {
    const { id } = await createOne();
    const response = await experimentAnalytics(
      managementRequest(`/api/v1/experiments/${id}/analytics`, { key: tree.orgA.secretKey }),
      experimentParams(id),
    );
    expect(await response.text()).not.toMatch(/winner|wins\b/i);
  });

  it("refuses another tenant's analytics", async () => {
    const { id } = await createOne();
    const response = await experimentAnalytics(
      managementRequest(`/api/v1/experiments/${id}/analytics`, { key: tree.orgB.secretKey }),
      experimentParams(id),
    );
    expect(response.status).toBe(404);
  });

  it("refuses unauthenticated analytics", async () => {
    const { id } = await createOne();
    const response = await experimentAnalytics(
      managementRequest(`/api/v1/experiments/${id}/analytics`),
      experimentParams(id),
    );
    expect(response.status).toBe(401);
  });

  it("describes policy version differences as observed, never as caused", async () => {
    const response = await policyAnalytics(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/policy-analytics`, {
        key: tree.orgA.secretKey,
      }),
      { params: Promise.resolve({ siteId: tree.siteA1.siteId }) },
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/observed changes, not effects/i);
    expect(text).not.toMatch(/caused/i);
  });

  it("refuses policy analytics for another tenant's site", async () => {
    const response = await policyAnalytics(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/policy-analytics`, {
        key: tree.orgB.secretKey,
      }),
      { params: Promise.resolve({ siteId: tree.siteA1.siteId }) },
    );
    expect(response.status).toBe(404);
  });
});

// ─── Concurrency on the proof chain ──────────────────────────────────────────

describe("the proof chain under concurrency", () => {
  /**
   * The chain position is claimed optimistically — read the last sequence,
   * insert the next — with a unique index as the arbiter and a bounded retry.
   *
   * That replaced an interactive transaction, which was the wrong tool: Prisma
   * holds one open for 5s by default, a round trip to managed Postgres is a
   * second or more, and the write expired under ordinary latency. It surfaced as
   * *other* tests failing with "transaction already closed", which is exactly
   * the kind of failure that gets written off as flake.
   *
   * What must never happen is two records claiming one position. A forked chain
   * is indistinguishable from tampering after the fact, so this drives real
   * concurrent writes and checks the sequence is a clean run.
   */
  it("gives concurrent decisions distinct, contiguous positions", async () => {
    await prisma.purpose.create({
      data: {
        organisationId: tree.orgA.organisationId,
        code: "analytics",
        name: "Analytics",
        description: "Analytics",
      },
    });

    const { recordConsentDecision } = await import("database");

    // Eight at once for one principal, which is the case that collides.
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        recordConsentDecision(prisma, {
          organisationId: tree.orgA.organisationId,
          siteId: tree.siteA1.siteId,
          principalExternalId: "visitor-concurrent",
          purposeCode: "analytics",
          status: "GRANTED",
          signingKey: null,
        }),
      ),
    );

    expect(results.every((r) => r.ok)).toBe(true);

    const rows = await prisma.consentRecord.findMany({
      where: { siteId: tree.siteA1.siteId },
      orderBy: { proofSequence: "asc" },
      select: { proofSequence: true, proofDocumentHash: true, proofPreviousHash: true },
    });

    // Every position claimed exactly once, with no gaps.
    expect(rows.map((r) => r.proofSequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // And each links to the one before it, so the chain is a chain rather than
    // eight independent records that happen to be numbered.
    expect(rows[0]?.proofPreviousHash).toBeNull();
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]?.proofPreviousHash).toBe(rows[i - 1]?.proofDocumentHash);
    }
  });
});
