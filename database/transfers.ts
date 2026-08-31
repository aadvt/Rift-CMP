import { randomBytes } from "node:crypto";
import type {
  RecipientCreated,
  RecipientSummary,
  SealedEnvelope,
  TransferAuthorisationStatus,
  TransferAuthorisationSummary,
  TransferBinding,
  TransferDelivery,
  TransferRecordSummary,
  TransferStatus,
} from "@rift-cmp/shared";
import { toWireBinding, toWireEnvelope } from "@rift-cmp/shared";
import {
  ciphertextBytes,
  envelopeDigest,
  isSealedEnvelope,
  MAX_CIPHERTEXT_BYTES,
  TRANSFER_ALGORITHM,
} from "@rift-cmp/secure-transfer";
import type { PrismaClient } from "./generated/client";
import { generateDeliveryKey, hashSecretKey } from "./keys";
import { getEffectiveConsent } from "./consent";

/**
 * Secure data routing.
 *
 * This module deliberately imports only `@rift-cmp/secure-transfer` (the
 * Rift-safe half) and never `@rift-cmp/secure-transfer/fiduciary`. It can hash,
 * measure and validate the shape of an envelope; it cannot open one. See
 * docs/secure-transfer.md.
 */

/** How long an authorisation stays usable. Short, because it is single use. */
export const DEFAULT_AUTHORISATION_TTL_SECONDS = 15 * 60;

// --- Row to API mapping ------------------------------------------------------

type RecipientRow = {
  id: string;
  code: string;
  name: string;
  publicKey: string;
  algorithm: string;
  isActive: boolean;
  createdAt: Date;
};

export function toRecipientSummary(row: RecipientRow): RecipientSummary {
  return {
    recipient_id: row.id,
    code: row.code,
    name: row.name,
    public_key: row.publicKey,
    algorithm: row.algorithm,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
  };
}

type AuthorisationRow = {
  id: string;
  siteId: string;
  consentRecordId: string;
  nonce: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  principal: { externalId: string };
  purpose: { code: string };
  recipient: { code: string; publicKey: string; algorithm: string };
};

