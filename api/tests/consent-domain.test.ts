import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "database";
import type { ConsentRecordSummary } from "@rift-cmp/shared";
import { isPurposeGranted, resolveEffectiveConsent } from "@rift-cmp/shared";
import { GET as listPurposes, POST as createPurpose } from "@/app/api/v1/purposes/route";
import { GET as listPolicies, POST as createPolicy } from "@/app/api/v1/policies/route";
import { POST as createPolicyVersion } from "@/app/api/v1/policies/[policyId]/versions/route";
import { GET as listNotices, POST as createNotice } from "@/app/api/v1/notices/route";
import {
  createOwnershipTree,
  managementRequest,
  policyParams,
  resetDatabase,
} from "./helpers/fixtures";

// --- Pure derivation logic (no database) -------------------------------------

function record(overrides: Partial<ConsentRecordSummary>): ConsentRecordSummary {
  return {
    consent_record_id: "rec-1",
    site_id: "site-1",
    principal_external_id: "principal-1",
    purpose_code: "analytics",
    status: "GRANTED",
    notice_id: null,
    policy_version_id: null,
    source: "test",
    decided_at: "2026-01-01T09:00:00.000Z",
    recorded_at: "2026-01-01T09:00:00.000Z",
    metadata: null,
    ...overrides,
  };
}

describe("effective consent derivation", () => {
  it("returns nothing when no decision has been made", () => {
    expect(resolveEffectiveConsent([])).toEqual([]);
  });

  it("treats an absent decision as not granted", () => {
    expect(isPurposeGranted([], "analytics")).toBe(false);
  });

  it("takes the newest decision per purpose", () => {
    const effective = resolveEffectiveConsent([
      record({ consent_record_id: "a", status: "GRANTED", decided_at: "2026-01-01T09:00:00.000Z" }),
      record({ consent_record_id: "b", status: "WITHDRAWN", decided_at: "2026-01-01T11:30:00.000Z" }),
    ]);

    expect(effective).toHaveLength(1);
    expect(effective[0]).toMatchObject({ status: "WITHDRAWN", consent_record_id: "b" });
  });

  it("is independent of the order records arrive in", () => {
    const older = record({ consent_record_id: "a", status: "GRANTED", decided_at: "2026-01-01T09:00:00.000Z" });
    const newer = record({ consent_record_id: "b", status: "WITHDRAWN", decided_at: "2026-01-01T11:30:00.000Z" });

    expect(resolveEffectiveConsent([older, newer])).toEqual(resolveEffectiveConsent([newer, older]));
  });

  it("tracks each purpose independently", () => {
    const effective = resolveEffectiveConsent([
      record({ consent_record_id: "a", purpose_code: "analytics", status: "GRANTED" }),
      record({ consent_record_id: "b", purpose_code: "marketing", status: "DENIED" }),
    ]);

    expect(effective.map((entry) => entry.purpose_code)).toEqual(["analytics", "marketing"]);
    expect(isPurposeGranted(effective, "analytics")).toBe(true);
    expect(isPurposeGranted(effective, "marketing")).toBe(false);
  });

  it("breaks a decided_at tie deterministically, by recorded_at then id", () => {
    const sameInstant = "2026-01-01T09:00:00.000Z";
    const a = record({
      consent_record_id: "a",
      status: "GRANTED",
      decided_at: sameInstant,
      recorded_at: "2026-01-01T09:00:01.000Z",
    });
    const b = record({
      consent_record_id: "b",
      status: "WITHDRAWN",
      decided_at: sameInstant,
      recorded_at: "2026-01-01T09:00:02.000Z",
    });

    expect(resolveEffectiveConsent([a, b])[0].status).toBe("WITHDRAWN");
    expect(resolveEffectiveConsent([b, a])[0].status).toBe("WITHDRAWN");
  });

  it("treats only GRANTED as permission", () => {
    for (const status of ["DENIED", "WITHDRAWN"] as const) {
      expect(isPurposeGranted(resolveEffectiveConsent([record({ status })]), "analytics")).toBe(false);
    }
    expect(isPurposeGranted(resolveEffectiveConsent([record({ status: "GRANTED" })]), "analytics")).toBe(true);
  });
});

// --- Reference data over the management API ----------------------------------

beforeEach(resetDatabase);

