/**
 * Approved consent policy versions, and the overrides that outlive them.
 *
 * Two persistence concerns with opposite lifecycles, which is why they are two
 * tables rather than one:
 *
 *   A **policy version** is a record of what an operator agreed to at a moment.
 *   It is immutable once approved, because a consent decision recorded against
 *   it cites the configuration that was live, and rewriting the configuration
 *   would destroy the only evidence of what the visitor was actually shown.
 *
 *   An **override** is a standing preference. Changing your mind about how to
 *   treat a vendor is the entire point of it, so it is mutable, and it is keyed
 *   on the detector rather than on a scan row so it survives the vendor
 *   disappearing from a scan.
 *
 * Every function takes its tenant explicitly, like the rest of this package.
 */

import type { PrismaClient } from "./generated/client";
import type {
  ConsentPolicyVersionSummary,
  OverrideSummary,
  RecommendedAction,
  VendorRecommendation,
} from "@rift-cmp/shared";

type PolicyVersionRow = {
  id: string;
  siteId: string;
  version: number;
  status: string;
  scanId: string | null;
  recommendations: unknown;
  jurisdictions: string[];
  regimes: string[];
  approvalNote: string | null;
  createdAt: Date;
  approvedAt: Date | null;
};

export function toConsentPolicyVersionSummary(
  row: PolicyVersionRow,
): ConsentPolicyVersionSummary {
  return {
    policy_version_id: row.id,
    site_id: row.siteId,
    version: row.version,
    status: row.status as ConsentPolicyVersionSummary["status"],
    scan_id: row.scanId,
    jurisdictions: row.jurisdictions,
    regimes: row.regimes,
    approval_note: row.approvalNote,
    created_at: row.createdAt.toISOString(),
    approved_at: row.approvedAt?.toISOString() ?? null,
    recommendations: (row.recommendations ?? []) as VendorRecommendation[],
  };
}

/** The version currently serving the runtime, if any. */
export async function getApprovedPolicyVersion(
  prisma: PrismaClient,
  organisationId: string,
  siteId: string,
): Promise<ConsentPolicyVersionSummary | null> {
  const row = await prisma.consentPolicyVersion.findFirst({
    where: { organisationId, siteId, status: "approved" },
  });
  return row ? toConsentPolicyVersionSummary(row) : null;
}

export async function listPolicyVersions(
  prisma: PrismaClient,
  organisationId: string,
  siteId: string,
  limit = 50,
): Promise<ConsentPolicyVersionSummary[]> {
  const rows = await prisma.consentPolicyVersion.findMany({
    where: { organisationId, siteId },
    orderBy: { version: "desc" },
    take: limit,
  });
  return rows.map(toConsentPolicyVersionSummary);
}

export type ApprovePolicyResult =
  | { ok: true; version: ConsentPolicyVersionSummary }
  | { ok: false; code: "site_not_found" | "version_conflict"; message: string };

/**
 * Approve a set of recommendations, publishing them as the next version.
 *
 * Everything happens in one transaction, and the ordering matters: the previous
 * approved version is superseded *before* the new one is inserted, because a
 * partial unique index permits only one `approved` row per site. Inserting
 * first would violate it, which is the database refusing to let two
 * configurations both claim to be live — the failure mode this is designed
 * around rather than worked around.
 *
 * The version number is computed inside the transaction from the current
 * maximum. Two concurrent approvals therefore race for one number and the loser
 * hits the `(site_id, version)` unique constraint and is reported as a
 * conflict, rather than one silently overwriting the other.
 */
export async function approvePolicyVersion(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    scanId: string | null;
    recommendations: VendorRecommendation[];
    jurisdictions: string[];
    regimes: string[];
    approvalNote?: string | null;
  },
): Promise<ApprovePolicyResult> {
  const site = await prisma.website.findFirst({
    where: { id: input.siteId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!site) {
    return {
      ok: false,
      code: "site_not_found",
      message: `No site found with id: ${input.siteId}.`,
    };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const highest = await tx.consentPolicyVersion.findFirst({
        where: { siteId: input.siteId },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      await tx.consentPolicyVersion.updateMany({
        where: { siteId: input.siteId, status: "approved" },
        data: { status: "superseded" },
      });

      return tx.consentPolicyVersion.create({
        data: {
          siteId: input.siteId,
          organisationId: input.organisationId,
          version: (highest?.version ?? 0) + 1,
          status: "approved",
          scanId: input.scanId,
          recommendations: input.recommendations as never,
          jurisdictions: input.jurisdictions,
          regimes: input.regimes,
          approvalNote: input.approvalNote ?? null,
          approvedAt: new Date(),
        },
      });
    });

    return { ok: true, version: toConsentPolicyVersionSummary(created) };
  } catch {
    // The unique constraint on (site_id, version) or the one-approved-per-site
    // index. Both mean somebody else approved while this request was in flight.
    return {
      ok: false,
      code: "version_conflict",
      message:
        "Another approval completed while this one was in flight. Re-read the recommendations and approve again.",
    };
  }
}

// ─── Overrides ───────────────────────────────────────────────────────────────

export async function listOverrides(
  prisma: PrismaClient,
  organisationId: string,
  siteId: string,
): Promise<OverrideSummary[]> {
  const rows = await prisma.consentRecommendationOverride.findMany({
    where: { organisationId, siteId },
    orderBy: { detectorId: "asc" },
  });
  return rows.map((row) => ({
    detector_id: row.detectorId,
    purpose_code: row.purposeCode,
    action: row.action as RecommendedAction,
    note: row.note,
    updated_at: row.updatedAt.toISOString(),
  }));
}

export type SetOverrideResult =
  | { ok: true; override: OverrideSummary }
  | { ok: false; code: "site_not_found"; message: string };

/** Set or replace one override. Upsert, because it is a standing preference. */
export async function setOverride(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    detectorId: string;
    purposeCode: string | null;
    action: RecommendedAction;
    note: string | null;
  },
): Promise<SetOverrideResult> {
  const site = await prisma.website.findFirst({
    where: { id: input.siteId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!site) {
    return {
      ok: false,
      code: "site_not_found",
      message: `No site found with id: ${input.siteId}.`,
    };
  }

  const row = await prisma.consentRecommendationOverride.upsert({
    where: {
      siteId_detectorId: { siteId: input.siteId, detectorId: input.detectorId },
    },
    create: {
      siteId: input.siteId,
      organisationId: input.organisationId,
      detectorId: input.detectorId,
      purposeCode: input.purposeCode,
      action: input.action,
      note: input.note,
    },
    update: {
      purposeCode: input.purposeCode,
      action: input.action,
      note: input.note,
    },
  });

  return {
    ok: true,
    override: {
      detector_id: row.detectorId,
      purpose_code: row.purposeCode,
      action: row.action as RecommendedAction,
      note: row.note,
      updated_at: row.updatedAt.toISOString(),
    },
  };
}

/** Remove an override, so the vendor falls back to what is recommended. */
export async function clearOverride(
  prisma: PrismaClient,
  organisationId: string,
  siteId: string,
  detectorId: string,
): Promise<boolean> {
  const result = await prisma.consentRecommendationOverride.deleteMany({
    where: { organisationId, siteId, detectorId },
  });
  return result.count > 0;
}
