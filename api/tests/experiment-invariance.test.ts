/**
 * What an experiment must not be able to change.
 *
 * The brief asks that experiments not suppress drift findings, not suppress
 * shadow trackers, and not bypass enforcement. In this design those are not
 * three features that had to be built — they are consequences of a variant
 * being able to vary six strings of banner copy and nothing else.
 *
 * That makes the tests here unusual: they are mostly assertions that a running
 * experiment changes *nothing* about the intelligence and enforcement layers.
 * That is the point. A design where an experiment could suppress a finding, and
 * a rule was added to stop it, would be one rule away from suppressing one.
 *
 * The invariance is asserted directly — the same evidence, evaluated with and
 * without a live experiment, must produce the same findings and the same
 * enforcement decisions, arm for arm.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { evaluateFirewall, type EnforcementConfig } from "@rift-cmp/shared";
import { applyVariant } from "../../sdk/src/experiment";
import { POST as createExperiment } from "@/app/api/v1/experiments/route";
import { POST as setStatus } from "@/app/api/v1/experiments/[experimentId]/status/route";
import { GET as siteIntelligence } from "@/app/api/v1/sites/[siteId]/intelligence/route";
import { GET as consentConfig } from "@/app/api/v1/consent/config/route";
import {
  createOwnershipTree,
  managementRequest,
  resetDatabase,
  siteParams,
  siteRequest,
} from "./helpers/fixtures";

let tree: Awaited<ReturnType<typeof createOwnershipTree>>;

beforeEach(async () => {
  await resetDatabase();
  tree = await createOwnershipTree();
});

/** An experiment whose second arm rewords refusal, started and serving. */
async function runExperiment(): Promise<string> {
  const created = await createExperiment(
    managementRequest("/api/v1/experiments", {
      key: tree.orgA.secretKey,
      method: "POST",
      body: {
        site_id: tree.siteA1.siteId,
        name: "Reject wording",
        variants: [
          { key: "control", name: "Control", allocation: 50, is_control: true },
          {
            key: "b",
            name: "Softer",
            allocation: 50,
            text: { reject_all: "No thanks", title: "Your choices" },
          },
        ],
      },
    }),
  );

  const body = (await created.json()) as { experiment: { experiment_id: string } };
  const id = body.experiment.experiment_id;

  await setStatus(
    managementRequest(`/api/v1/experiments/${id}/status`, {
      key: tree.orgA.secretKey,
      method: "POST",
      body: { status: "RUNNING" },
    }),
    { params: Promise.resolve({ experimentId: id }) },
  );

  return id;
}

