/**
 * `guardOutboundRequest`, the server-controlled path.
 *
 * This is the plane where a BLOCK genuinely means the bytes did not leave, so
 * the thing worth testing is not the decision — `consent-firewall.test.ts`
 * covers that without a database — but the interaction between the decision and
 * the payload:
 *
 *   BLOCK must return nothing to send, redaction rules or not.
 *   ALLOW with rules must return a redacted request, and never the original.
 *   ALLOW without rules must return the request untouched.
 *   A rule set that does not validate must send nothing at all.
 *   A payload too deep to walk must send nothing, because something we could not
 *   finish walking is something we cannot claim to have redacted.
 *
 * And the audit row: it must record the decision without recording the payload.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import { guardOutboundRequest } from "@/lib/firewall";
import { MAX_DEPTH, type RedactionConfig } from "@rift-cmp/shared/redaction";
import { createOwnershipTree, resetDatabase } from "./helpers/fixtures";

let tree: Awaited<ReturnType<typeof createOwnershipTree>>;

const EMAIL = "someone@example.com";

const redaction: RedactionConfig = {
  rules: [{ id: "email", field: "email", match: "name", strategy: "remove" }],
};

beforeEach(async () => {
  await resetDatabase();
  tree = await createOwnershipTree();
});

/** An approved configuration that gates the vendor behind a purpose. */
async function approve(action: "block" | "require_consent" | "allow") {
  await prisma.consentPolicyVersion.create({
    data: {
      siteId: tree.siteA1.siteId,
      organisationId: tree.orgA.organisationId,
      version: 1,
      status: "approved",
      jurisdictions: ["EU"],
      regimes: ["gdpr"],
      approvedAt: new Date(),
      recommendations: [
        {
          detector_id: "google-analytics",
          vendor_name: "Google Analytics",
          category: "analytics",
          suggested_purpose: "analytics",
          data_categories: [],
          jurisdictions: ["EU"],
          consent_requirement: "required",
          opt_out_requirement: "unknown",
          recommended_action: action,
          reason: "test",
          confidence: "high",
          evidence: [],
          rule_references: [],
          overridden: false,
          override_note: null,
          observed_in_latest_scan: true,
        },
      ],
    },
  });
}

function guard(over: Parameters<typeof guardOutboundRequest>[0] extends infer T ? Partial<T> : never) {
  return guardOutboundRequest({
    organisationId: tree.orgA.organisationId,
    siteId: tree.siteA1.siteId,
    request: { url: "https://www.google-analytics.com/collect", body: { email: EMAIL, id: 7 } },
    ...over,
  } as Parameters<typeof guardOutboundRequest>[0]);
}

// ─── Decision and payload ────────────────────────────────────────────────────

describe("BLOCK", () => {
  it("returns nothing to send", async () => {
    await approve("block");
    const outcome = await guard({});

    expect(outcome.decision.decision).toBe("BLOCK");
    expect(outcome.send).toBeNull();
  });

  it("returns nothing to send even with redaction rules", async () => {
    // Redaction is not a fallback for a block. A blocked request does not become
    // acceptable by having a field removed.
    await approve("block");
    const outcome = await guard({ redaction });

    expect(outcome.send).toBeNull();
  });
});

describe("REQUIRE_CONSENT", () => {
  it("blocks when nobody has decided", async () => {
    await approve("require_consent");
    const outcome = await guard({ principalExternalId: "visitor-1" });

    expect(outcome.decision.decision).toBe("REQUIRE_CONSENT");
    expect(outcome.send).toBeNull();
  });

  it("blocks when the request carries no principal at all", async () => {
    // A server job with no visitor is not a visitor who agreed. The gate cannot
    // be evaluated, and an unevaluable gate is treated as unsatisfied.
    await approve("require_consent");
    const outcome = await guard({});

    expect(outcome.decision.decision).toBe("REQUIRE_CONSENT");
    expect(outcome.decision.reason).toMatch(/no principal/i);
    expect(outcome.send).toBeNull();
  });
});

describe("ALLOW", () => {
  it("returns the request untouched when no rules were given", async () => {
    await approve("allow");
    const outcome = await guard({});

    expect(outcome.decision.decision).toBe("ALLOW");
    expect(outcome.send?.body).toEqual({ email: EMAIL, id: 7 });
  });

  it("returns a redacted request when rules were given", async () => {
    await approve("allow");
    const outcome = await guard({ redaction });

    expect(outcome.decision.decision).toBe("REDACT");
    expect(outcome.send?.body).toEqual({ id: 7 });
    expect(JSON.stringify(outcome.send)).not.toContain("example.com");
  });

  it("reports which rule ran without repeating the value", async () => {
    await approve("allow");
    const outcome = await guard({ redaction });

    expect(outcome.redactionApplied).toEqual([
      { ruleId: "email", location: "body", path: "email", strategy: "remove" },
    ]);
    expect(JSON.stringify(outcome.redactionApplied)).not.toContain("someone");
  });
});

