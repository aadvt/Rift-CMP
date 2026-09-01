import type { AuditEntry } from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";

/**
 * The audit query.
 *
 * Reads the three domains separately and interleaves them by time. They are
 * deliberately not joined in SQL: consent has no foreign key to transfers, and
 * introducing one to make this query tidier would couple domains that Phase 2
 * and Phase 3 kept apart on purpose. The join happens here, in a read model,
 * where it costs nothing structurally.
 *
 * Every query is scoped by `organisationId`, which the caller derives from an
 * authenticated credential. The optional filters narrow within a tenant and can
 * never widen beyond one.
 */

const DEFAULT_LIMIT = 200;

export interface AuditFilter {
  organisationId: string;
  siteId?: string;
  principalExternalId?: string;
  purposeCode?: string;
  limit?: number;
}

export async function getAuditTrail(
  prisma: PrismaClient,
  filter: AuditFilter,
): Promise<AuditEntry[]> {
  const limit = filter.limit ?? DEFAULT_LIMIT;

  const scope = {
    organisationId: filter.organisationId,
    ...(filter.siteId ? { siteId: filter.siteId } : {}),
    ...(filter.principalExternalId
      ? { principal: { externalId: filter.principalExternalId } }
      : {}),
    ...(filter.purposeCode ? { purpose: { code: filter.purposeCode } } : {}),
  };

  const include = {
    principal: { select: { externalId: true } },
    purpose: { select: { code: true } },
  } as const;

  const [consentRecords, authorisations, transfers] = await Promise.all([
    prisma.consentRecord.findMany({
      where: scope,
      orderBy: { decidedAt: "desc" },
      take: limit,
      include,
    }),
    prisma.transferAuthorisation.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { ...include, recipient: { select: { code: true } } },
    }),
    prisma.transferRecord.findMany({
      where: {
        organisationId: filter.organisationId,
        authorisation: {
          ...(filter.siteId ? { siteId: filter.siteId } : {}),
          ...(filter.principalExternalId
            ? { principal: { externalId: filter.principalExternalId } }
            : {}),
          ...(filter.purposeCode ? { purpose: { code: filter.purposeCode } } : {}),
        },
      },
      orderBy: { recordedAt: "desc" },
      take: limit,
      include: {
        authorisation: { include: { ...include, recipient: { select: { code: true } } } },
      },
    }),
  ]);

  const entries: AuditEntry[] = [
    ...consentRecords.map((row): AuditEntry => ({
      kind: "consent",
      at: row.decidedAt.toISOString(),
      site_id: row.siteId,
      principal_external_id: row.principal.externalId,
      purpose_code: row.purpose.code,
      status: row.status,
      summary: `Principal recorded ${row.status} for "${row.purpose.code}".`,
      consent_record_id: row.id,
      authorisation_id: null,
      transfer_id: null,
    })),

    ...authorisations.map((row): AuditEntry => ({
      kind: "authorisation",
      at: row.createdAt.toISOString(),
      site_id: row.siteId,
      principal_external_id: row.principal.externalId,
      purpose_code: row.purpose.code,
      status: row.status,
      summary:
        `Transfer to "${row.recipient.code}" authorised for "${row.purpose.code}", ` +
        `relying on consent record ${row.consentRecordId}.`,
      consent_record_id: row.consentRecordId,
      authorisation_id: row.id,
      transfer_id: null,
    })),

    ...transfers.map((row): AuditEntry => ({
      kind: "transfer",
      at: row.recordedAt.toISOString(),
      site_id: row.authorisation.siteId,
      principal_external_id: row.authorisation.principal.externalId,
      purpose_code: row.authorisation.purpose.code,
      status: row.status,
      summary:
        `Sealed payload of ${row.payloadBytes} bytes recorded for ` +
        `"${row.authorisation.recipient.code}" (${row.status.toLowerCase()}).`,
      consent_record_id: row.authorisation.consentRecordId,
      authorisation_id: row.authorisationId,
      transfer_id: row.id,
    })),
  ];

  // Newest first. Ties break by kind so a consent decision, the authorisation
  // it justified and the resulting transfer read in causal order even when
  // they land in the same millisecond.
  const kindOrder: Record<AuditEntry["kind"], number> = {
    transfer: 0,
    authorisation: 1,
    consent: 2,
  };

  return entries
    .sort((a, b) => {
      const byTime = Date.parse(b.at) - Date.parse(a.at);
      return byTime !== 0 ? byTime : kindOrder[a.kind] - kindOrder[b.kind];
    })
    .slice(0, limit);
}