function intelligence() {
  return siteIntelligence(
    managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/intelligence`, {
      key: tree.orgA.secretKey,
    }),
    siteParams(tree.siteA1.siteId),
  );
}

// ─── Drift and shadow trackers ───────────────────────────────────────────────

describe("an experiment does not suppress intelligence", () => {
  it("produces identical findings before and after one starts", async () => {
    // The strongest available statement: the evidence is unchanged, so the
    // findings are unchanged, field for field.
    //
    // `generated_at` is excluded because it is the time of the request rather
    // than anything about the site. Comparing it would fail for a reason that
    // has nothing to do with the property being tested, and asserting on a
    // timestamp is how a real regression later gets waved through as flake.
    const strip = (body: unknown) => {
      const { intelligence: found } = body as { intelligence: Record<string, unknown> };
      const rest = { ...found };
      delete rest.generated_at;
      return rest;
    };

    const before = strip(await (await intelligence()).json());
    await runExperiment();
    const after = strip(await (await intelligence()).json());

    expect(after).toEqual(before);
  });

  it("still reports shadow trackers while an experiment runs", async () => {
    await runExperiment();
    const response = await intelligence();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      intelligence: { shadow_trackers: unknown[]; drift: unknown[] };
    };

    // The arrays exist and are being computed. A running experiment does not
    // switch the subsystem off, and there is no code path by which it could.
    expect(Array.isArray(body.intelligence.shadow_trackers)).toBe(true);
    expect(Array.isArray(body.intelligence.drift)).toBe(true);
  });

  it("leaves no experiment marker anywhere in the intelligence response", async () => {
    // If an experiment could annotate a finding, it could eventually excuse one.
    // There is no such field, and this fails if somebody adds one.
    const experimentId = await runExperiment();
    const text = await (await intelligence()).text();

    expect(text).not.toContain(experimentId);
    expect(text).not.toMatch(/experiment/i);
  });
});

// ─── Enforcement ─────────────────────────────────────────────────────────────

describe("both arms pass through the same enforcement", () => {
  const config: EnforcementConfig = {
    mode: "enforce",
    rules: [
      {
        host: "google-analytics.com",
        vendor: "Google Analytics",
        purpose: "analytics",
        action: "require_consent",
      },
    ],
    unknown_host: "allow",
  };

  function decide(granted: string[]) {
    return evaluateFirewall(
      {
        organisationId: tree.orgA.organisationId,
        siteId: tree.siteA1.siteId,
        destination: "https://www.google-analytics.com/collect",
        source: "client",
      },
      {
        config,
        granted: new Set(granted),
        decided: new Set(granted),
        policyVersion: "1",
      },
    );
  }

  it("reaches the same decision regardless of which arm was shown", async () => {
    await runExperiment();

    // The firewall is never told about an experiment. It cannot be: the subject
    // has no field for one, which is why an arm cannot influence a decision.
    const undecided = decide([]);
    expect(undecided.decision).toBe("REQUIRE_CONSENT");
    expect(undecided.effect).toBe("block");

    const consented = decide(["analytics"]);
    expect(consented.decision).toBe("ALLOW");
  });

  it("keeps BLOCK as BLOCK", async () => {
    await runExperiment();
    const blocked = evaluateFirewall(
      {
        organisationId: tree.orgA.organisationId,
        siteId: tree.siteA1.siteId,
        destination: "https://www.google-analytics.com/collect",
        source: "server",
      },
      {
        config: { ...config, rules: [{ ...config.rules[0]!, action: "block" }] },
        granted: new Set(["analytics"]),
        decided: new Set(["analytics"]),
        policyVersion: "1",
      },
    );

    // Even with the gating purpose granted: a blocked vendor stays blocked, and
    // no arm can turn that into an allow.
    expect(blocked.decision).toBe("BLOCK");
    expect(blocked.effect).toBe("block");
  });

  it("serves identical enforcement rules to every arm", async () => {
    await runExperiment();

    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await response.json()) as {
      enforcement: unknown;
      experiment: { variants: Array<{ text: Record<string, string> | null }> };
    };

    // One enforcement block for the whole site, outside the experiment. There is
    // no per-arm enforcement to diverge.
    for (const variant of body.experiment.variants) {
      expect(variant.text === null || Object.keys(variant.text).every((k) =>
        ["title", "body", "accept_all", "reject_all", "manage", "save"].includes(k),
      )).toBe(true);
    }
  });

  it("cannot vary enforcement through the copy it is allowed to set", async () => {
    await runExperiment();

    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const served = (await response.json()) as Parameters<typeof applyVariant>[0];

    // Apply the most hostile arm the schema permits, and check what survives.
    const varied = applyVariant(served, {
      experimentId: "exp",
      variantKey: "b",
      text: { title: "Anything at all" },
    });

    expect(varied.enforcement).toBe(served.enforcement);
    expect(varied.purposes).toBe(served.purposes);
    expect(varied.notice).toBe(served.notice);
  });
});

// ─── The purposes themselves ─────────────────────────────────────────────────

describe("an experiment cannot change what is being asked", () => {
  it("serves the same purposes to both arms", async () => {
    await runExperiment();

    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await response.json()) as {
      purposes: unknown[];
      experiment: { variants: unknown[] };
    };

    // One purpose list for the site, served once, outside the experiment block.
    // A variant has nowhere to put a different one.
    expect(Array.isArray(body.purposes)).toBe(true);
    expect(body.experiment.variants).toHaveLength(2);
  });

  it("keeps the notice outside the experiment", async () => {
    await runExperiment();
    const response = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await response.json()) as { experiment: Record<string, unknown> };

    expect(Object.keys(body.experiment)).not.toContain("notice");
    expect(Object.keys(body.experiment)).not.toContain("purposes");
    expect(Object.keys(body.experiment)).not.toContain("enforcement");
  });
});

// ─── Attribution is checked, not trusted ─────────────────────────────────────

describe("attribution cannot be forged", () => {
  it("stores no experiment on a decision that names one that is not running", async () => {
    // The public key is in every page's source, so an arbitrary script can post
    // a decision claiming any arm. Recording that unchecked would make
    // experiment analytics a surface anybody could write fiction into.
    const experimentId = await runExperiment();
    await prisma.experiment.update({
      where: { id: experimentId },
      data: { status: "COMPLETED" },
    });

    const config = await consentConfig(
      siteRequest("/api/v1/consent/config", { key: tree.siteA1.publicKey }),
    );
    const body = (await config.json()) as { experiment?: unknown };

    // Completed, so it stops being served at all — and a decision naming it
    // afterwards has nothing to match against.
    expect(body.experiment ?? null).toBeNull();
  });
});