describe("purposes", () => {
  it("creates and lists purposes for the authenticated organisation", async () => {
    const { orgA } = await createOwnershipTree();

    const created = await createPurpose(
      managementRequest("/api/v1/purposes", {
        key: orgA.secretKey,
        method: "POST",
        body: { code: "analytics", name: "Analytics", description: "Measure usage." },
      }),
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ code: "analytics", is_active: true });

    const listed = await listPurposes(managementRequest("/api/v1/purposes", { key: orgA.secretKey }));
    const body = (await listed.json()) as { purposes: Array<{ code: string }> };
    expect(body.purposes.map((p) => p.code)).toEqual(["analytics"]);
  });

  it("rejects a duplicate purpose code with 409", async () => {
    const { orgA } = await createOwnershipTree();
    const body = { code: "analytics", name: "Analytics", description: "Measure usage." };

    await createPurpose(managementRequest("/api/v1/purposes", { key: orgA.secretKey, method: "POST", body }));
    const again = await createPurpose(
      managementRequest("/api/v1/purposes", { key: orgA.secretKey, method: "POST", body }),
    );

    expect(again.status).toBe(409);
  });

  it("rejects a purpose payload that tries to set its own organisation", async () => {
    const { orgA, orgB } = await createOwnershipTree();

    const response = await createPurpose(
      managementRequest("/api/v1/purposes", {
        key: orgA.secretKey,
        method: "POST",
        body: {
          code: "analytics",
          name: "Analytics",
          description: "Measure usage.",
          organisation_id: orgB.organisationId,
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.purpose.count()).toBe(0);
  });
});

describe("policies and versions", () => {
  it("creates a policy together with its first version", async () => {
    const { orgA } = await createOwnershipTree();

    const response = await createPolicy(
      managementRequest("/api/v1/policies", {
        key: orgA.secretKey,
        method: "POST",
        body: {
          code: "privacy-policy",
          name: "Privacy Policy",
          version: "1.0.0",
          document_url: "https://example.com/privacy/1",
          content_hash: "sha256:abc",
        },
      }),
    );

    expect(response.status).toBe(201);
    const policy = (await response.json()) as { versions: Array<{ version: string }> };
    expect(policy.versions).toHaveLength(1);
    expect(policy.versions[0].version).toBe("1.0.0");
  });

  it("publishes additional versions and keeps the earlier ones", async () => {
    const { orgA } = await createOwnershipTree();

    const created = await createPolicy(
      managementRequest("/api/v1/policies", {
        key: orgA.secretKey,
        method: "POST",
        body: { code: "privacy-policy", name: "Privacy Policy", version: "1.0.0" },
      }),
    );
    const { policy_id: policyId } = (await created.json()) as { policy_id: string };

    const second = await createPolicyVersion(
      managementRequest(`/api/v1/policies/${policyId}/versions`, {
        key: orgA.secretKey,
        method: "POST",
        body: { version: "2.0.0" },
      }),
      policyParams(policyId),
    );
    expect(second.status).toBe(201);

    const listed = await listPolicies(managementRequest("/api/v1/policies", { key: orgA.secretKey }));
    const body = (await listed.json()) as { policies: Array<{ versions: Array<{ version: string }> }> };
    expect(body.policies[0].versions.map((v) => v.version)).toEqual(["1.0.0", "2.0.0"]);
  });

  it("rejects a duplicate version on the same policy", async () => {
    const { orgA } = await createOwnershipTree();
    const created = await createPolicy(
      managementRequest("/api/v1/policies", {
        key: orgA.secretKey,
        method: "POST",
        body: { code: "privacy-policy", name: "Privacy Policy", version: "1.0.0" },
      }),
    );
    const { policy_id: policyId } = (await created.json()) as { policy_id: string };

    const duplicate = await createPolicyVersion(
      managementRequest(`/api/v1/policies/${policyId}/versions`, {
        key: orgA.secretKey,
        method: "POST",
        body: { version: "1.0.0" },
      }),
      policyParams(policyId),
    );

    expect(duplicate.status).toBe(409);
  });
});

describe("notices", () => {
  it("records which purposes a notice discloses", async () => {
    const { orgA } = await createOwnershipTree();

    for (const code of ["analytics", "marketing"]) {
      await createPurpose(
        managementRequest("/api/v1/purposes", {
          key: orgA.secretKey,
          method: "POST",
          body: { code, name: code, description: `${code} purpose` },
        }),
      );
    }

    const policyResponse = await createPolicy(
      managementRequest("/api/v1/policies", {
        key: orgA.secretKey,
        method: "POST",
        body: { code: "privacy-policy", name: "Privacy Policy", version: "1.0.0" },
      }),
    );
    const policy = (await policyResponse.json()) as {
      versions: Array<{ policy_version_id: string }>;
    };

    const response = await createNotice(
      managementRequest("/api/v1/notices", {
        key: orgA.secretKey,
        method: "POST",
        body: {
          policy_version_id: policy.versions[0].policy_version_id,
          version: "notice-1",
          purpose_codes: ["marketing", "analytics"],
        },
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      purpose_codes: ["analytics", "marketing"],
      locale: "en",
    });

    const listed = await listNotices(managementRequest("/api/v1/notices", { key: orgA.secretKey }));
    const body = (await listed.json()) as { notices: unknown[] };
    expect(body.notices).toHaveLength(1);
  });

  it("refuses a notice referencing an unknown policy version", async () => {
    const { orgA } = await createOwnershipTree();

    const response = await createNotice(
      managementRequest("/api/v1/notices", {
        key: orgA.secretKey,
        method: "POST",
        body: {
          policy_version_id: "11111111-1111-4111-8111-111111111111",
          version: "notice-1",
          purpose_codes: ["analytics"],
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unknown_policy" } });
  });

  it("refuses a notice referencing an unknown purpose", async () => {
    const { orgA } = await createOwnershipTree();
    const policyResponse = await createPolicy(
      managementRequest("/api/v1/policies", {
        key: orgA.secretKey,
        method: "POST",
        body: { code: "privacy-policy", name: "Privacy Policy", version: "1.0.0" },
      }),
    );
    const policy = (await policyResponse.json()) as {
      versions: Array<{ policy_version_id: string }>;
    };

    const response = await createNotice(
      managementRequest("/api/v1/notices", {
        key: orgA.secretKey,
        method: "POST",
        body: {
          policy_version_id: policy.versions[0].policy_version_id,
          version: "notice-1",
          purpose_codes: ["does-not-exist"],
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "unknown_purpose" } });
    expect(await prisma.notice.count()).toBe(0);
  });
});
