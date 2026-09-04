import type {
  ConsentRecordSummary,
  ConsentStatus,
  EffectiveConsent,
  NoticeSummary,
  PolicySummary,
  PolicyVersionSummary,
  PurposeSummary,
} from "@rift-cmp/shared";
import { resolveEffectiveConsent } from "@rift-cmp/shared";
import { proofHash } from "@rift-cmp/shared/consent-proof";
import type { Prisma, PrismaClient } from "./generated/client";

/**
 * Consent domain data access.
 *
 * Every function here takes the tenant it operates in as an explicit argument
 * (`organisationId` and/or `siteId`, both derived from an authenticated
 * credential by the caller) and scopes its queries to it. Nothing in this module
 * can be asked to "just look up a purpose by id" without saying whose it is.
 *
 * The consent domain is intentionally not joined to the analytics domain: these
 * queries never touch `Session` or `Event`.
 */

// --- Row to API mapping ------------------------------------------------------

type PurposeRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
};

export function toPurposeSummary(row: PurposeRow): PurposeSummary {
  return {
    purpose_id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
  };
}

type PolicyVersionRow = {
  id: string;
  policyId: string;
  version: string;
  documentUrl: string | null;
  contentHash: string | null;
  publishedAt: Date;
};

export function toPolicyVersionSummary(
  row: PolicyVersionRow,
  policyCode: string,
): PolicyVersionSummary {
  return {
    policy_version_id: row.id,
    policy_id: row.policyId,
    policy_code: policyCode,
    version: row.version,
    document_url: row.documentUrl,
    content_hash: row.contentHash,
    published_at: row.publishedAt.toISOString(),
  };
}

type PolicyRow = {
  id: string;
  code: string;
  name: string;
  createdAt: Date;
  versions: PolicyVersionRow[];
};

export function toPolicySummary(row: PolicyRow): PolicySummary {
  return {
    policy_id: row.id,
    code: row.code,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    versions: row.versions.map((version) => toPolicyVersionSummary(version, row.code)),
  };
}

type NoticeRow = {
  id: string;
  version: string;
  locale: string;
  policyVersionId: string;
  publishedAt: Date;
  purposes: Array<{ purpose: { code: string } }>;
};

export function toNoticeSummary(row: NoticeRow): NoticeSummary {
  return {
    notice_id: row.id,
    version: row.version,
    locale: row.locale,
    policy_version_id: row.policyVersionId,
    published_at: row.publishedAt.toISOString(),
    purpose_codes: row.purposes.map((link) => link.purpose.code).sort(),
  };
}

type ConsentRecordRow = {
  id: string;
  siteId: string;
  status: string;
  noticeId: string | null;
  policyVersionId: string | null;
  source: string;
  decidedAt: Date;
  recordedAt: Date;
  metadata: Prisma.JsonValue | null;
  purpose: { code: string };
  principal: { externalId: string };
};

export function toConsentRecordSummary(row: ConsentRecordRow): ConsentRecordSummary {
  return {
    consent_record_id: row.id,
    site_id: row.siteId,
    principal_external_id: row.principal.externalId,
    purpose_code: row.purpose.code,
    status: row.status as ConsentStatus,
    notice_id: row.noticeId,
    policy_version_id: row.policyVersionId,
    source: row.source,
    decided_at: row.decidedAt.toISOString(),
    recorded_at: row.recordedAt.toISOString(),
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

/** Shape every consent-record query must select, so mapping always has its joins. */
const CONSENT_RECORD_INCLUDE = {
  purpose: { select: { code: true } },
  principal: { select: { externalId: true } },
} as const;

// --- Reference data provisioning ---------------------------------------------

export async function createPurpose(
  prisma: PrismaClient,
  input: { organisationId: string; code: string; name: string; description: string },
): Promise<PurposeSummary> {
  return toPurposeSummary(await prisma.purpose.create({ data: input }));
}

export async function listPurposes(
  prisma: PrismaClient,
  organisationId: string,
): Promise<PurposeSummary[]> {
  const rows = await prisma.purpose.findMany({
    where: { organisationId },
    orderBy: { code: "asc" },
  });
  return rows.map(toPurposeSummary);
}

/** Creates a policy with its first version - a policy with no version is not useful. */
export async function createPolicy(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    code: string;
    name: string;
    version: string;
    documentUrl?: string | null;
    contentHash?: string | null;
  },
): Promise<PolicySummary> {
  const policy = await prisma.policy.create({
    data: {
      organisationId: input.organisationId,
      code: input.code,
      name: input.name,
      versions: {
        // The nested version sets no `organisationId` of its own: it is half of
        // the composite key tying a version to its policy, so Prisma copies it
        // from the parent. That makes an inconsistent pair unrepresentable.
        create: {
          version: input.version,
          documentUrl: input.documentUrl ?? null,
          contentHash: input.contentHash ?? null,
        },
      },
    },
    include: { versions: { orderBy: { publishedAt: "asc" } } },
  });
  return toPolicySummary(policy);
}

/** Adds a version to an existing policy. Returns null if the policy is not the caller's. */
export async function createPolicyVersion(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    policyId: string;
    version: string;
    documentUrl?: string | null;
    contentHash?: string | null;
  },
): Promise<PolicyVersionSummary | null> {
  const policy = await prisma.policy.findFirst({
    where: { id: input.policyId, organisationId: input.organisationId },
    select: { id: true, code: true },
  });
  if (!policy) return null;

  const version = await prisma.policyVersion.create({
    data: {
      organisationId: input.organisationId,
      policyId: policy.id,
      version: input.version,
      documentUrl: input.documentUrl ?? null,
      contentHash: input.contentHash ?? null,
    },
  });
  return toPolicyVersionSummary(version, policy.code);
}