export function toAuthorisationSummary(row: AuthorisationRow): TransferAuthorisationSummary {
  return {
    authorisation_id: row.id,
    site_id: row.siteId,
    principal_external_id: row.principal.externalId,
    purpose_code: row.purpose.code,
    recipient_code: row.recipient.code,
    recipient_public_key: row.recipient.publicKey,
    algorithm: row.recipient.algorithm,
    consent_record_id: row.consentRecordId,
    nonce: row.nonce,
    status: row.status as TransferAuthorisationStatus,
    expires_at: row.expiresAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

type TransferRow = {
  id: string;
  authorisationId: string;
  status: string;
  ciphertextSha256: string;
  payloadBytes: number;
  recordedAt: Date;
  deliveredAt: Date | null;
  authorisation: AuthorisationRow;
};

export function toTransferRecordSummary(row: TransferRow): TransferRecordSummary {
  return {
    transfer_id: row.id,
    authorisation_id: row.authorisationId,
    site_id: row.authorisation.siteId,
    purpose_code: row.authorisation.purpose.code,
    recipient_code: row.authorisation.recipient.code,
    principal_external_id: row.authorisation.principal.externalId,
    consent_record_id: row.authorisation.consentRecordId,
    status: row.status as TransferStatus,
    ciphertext_sha256: row.ciphertextSha256,
    payload_bytes: row.payloadBytes,
    recorded_at: row.recordedAt.toISOString(),
    delivered_at: row.deliveredAt ? row.deliveredAt.toISOString() : null,
  };
}

/** Every authorisation query must select these joins for mapping to work. */
const AUTHORISATION_INCLUDE = {
  principal: { select: { externalId: true } },
  purpose: { select: { code: true } },
  recipient: { select: { code: true, publicKey: true, algorithm: true } },
} as const;

/** Rebuilds the AAD inputs. Both fiduciaries derive the same values. */
export function bindingFor(row: AuthorisationRow): TransferBinding {
  return {
    authorisationId: row.id,
    nonce: row.nonce,
    purposeCode: row.purpose.code,
    recipientCode: row.recipient.code,
    principalExternalId: row.principal.externalId,
  };
}

// --- Recipients --------------------------------------------------------------

export async function createRecipient(
  prisma: PrismaClient,
  input: { organisationId: string; code: string; name: string; publicKey: string },
): Promise<RecipientCreated> {
  const deliveryKey = generateDeliveryKey();

  const recipient = await prisma.dataRecipient.create({
    data: {
      organisationId: input.organisationId,
      code: input.code,
      name: input.name,
      publicKey: input.publicKey,
      algorithm: TRANSFER_ALGORITHM,
      deliveryKeyHash: hashSecretKey(deliveryKey),
    },
  });

  return { ...toRecipientSummary(recipient), delivery_key: deliveryKey };
}

export async function listRecipients(
  prisma: PrismaClient,
  organisationId: string,
): Promise<RecipientSummary[]> {
  const rows = await prisma.dataRecipient.findMany({
    where: { organisationId },
    orderBy: { code: "asc" },
  });
  return rows.map(toRecipientSummary);
}

/** Resolves the recipient behind a delivery credential, or null. */
export async function findRecipientByDeliveryKey(prisma: PrismaClient, deliveryKey: string) {
  return prisma.dataRecipient.findUnique({
    where: { deliveryKeyHash: hashSecretKey(deliveryKey) },
    select: { id: true, code: true, organisationId: true, isActive: true },
  });
}

// --- Authorisation -----------------------------------------------------------

export type AuthoriseTransferResult =
  | { ok: true; authorisation: TransferAuthorisationSummary }
  | {
      ok: false;
      code: "not_found" | "unknown_purpose" | "unknown_recipient" | "consent_not_granted";
      message: string;
    };

/**
 * Steps 2 to 6 of the authorisation flow: identify the principal, the purpose
 * and the recipient, verify consent is currently granted, and mint a single-use
 * authorisation.
 *
 * No payload is involved. Rift decides whether a transfer may happen before any
 * ciphertext exists, and the ciphertext is never an input to that decision.
 */
export async function authoriseTransfer(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    siteId: string;
    principalExternalId: string;
    purposeCode: string;
    recipientCode: string;
    ttlSeconds?: number;
  },
): Promise<AuthoriseTransferResult> {
  const site = await prisma.website.findFirst({
    where: { id: input.siteId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!site) {
    return { ok: false, code: "not_found", message: `No site found with id: ${input.siteId}.` };
  }

  const principal = await prisma.principal.findUnique({
    where: {
      siteId_externalId: { siteId: site.id, externalId: input.principalExternalId },
    },
    select: { id: true },
  });
  if (!principal) {
    return {
      ok: false,
      code: "not_found",
      message: `No principal found on this site with that external id.`,
    };
  }

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

  const recipient = await prisma.dataRecipient.findFirst({
    where: { organisationId: input.organisationId, code: input.recipientCode },
    select: { id: true, isActive: true },
  });
  if (!recipient || !recipient.isActive) {
    return {
      ok: false,
      code: "unknown_recipient",
      message: `No active recipient found with code: ${input.recipientCode}.`,
    };
  }

  // Reuses Phase 2's single definition of "current consent", so a transfer can
  // never be authorised against a rule the consent API would disagree with.
  const state = await getEffectiveConsent(prisma, {
    siteId: site.id,
    principalExternalId: input.principalExternalId,
  });
  const decision = state?.effective.find((entry) => entry.purpose_code === input.purposeCode);

  if (!decision || decision.status !== "GRANTED") {
    return {
      ok: false,
      code: "consent_not_granted",
      message: decision
        ? `Consent for "${input.purposeCode}" is currently ${decision.status}.`
        : `No consent decision recorded for "${input.purposeCode}".`,
    };
  }

  const ttl = input.ttlSeconds ?? DEFAULT_AUTHORISATION_TTL_SECONDS;
  const authorisation = await prisma.transferAuthorisation.create({
    data: {
      organisationId: input.organisationId,
      siteId: site.id,
      principalId: principal.id,
      purposeId: purpose.id,
      recipientId: recipient.id,
      consentRecordId: decision.consent_record_id,
      nonce: randomBytes(24).toString("base64url"),
      status: "AUTHORISED",
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
    include: AUTHORISATION_INCLUDE,
  });

  return { ok: true, authorisation: toAuthorisationSummary(authorisation) };
}

// --- Recording a transfer ----------------------------------------------------

export type RecordTransferResult =
  | { ok: true; transfer: TransferRecordSummary }
  | {
      ok: false;
      code:
        | "not_found"
        | "authorisation_expired"
        | "authorisation_consumed"
        | "invalid_envelope"
        | "conflict";
      message: string;
    };

/**
 * Consumes an authorisation and stores the sealed envelope.
 *
 * The envelope is validated for *shape and size only*. Rift cannot check that it
 * decrypts, because it cannot decrypt it - that is the whole point. Authenticity
 * is established by the recipient when the GCM tag is verified.
 */
export async function recordTransfer(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    authorisationId: string;
    nonce: string;
    envelope: SealedEnvelope;
  },
): Promise<RecordTransferResult> {
  if (!isSealedEnvelope(input.envelope)) {
    return { ok: false, code: "invalid_envelope", message: "Envelope is malformed." };
  }

  const bytes = ciphertextBytes(input.envelope);
  if (bytes === 0 || bytes > MAX_CIPHERTEXT_BYTES) {
    return {
      ok: false,
      code: "invalid_envelope",
      message: `Ciphertext must be between 1 and ${MAX_CIPHERTEXT_BYTES} bytes.`,
    };
  }

  const authorisation = await prisma.transferAuthorisation.findFirst({
    where: { id: input.authorisationId, organisationId: input.organisationId },
    include: AUTHORISATION_INCLUDE,
  });
  if (!authorisation) {
    return {
      ok: false,
      code: "not_found",
      message: `No authorisation found with id: ${input.authorisationId}.`,
    };
  }

  // The nonce must match the one issued. A caller holding a stale nonce is
  // replaying, and its envelope would not decrypt anyway.
  if (authorisation.nonce !== input.nonce) {
    return { ok: false, code: "not_found", message: "Authorisation nonce does not match." };
  }

  if (authorisation.status === "CONSUMED") {
    return {
      ok: false,
      code: "authorisation_consumed",
      message: "This authorisation has already been used.",
    };
  }

  if (authorisation.status === "EXPIRED" || authorisation.expiresAt.getTime() <= Date.now()) {
    if (authorisation.status !== "EXPIRED") {
      await prisma.transferAuthorisation.update({
        where: { id: authorisation.id },
        data: { status: "EXPIRED" },
      });
    }
    return {
      ok: false,
      code: "authorisation_expired",
      message: "This authorisation has expired.",
    };
  }

  try {
    // One transaction: the unique constraint on `authorisation_id` is the
    // database-level half of replay prevention, so two concurrent submissions
    // cannot both succeed even if both passed the status check above.
    const [transfer] = await prisma.$transaction([
      prisma.transferRecord.create({
        data: {
          organisationId: input.organisationId,
          authorisationId: authorisation.id,
          ciphertext: input.envelope.ciphertext,
          iv: input.envelope.iv,
          authTag: input.envelope.authTag,
          ephemeralPublicKey: input.envelope.ephemeralPublicKey,
          ciphertextSha256: envelopeDigest(input.envelope),
          payloadBytes: bytes,
          status: "RECORDED",
        },
        include: { authorisation: { include: AUTHORISATION_INCLUDE } },
      }),
      prisma.transferAuthorisation.update({
        where: { id: authorisation.id },
        data: { status: "CONSUMED" },
      }),
    ]);

    return { ok: true, transfer: toTransferRecordSummary(transfer) };
  } catch {
    return {
      ok: false,
      code: "conflict",
      message: "A transfer has already been recorded for this authorisation.",
    };
  }
}

// --- Collection and reporting ------------------------------------------------

export type CollectTransferResult =
  | { ok: true; delivery: TransferDelivery }
  | { ok: false; code: "not_found"; message: string };

/**
 * Hands a sealed envelope to the recipient it was addressed to.
 *
 * Scoped by `recipientId`, so a delivery credential can only ever collect
 * envelopes sealed for that recipient. It confers no ability to read them: that
 * still requires the X25519 private key Rift has never seen.
 */
export async function collectTransfer(
  prisma: PrismaClient,
  input: { recipientId: string; transferId: string },
): Promise<CollectTransferResult> {
  const transfer = await prisma.transferRecord.findFirst({
    where: { id: input.transferId, authorisation: { recipientId: input.recipientId } },
    include: { authorisation: { include: AUTHORISATION_INCLUDE } },
  });

  if (!transfer) {
    return {
      ok: false,
      code: "not_found",
      message: `No transfer found with id: ${input.transferId}.`,
    };
  }

  if (transfer.status !== "DELIVERED") {
    await prisma.transferRecord.update({
      where: { id: transfer.id },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  }

  return {
    ok: true,
    delivery: {
      transfer_id: transfer.id,
      envelope: toWireEnvelope({
        ciphertext: transfer.ciphertext,
        iv: transfer.iv,
        authTag: transfer.authTag,
        ephemeralPublicKey: transfer.ephemeralPublicKey,
      }),
      binding: toWireBinding(bindingFor(transfer.authorisation)),
      ciphertext_sha256: transfer.ciphertextSha256,
      recorded_at: transfer.recordedAt.toISOString(),
    },
  };
}

/** Pending envelopes addressed to one recipient. Metadata only, no payload. */
export async function listPendingForRecipient(
  prisma: PrismaClient,
  recipientId: string,
): Promise<TransferRecordSummary[]> {
  const rows = await prisma.transferRecord.findMany({
    where: { authorisation: { recipientId }, status: "RECORDED" },
    orderBy: { recordedAt: "asc" },
    include: { authorisation: { include: AUTHORISATION_INCLUDE } },
  });
  return rows.map(toTransferRecordSummary);
}

/** A source organisation's own transfer records. Never includes the envelope. */
export async function listTransfers(
  prisma: PrismaClient,
  filter: { organisationId: string; siteId?: string; limit?: number },
): Promise<TransferRecordSummary[]> {
  const rows = await prisma.transferRecord.findMany({
    where: {
      organisationId: filter.organisationId,
      ...(filter.siteId ? { authorisation: { siteId: filter.siteId } } : {}),
    },
    orderBy: { recordedAt: "desc" },
    take: filter.limit ?? 200,
    include: { authorisation: { include: AUTHORISATION_INCLUDE } },
  });
  return rows.map(toTransferRecordSummary);
}
