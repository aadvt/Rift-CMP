import { beforeEach, describe, expect, it } from "vitest";
import { approvePolicyVersion, prisma, setOverride } from "database";
import { GET as getConfig } from "@/app/api/v1/consent/config/route";
import {
  GET as getPolicy,
  POST as approvePolicy,
} from "@/app/api/v1/sites/[siteId]/consent-policy/route";
import {
  DELETE as clearOverrideRoute,
  POST as setOverrideRoute,
} from "@/app/api/v1/sites/[siteId]/consent-policy/overrides/route";
import { POST as ingest } from "@/app/api/v1/events/route";
import {
  buildEvent,
  createConsentFixture,
  createOwnershipTree,
  createTransferScenario,
  ingestRequest,
  managementRequest,
  resetDatabase,
  runTransferFlow,
  siteParams,
  siteRequest,
} from "./helpers/fixtures";

/**
 * The server-side enforcement boundary.
 *
 * Phase 9B's instruction is that a request must not rely solely on a
 * client-side consent flag, and the reason is the boundary stated in
 * `sdk/src/enforce.ts`: browser enforcement patches globals on a page the
 * customer controls, so it raises the cost of a leak without being a control.
 * The control is here, where consent is re-derived from the append-only log.
 *
 * This file covers what the unit suite cannot — a direct API call that skips
 * the browser entirely, a cross-tenant attempt, and the regressions proving
 * that adding enforcement did not break the analytics and secure-transfer paths
 * that existed before it.
 *
 * Needs Postgres.
 */

beforeEach(resetDatabase);

const CONFIG_PATH = "/api/v1/consent/config";

function recommendation(over: Record<string, unknown> = {}) {
  return {
    detector_id: "google-analytics",
    vendor_name: "Google Analytics",
    category: "analytics",
    suggested_purpose: "analytics",
    data_categories: ["device_data"],
    jurisdictions: ["EU"],
    consent_requirement: "required",
    opt_out_requirement: "unknown",
    recommended_action: "require_consent",
    reason: "test",
    confidence: "high",
    evidence: [],
    rule_references: ["REQ-EP-002"],
    overridden: false,
    override_note: null,
    observed_in_latest_scan: true,
    ...over,
  };
}

/** `GET` on the browser plane, which `ingestRequest` does not cover. */
function configRequest(publicKey: string) {
  return siteRequest(CONFIG_PATH, { key: publicKey, method: "GET" });
}

async function approveFor(organisationId: string, siteId: string) {
  return approvePolicyVersion(prisma, {
    organisationId,
    siteId,
    scanId: null,
    recommendations: [recommendation()] as never,
    jurisdictions: ["EU"],
    regimes: ["GDPR"],
  });
}

// ─── Direct API bypass ───────────────────────────────────────────────────────