export async function listPolicies(
  prisma: PrismaClient,
  organisationId: string,
): Promise<PolicySummary[]> {
  const rows = await prisma.policy.findMany({
    where: { organisationId },
    orderBy: { code: "asc" },
    include: { versions: { orderBy: { publishedAt: "asc" } } },
  });
  return rows.map(toPolicySummary);
}

export type CreateNoticeResult =
  | { ok: true; notice: NoticeSummary }
  | { ok: false; code: "unknown_policy" | "unknown_purpose"; message: string };

export async function createNotice(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    policyVersionId: string;
    version: string;
    locale?: string;
    purposeCodes: string[];
  },
): Promise<CreateNoticeResult> {
  const policyVersion = await prisma.policyVersion.findFirst({
    where: { id: input.policyVersionId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!policyVersion) {
    return {
      ok: false,
      code: "unknown_policy",
      message: `No policy version found with id: ${input.policyVersionId}.`,
    };
  }

  const purposes = await prisma.purpose.findMany({
    where: { organisationId: input.organisationId, code: { in: input.purposeCodes } },
    select: { id: true, code: true },
  });

  const missing = input.purposeCodes.filter(
    (code) => !purposes.some((purpose) => purpose.code === code),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      code: "unknown_purpose",
      message: `Unknown purpose code(s): ${missing.join(", ")}.`,
    };
  }

  const notice = await prisma.notice.create({
    data: {
      organisationId: input.organisationId,
      policyVersionId: policyVersion.id,
      version: input.version,
      locale: input.locale ?? "en",
      purposes: { create: purposes.map((purpose) => ({ purposeId: purpose.id })) },
    },
    include: { purposes: { include: { purpose: { select: { code: true } } } } },
  });

  return { ok: true, notice: toNoticeSummary(notice) };
}

export async function listNotices(
  prisma: PrismaClient,
  organisationId: string,
): Promise<NoticeSummary[]> {
  const rows = await prisma.notice.findMany({
    where: { organisationId },
    orderBy: { publishedAt: "asc" },
    include: { purposes: { include: { purpose: { select: { code: true } } } } },
  });
  return rows.map(toNoticeSummary);
}

// --- Decisions ---------------------------------------------------------------

export type RecordConsentResult =
  | { ok: true; record: ConsentRecordSummary }
  | { ok: false; code: "unknown_purpose" | "unknown_notice" | "unknown_policy"; message: string };

/**
 * Appends one immutable consent decision.
 *
 * Never updates a previous record - "changing your mind" is a new row, which is
 * what makes the log an audit trail. The database enforces this too: an UPDATE
 * on `consent_records` is rejected by a trigger.
 *
 * Every reference is resolved within the caller's tenant, so a purpose or notice
 * belonging to another organisation is indistinguishable from one that does not
 * exist.
 */
export async function recordConsentDecision(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    principalExternalId: string;
    principalKind?: string;
    purposeCode: string;
    status: ConsentStatus;
    noticeId?: string | null;
    policyVersionId?: string | null;
    source?: string;
    decidedAt?: Date;
    metadata?: Prisma.InputJsonValue | null;

    // ── Phase 10A: evidence ──────────────────────────────────────────────────
    //
    // Optional throughout. A caller that supplies none writes a record exactly
    // as it would have before, which is what keeps every existing path working
    // and stops the platform inventing context it did not observe.

    /** Jurisdictions in play, as the caller resolved them. */
    jurisdictions?: readonly string[];
    /** How the decision was expressed: "banner", "preference_centre", "api". */
    mechanism?: string | null;
    /** The consent configuration version being served at the time. */
    policyConfigVersion?: string | null;
    /** Vendors the surface named. Display names only. */
    vendors?: readonly string[];
  },
): Promise<RecordConsentResult> {
  const purpose = await prisma.purpose.findFirst({
    where: { organisationId: input.organisationId, code: input.purposeCode },
    select: { id: true },
  });
  if (!purpose) {
    return {
      ok: false,
      code: "unknown_purpose",
      message: `No purpose found with code: ${input.purposeCode}.`,
    };
  }

  let policyVersionId = input.policyVersionId ?? null;

  if (input.noticeId) {
    const notice = await prisma.notice.findFirst({
      where: { id: input.noticeId, organisationId: input.organisationId },
      select: { id: true, policyVersionId: true, purposes: { select: { purposeId: true } } },
    });
    if (!notice) {
      return {
        ok: false,
        code: "unknown_notice",
        message: `No notice found with id: ${input.noticeId}.`,
      };
    }

    // A notice cannot be cited as cover for a purpose it never disclosed.
    if (!notice.purposes.some((link) => link.purposeId === purpose.id)) {
      return {
        ok: false,
        code: "unknown_purpose",
        message: `Notice ${input.noticeId} does not disclose purpose "${input.purposeCode}".`,
      };
    }

    // The notice pins the policy version, unless one was stated explicitly.
    policyVersionId = policyVersionId ?? notice.policyVersionId;
  }

  if (policyVersionId) {
    const policyVersion = await prisma.policyVersion.findFirst({
      where: { id: policyVersionId, organisationId: input.organisationId },
      select: { id: true },
    });
    if (!policyVersion) {
      return {
        ok: false,
        code: "unknown_policy",
        message: `No policy version found with id: ${policyVersionId}.`,
      };
    }
  }

  const principal = await prisma.principal.upsert({
    where: { siteId_externalId: { siteId: input.siteId, externalId: input.principalExternalId } },
    update: {},
    create: {
      siteId: input.siteId,
      externalId: input.principalExternalId,
      kind: input.principalKind ?? "anonymous",
    },
    select: { id: true },
  });

  const decidedAt = input.decidedAt ?? new Date();
  const jurisdictions = [...(input.jurisdictions ?? [])];
  const vendors = [...(input.vendors ?? [])];
  const source = input.source ?? "api";

  // The receipt digest is computed here, at write time, over the evidence as
  // stored. Computing it on read would let it drift from the row it describes,
  // which is precisely what a receipt exists to rule out.
  const proof = proofHash({
    siteId: input.siteId,
    principalExternalId: input.principalExternalId,
    purposeCode: input.purposeCode,
    status: input.status,
    decidedAt,
    noticeId: input.noticeId ?? null,
    policyVersionId,
    policyConfigVersion: input.policyConfigVersion ?? null,
    jurisdictions,
    vendors,
    mechanism: input.mechanism ?? null,
    source,
  });

  const record = await prisma.consentRecord.create({
    data: {
      organisationId: input.organisationId,
      siteId: input.siteId,
      principalId: principal.id,
      purposeId: purpose.id,
      noticeId: input.noticeId ?? null,
      policyVersionId,
      status: input.status,
      source,
      decidedAt,
      jurisdictions,
      vendors,
      mechanism: input.mechanism ?? null,
      policyConfigVersion: input.policyConfigVersion ?? null,
      proofHash: proof,
      ...(input.metadata == null ? {} : { metadata: input.metadata }),
    },
    include: CONSENT_RECORD_INCLUDE,
  });

  return { ok: true, record: toConsentRecordSummary(record) };
}

