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

// ─── Phase 10A: rights requests ──────────────────────────────────────────────

export interface RightsRequestSummary {
  request_id: string;
  site_id: string;
  principal_external_id: string;
  kind: string;
  status: string;
  jurisdictions: string[];
  rule_references: string[];
  message: string | null;
  resolution_note: string | null;
  /** Present only to the operator; never returned on the browser plane. */
  contact: string | null;
  received_at: string;
  responded_at: string | null;
  due_at: string | null;
}

type RightsRow = {
  id: string;
  siteId: string;
  kind: string;
  status: string;
  jurisdictions: string[];
  ruleReferences: string[];
  message: string | null;
  resolutionNote: string | null;
  contact: string | null;
  receivedAt: Date;
  respondedAt: Date | null;
  dueAt: Date | null;
  principal?: { externalId: string } | null;
};

export function toRightsRequestSummary(row: RightsRow): RightsRequestSummary {
  return {
    request_id: row.id,
    site_id: row.siteId,
    principal_external_id: row.principal?.externalId ?? "",
    kind: row.kind,
    status: row.status,
    jurisdictions: row.jurisdictions,
    rule_references: row.ruleReferences,
    message: row.message,
    resolution_note: row.resolutionNote,
    contact: row.contact,
    received_at: row.receivedAt.toISOString(),
    responded_at: row.respondedAt?.toISOString() ?? null,
    due_at: row.dueAt?.toISOString() ?? null,
  };
}

export type SubmitRightsResult =
  | { ok: true; request: RightsRequestSummary }
  | { ok: false; code: "principal_not_found"; message: string };

/**
 * Record one request from a principal.
 *
 * The principal must already exist: a rights request is made *about* recorded
 * data, and minting a principal to receive one would create the subject the
 * request is supposed to be about. A browser that has never decided anything
 * has nothing to ask after.
 */
export async function submitRightsRequest(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    principalExternalId: string;
    kind: string;
    jurisdictions: string[];
    ruleReferences: string[];
    message?: string | null;
    contact?: string | null;
  },
): Promise<SubmitRightsResult> {
  const principal = await prisma.principal.findFirst({
    where: { siteId: input.siteId, externalId: input.principalExternalId },
    select: { id: true },
  });
  if (!principal) {
    return {
      ok: false,
      code: "principal_not_found",
      message: "No principal with that identifier exists for this site.",
    };
  }

  const row = await prisma.rightsRequest.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId,
      principalId: principal.id,
      kind: input.kind,
      jurisdictions: input.jurisdictions,
      ruleReferences: input.ruleReferences,
      message: input.message ?? null,
      contact: input.contact ?? null,
    },
    include: { principal: { select: { externalId: true } } },
  });

  return { ok: true, request: toRightsRequestSummary(row) };
}

export async function listRightsRequests(
  prisma: PrismaClient,
  organisationId: string,
  options: { siteId?: string; principalExternalId?: string; limit?: number } = {},
): Promise<RightsRequestSummary[]> {
  const rows = await prisma.rightsRequest.findMany({
    where: {
      organisationId,
      ...(options.siteId ? { siteId: options.siteId } : {}),
      ...(options.principalExternalId
        ? { principal: { externalId: options.principalExternalId } }
        : {}),
    },
    orderBy: { receivedAt: "desc" },
    take: Math.min(options.limit ?? 100, 500),
    include: { principal: { select: { externalId: true } } },
  });
  return rows.map(toRightsRequestSummary);
}

export type UpdateRightsResult =
  | { ok: true; request: RightsRequestSummary }
  | { ok: false; code: "not_found"; message: string };

/**
 * Move a request along.
 *
 * Mutable, unlike a consent record, and for a reason worth stating: a consent
 * decision is a fact about what somebody chose, while a request's status is a
 * fact about what an operator has done so far. Freezing the second would mean a
 * request could never be answered.
 *
 * What is *not* mutable is `kind`, `received_at` or the principal — what was
 * asked, by whom and when. Only the handling changes.
 */
export async function updateRightsRequest(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    requestId: string;
    status?: string;
    resolutionNote?: string | null;
    dueAt?: Date | null;
  },
): Promise<UpdateRightsResult> {
  const existing = await prisma.rightsRequest.findFirst({
    where: { id: input.requestId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!existing) {
    return {
      ok: false,
      code: "not_found",
      message: `No rights request found with id: ${input.requestId}.`,
    };
  }

  const terminal = input.status === "completed" || input.status === "refused";

  const row = await prisma.rightsRequest.update({
    where: { id: input.requestId },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.resolutionNote !== undefined
        ? { resolutionNote: input.resolutionNote }
        : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      // Stamped when the request reaches a terminal state, so "how long did
      // this take" is answerable without reconstructing it from a log.
      ...(terminal ? { respondedAt: new Date() } : {}),
    },
    include: { principal: { select: { externalId: true } } },
  });

  return { ok: true, request: toRightsRequestSummary(row) };
}