describe("a direct API call cannot bypass the server boundary", () => {
  it("refuses ingestion for a gated site with no consent session", async () => {
    /**
     * The bypass the brief names: skip the browser, skip the banner, and POST
     * events straight to the API with a public key read out of page source.
     * The site opted into server-side enforcement, so the answer comes from the
     * log rather than from anything the caller said.
     */
    const tree = await createOwnershipTree();
    const consent = await createConsentFixture(tree.orgA.organisationId);
    await prisma.website.update({
      where: { id: tree.siteA1.siteId },
      data: { analyticsConsentPurpose: consent.purposeCode },
    });

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: tree.siteA1.siteId })] },
        { key: tree.siteA1.publicKey },
      ),
    );

    // 401, not 403: the refusal happens at the consent-session layer, before
    // the decision is even looked up. What matters is that a caller holding
    // only a public key cannot get an event past a gated site, and that nothing
    // was written on the way to finding that out.
    expect(response.status).toBe(401);
    expect(await prisma.event.count()).toBe(0);
  });

  it("does not let a claim in the request body stand in for a decision", async () => {
    const tree = await createOwnershipTree();
    const consent = await createConsentFixture(tree.orgA.organisationId);
    await prisma.website.update({
      where: { id: tree.siteA1.siteId },
      data: { analyticsConsentPurpose: consent.purposeCode },
    });

    const response = await ingest(
      ingestRequest(
        {
          // A caller asserting its own consent. The API has never believed this
          // and must not start.
          consent: { [consent.purposeCode]: "GRANTED" },
          events: [buildEvent({ site_id: tree.siteA1.siteId })],
        },
        { key: tree.siteA1.publicKey },
      ),
    );

    expect(response.status).not.toBe(202);
    expect(await prisma.event.count()).toBe(0);
  });

  it("will not approve a policy with a site public key", async () => {
    const tree = await createOwnershipTree();
    const response = await approvePolicy(
      siteRequest(`/api/v1/sites/${tree.siteA1.siteId}/consent-policy`, {
        key: tree.siteA1.publicKey,
        method: "POST",
        body: { recommendations: [recommendation()] },
      }),
      siteParams(tree.siteA1.siteId),
    );
    // Approving changes what every visitor's banner enforces. A key that ships
    // in page source may not do that.
    expect(response.status).toBe(401);
    expect(await prisma.consentPolicyVersion.count()).toBe(0);
  });

  it("will not set an override with a site public key", async () => {
    const tree = await createOwnershipTree();
    const response = await setOverrideRoute(
      siteRequest(`/api/v1/sites/${tree.siteA1.siteId}/consent-policy/overrides`, {
        key: tree.siteA1.publicKey,
        method: "POST",
        body: { detector_id: "google-analytics", action: "allow" },
      }),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(401);
    expect(await prisma.consentRecommendationOverride.count()).toBe(0);
  });

  it("will not read a policy with no credential at all", async () => {
    const tree = await createOwnershipTree();
    const response = await getPolicy(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/consent-policy`, {
        method: "GET",
      }),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(401);
  });
});

// ─── Cross-tenant ────────────────────────────────────────────────────────────

describe("cross-tenant attempts are refused", () => {
  it("hides another organisation's policy behind a 404", async () => {
    const tree = await createOwnershipTree();
    const response = await getPolicy(
      managementRequest(`/api/v1/sites/${tree.siteB1.siteId}/consent-policy`, {
        key: tree.orgA.secretKey,
        method: "GET",
      }),
      siteParams(tree.siteB1.siteId),
    );
    // Not 403: another tenant's site is indistinguishable from one that does
    // not exist, which is the rule the whole platform holds.
    expect(response.status).toBe(404);
  });

  it("refuses to approve a policy for another organisation's site", async () => {
    const tree = await createOwnershipTree();
    const response = await approvePolicy(
      managementRequest(`/api/v1/sites/${tree.siteB1.siteId}/consent-policy`, {
        key: tree.orgA.secretKey,
        method: "POST",
        body: { recommendations: [recommendation()] },
      }),
      siteParams(tree.siteB1.siteId),
    );
    expect(response.status).toBe(404);
    expect(
      await prisma.consentPolicyVersion.count({ where: { siteId: tree.siteB1.siteId } }),
    ).toBe(0);
  });

  it("refuses to set an override on another organisation's site", async () => {
    const tree = await createOwnershipTree();
    const response = await setOverrideRoute(
      managementRequest(
        `/api/v1/sites/${tree.siteB1.siteId}/consent-policy/overrides`,
        {
          key: tree.orgA.secretKey,
          method: "POST",
          body: { detector_id: "google-analytics", action: "allow" },
        },
      ),
      siteParams(tree.siteB1.siteId),
    );
    expect(response.status).toBe(404);
    expect(
      await prisma.consentRecommendationOverride.count({
        where: { siteId: tree.siteB1.siteId },
      }),
    ).toBe(0);
  });

  it("does not serve another tenant's enforcement rules to a browser", async () => {
    const tree = await createOwnershipTree();
    await approveFor(tree.orgB.organisationId, tree.siteB1.siteId);

    // Org A's site key must see nothing of org B's approved policy.
    const response = await getConfig(configRequest(tree.siteA1.publicKey));
    const body = (await response.json()) as { enforcement: unknown };
    expect(body.enforcement).toBeNull();
  });

  it("keeps two sites of one organisation independent", async () => {
    // Approval is per site, not per organisation: a policy approved for one
    // site must not start enforcing on another the operator never reviewed.
    const tree = await createOwnershipTree();
    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const other = await getConfig(configRequest(tree.siteA2.publicKey));
    expect(((await other.json()) as { enforcement: unknown }).enforcement).toBeNull();
  });
});

// ─── The enforcement config a browser receives ───────────────────────────────

describe("the enforcement config a browser is served", () => {
  it("is absent until a policy version is approved", async () => {
    const tree = await createOwnershipTree();
    await createConsentFixture(tree.orgA.organisationId);

    const response = await getConfig(configRequest(tree.siteA1.publicKey));
    const body = (await response.json()) as { enforcement: unknown };
    // Enforcing a recommendation nobody approved is what Phase 9A refused.
    expect(body.enforcement).toBeNull();
  });

  it("appears once a version is approved, in observe mode", async () => {
    const tree = await createOwnershipTree();
    await createConsentFixture(tree.orgA.organisationId);
    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const response = await getConfig(configRequest(tree.siteA1.publicKey));
    const body = (await response.json()) as {
      enforcement: {
        mode: string;
        unknown_host: string;
        rules: Array<{ host: string; purpose: string; action: string }>;
      };
    };

    // Observe, not enforce: turning enforcement on is a deliberate act taken
    // after an operator has looked at what would have been blocked.
    expect(body.enforcement.mode).toBe("observe");
    expect(body.enforcement.unknown_host).toBe("allow");
    expect(body.enforcement.rules.length).toBeGreaterThan(0);
    expect(body.enforcement.rules.every((r) => r.purpose === "analytics")).toBe(true);
    expect(body.enforcement.rules.every((r) => r.action === "require_consent")).toBe(true);
  });

  it("resolves the vendor to hosts a browser can match", async () => {
    const tree = await createOwnershipTree();
    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const response = await getConfig(configRequest(tree.siteA1.publicKey));
    const body = (await response.json()) as {
      enforcement: { rules: Array<{ host: string }> };
    };
    // The catalogue lives on the server; the browser is handed hosts.
    expect(body.enforcement.rules.some((r) => r.host.includes("google-analytics"))).toBe(
      true,
    );
  });

  it("carries no legal reasoning into the browser", async () => {
    const tree = await createOwnershipTree();
    await createConsentFixture(tree.orgA.organisationId);
    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const response = await getConfig(configRequest(tree.siteA1.publicKey));
    const serialised = JSON.stringify(await response.json()).toLowerCase();
    // The rule references that justified the policy stay server-side; the
    // browser gets hosts, purposes and actions.
    for (const term of ["req-", "gdpr", "eprivacy", "regime", "requirement"]) {
      expect(serialised, `enforcement config leaks ${term}`).not.toContain(term);
    }
  });

  it("changes its version when the policy changes, so caches cannot stick", async () => {
    const tree = await createOwnershipTree();
    await createConsentFixture(tree.orgA.organisationId);

    const before = (await (
      await getConfig(configRequest(tree.siteA1.publicKey))
    ).json()) as { config_version: string };

    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const after = (await (
      await getConfig(configRequest(tree.siteA1.publicKey))
    ).json()) as { config_version: string };

    expect(after.config_version).not.toBe(before.config_version);
  });
});

// ─── Overrides reach the browser ─────────────────────────────────────────────

describe("an operator's override reaches the generated policy", () => {
  it("replaces the recommended action", async () => {
    const tree = await createOwnershipTree();
    await setOverride(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      detectorId: "google-analytics",
      purposeCode: "analytics",
      action: "allow",
      note: "self-hosted",
    });

    const response = await getPolicy(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/consent-policy`, {
        key: tree.orgA.secretKey,
        method: "GET",
      }),
      siteParams(tree.siteA1.siteId),
    );
    const body = (await response.json()) as {
      policy: {
        recommendations: Array<{ recommended_action: string; overridden: boolean }>;
      };
    };
    const overridden = body.policy.recommendations.find((r) => r.overridden);
    expect(overridden?.recommended_action).toBe("allow");
  });

  it("clears idempotently, so a retry is not a failure", async () => {
    const tree = await createOwnershipTree();
    const response = await clearOverrideRoute(
      managementRequest(
        `/api/v1/sites/${tree.siteA1.siteId}/consent-policy/overrides`,
        {
          key: tree.orgA.secretKey,
          method: "DELETE",
          query: { detector_id: "never-set" },
        },
      ),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(200);
  });

  it("requires a detector_id to clear", async () => {
    const tree = await createOwnershipTree();
    const response = await clearOverrideRoute(
      managementRequest(
        `/api/v1/sites/${tree.siteA1.siteId}/consent-policy/overrides`,
        { key: tree.orgA.secretKey, method: "DELETE" },
      ),
      siteParams(tree.siteA1.siteId),
    );
    expect(response.status).toBe(400);
  });
});