describe("REVIEW", () => {
  it("allows an unmatched destination but does not call it approved", async () => {
    await approve("allow");
    const outcome = await guard({
      request: { url: "https://unheard-of.example/collect", body: { id: 1 } },
    });

    expect(outcome.decision.decision).toBe("REVIEW");
    expect(outcome.send).not.toBeNull();
  });

  it("treats a site with no approved configuration as unreviewed", async () => {
    // No approved configuration is not an empty one. Every host is unmatched,
    // and the absence stays visible rather than reading as an all-clear.
    const outcome = await guard({});
    expect(outcome.decision.decision).toBe("REVIEW");
    expect(outcome.decision.policyVersion).toBeNull();
  });
});

// ─── Failing safe ────────────────────────────────────────────────────────────

describe("failing safe", () => {
  it("sends nothing when the redaction rules do not validate", async () => {
    await approve("allow");
    const outcome = await guard({
      redaction: { rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }] },
    });

    expect(outcome.send).toBeNull();
    expect(outcome.decision.decision).toBe("BLOCK");
    expect(outcome.configProblems.join(" ")).toMatch(/reversible/i);
  });

  it("sends nothing when a payload could not be fully walked", async () => {
    await approve("allow");
    let deep: Record<string, unknown> = { email: EMAIL };
    for (let i = 0; i < MAX_DEPTH + 5; i += 1) deep = { level: deep };

    const outcome = await guard({
      request: { url: "https://www.google-analytics.com/collect", body: deep },
      redaction,
    });

    // Sending it unmodified while reporting REDACT would be the worst outcome
    // available: the operator believes the field is gone and it is not.
    expect(outcome.send).toBeNull();
    expect(outcome.decision.effect).toBe("block");
  });
});

// ─── The audit row ───────────────────────────────────────────────────────────

describe("what gets written", () => {
  it("records the decision", async () => {
    await approve("block");
    await guard({});

    const row = await prisma.enforcementEvent.findFirst({
      where: { siteId: tree.siteA1.siteId },
    });
    expect(row?.decision).toBe("BLOCK");
    expect(row?.source).toBe("server");
    expect(row?.destinationHost).toBe("www.google-analytics.com");
  });

  it("records no payload, no URL and no principal", async () => {
    await approve("allow");
    await guard({ principalExternalId: "visitor-1", redaction });

    const row = await prisma.enforcementEvent.findFirst({
      where: { siteId: tree.siteA1.siteId },
    });
    const serialised = JSON.stringify(row);

    expect(serialised).not.toContain("someone@example.com");
    expect(serialised).not.toContain("visitor-1");
    // A host, never a URL: a URL carries a query string and a query string
    // carries the values redaction exists to remove.
    expect(serialised).not.toContain("/collect");
  });

  it("records redaction as rule ids and paths only", async () => {
    await approve("allow");
    await guard({ redaction });

    const row = await prisma.enforcementEvent.findFirst({
      where: { siteId: tree.siteA1.siteId },
    });
    expect(row?.redactions).toEqual([{ rule: "email", location: "body", path: "email" }]);
  });

  it("writes nothing when the caller asked for a dry run", async () => {
    await approve("block");
    await guard({ record: false });
    expect(await prisma.enforcementEvent.count()).toBe(0);
  });

  it("scopes the row to the caller's tenant", async () => {
    await approve("block");
    await guard({});

    const row = await prisma.enforcementEvent.findFirst({});
    expect(row?.organisationId).toBe(tree.orgA.organisationId);
    expect(row?.siteId).toBe(tree.siteA1.siteId);
  });
});

// ─── Consent actually changes the answer ─────────────────────────────────────

describe("the decision follows the visitor", () => {
  it("allows once the gating purpose is granted", async () => {
    await approve("require_consent");
    await prisma.purpose.create({
      data: {
        organisationId: tree.orgA.organisationId,
        code: "analytics",
        name: "Analytics",
        description: "Analytics",
      },
    });

    const { recordConsentDecision } = await import("database");
    const decision = await recordConsentDecision(prisma, {
      organisationId: tree.orgA.organisationId,
      siteId: tree.siteA1.siteId,
      principalExternalId: "visitor-1",
      purposeCode: "analytics",
      status: "GRANTED",
      signingKey: null,
    });
    expect(decision.ok).toBe(true);

    const outcome = await guard({ principalExternalId: "visitor-1" });
    expect(outcome.decision.decision).toBe("ALLOW");
    expect(outcome.send).not.toBeNull();
  });

  it("blocks again after a withdrawal", async () => {
    await approve("require_consent");
    await prisma.purpose.create({
      data: {
        organisationId: tree.orgA.organisationId,
        code: "analytics",
        name: "Analytics",
        description: "Analytics",
      },
    });

    const { recordConsentDecision } = await import("database");
    for (const status of ["GRANTED", "WITHDRAWN"] as const) {
      await recordConsentDecision(prisma, {
        organisationId: tree.orgA.organisationId,
        siteId: tree.siteA1.siteId,
        principalExternalId: "visitor-1",
        purposeCode: "analytics",
        status,
        signingKey: null,
      });
    }

    const outcome = await guard({ principalExternalId: "visitor-1" });
    expect(outcome.decision.decision).toBe("REQUIRE_CONSENT");
    expect(outcome.send).toBeNull();
  });
});