/**
 * The full decision log for a tenant, newest first.
 *
 * Always scoped by `organisationId`; the optional filters narrow within it and
 * can never widen beyond it.
 */
export async function getConsentHistory(
  prisma: PrismaClient,
  filter: {
    organisationId: string;
    siteId?: string;
    principalExternalId?: string;
    purposeCode?: string;
    limit?: number;
  },
): Promise<ConsentRecordSummary[]> {
  const rows = await prisma.consentRecord.findMany({
    where: {
      organisationId: filter.organisationId,
      ...(filter.siteId ? { siteId: filter.siteId } : {}),
      ...(filter.principalExternalId
        ? { principal: { externalId: filter.principalExternalId } }
        : {}),
      ...(filter.purposeCode ? { purpose: { code: filter.purposeCode } } : {}),
    },
    orderBy: [{ decidedAt: "desc" }, { recordedAt: "desc" }, { id: "desc" }],
    take: filter.limit ?? 500,
    include: CONSENT_RECORD_INCLUDE,
  });
  return rows.map(toConsentRecordSummary);
}

/**
 * The decision currently in force for each purpose, for one principal on one
 * site. Derived from the log by the shared `resolveEffectiveConsent`, so the
 * server and the SDK can never disagree about what "current" means.
 *
 * Returns null when the principal has never been seen on this site, which the
 * caller can distinguish from "seen, but has decided nothing".
 */
export async function getEffectiveConsent(
  prisma: PrismaClient,
  filter: { siteId: string; principalExternalId: string },
): Promise<{ principalId: string; effective: EffectiveConsent[] } | null> {
  const principal = await prisma.principal.findUnique({
    where: {
      siteId_externalId: { siteId: filter.siteId, externalId: filter.principalExternalId },
    },
    select: { id: true },
  });
  if (!principal) return null;

  const rows = await prisma.consentRecord.findMany({
    where: { siteId: filter.siteId, principalId: principal.id },
    orderBy: [{ decidedAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }],
    include: CONSENT_RECORD_INCLUDE,
  });

  return {
    principalId: principal.id,
    effective: resolveEffectiveConsent(rows.map(toConsentRecordSummary)),
  };
}