// ─── Regression: what existed before 9B still works ──────────────────────────

describe("regression: the analytics path is unchanged", () => {
  it("still accepts events for a site with no consent gate", async () => {
    /**
     * The pre-6A behaviour, which 9B must not have altered. A site that has not
     * opted into server-side enforcement keeps working exactly as before.
     */
    const tree = await createOwnershipTree();
    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: tree.siteA1.siteId })] },
        { key: tree.siteA1.publicKey },
      ),
    );
    expect(response.status).toBe(202);
    expect(await prisma.event.count()).toBe(1);
  });

  it("still accepts events after a policy is approved", async () => {
    const tree = await createOwnershipTree();
    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: tree.siteA1.siteId })] },
        { key: tree.siteA1.publicKey },
      ),
    );
    // Approving a policy is not a server-side gate. The gate is
    // `analytics_consent_purpose`, and this site has not set it. Conflating the
    // two would make approving a policy silently start refusing traffic.
    expect(response.status).toBe(202);
    expect(await prisma.event.count()).toBe(1);
  });

  it("still rejects a bad key after a policy is approved", async () => {
    const tree = await createOwnershipTree();
    await approveFor(tree.orgA.organisationId, tree.siteA1.siteId);

    const response = await ingest(
      ingestRequest(
        { events: [buildEvent({ site_id: tree.siteA1.siteId })] },
        { key: "pk_not_a_real_key" },
      ),
    );
    expect(response.status).toBe(401);
  });
});

describe("regression: the secure transfer path is unchanged", () => {
  it("still authorises and completes a transfer after a policy is approved", async () => {
    const scenario = await createTransferScenario();
    await approveFor(scenario.orgA.organisationId, scenario.siteA1.siteId);

    const result = await runTransferFlow(scenario);
    expect(result.authorisation).toBeDefined();
    expect(result.transfer).not.toBeNull();
  });

  it("still refuses a transfer when consent was withdrawn", async () => {
    // The Phase 4 guarantee, re-checked: enforcement did not become a second
    // path that could accidentally satisfy the consent gate.
    const scenario = await createTransferScenario({ consent: "WITHDRAWN" });
    await approveFor(scenario.orgA.organisationId, scenario.siteA1.siteId);

    await expect(runTransferFlow(scenario)).rejects.toThrow();
  });
});
