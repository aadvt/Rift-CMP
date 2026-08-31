// `import type` matters here: `shared` is bundled into the browser SDK, and the
// secure-transfer package depends on `node:crypto`. A type-only import is erased
// at compile time, so no Node built-in reaches the browser bundle.
import type { SealedEnvelope, TransferBinding } from "@rift-cmp/secure-transfer";

/**
 * HTTP contract for secure data routing.
 *
 * These types describe what crosses the wire between a fiduciary and Rift. None
 * of them carry plaintext or private key material - see docs/secure-transfer.md.
 */

export type { SealedEnvelope, TransferBinding };

/** Lifecycle of a single-use permission to transfer. */
export const TRANSFER_AUTHORISATION_STATUSES = ["AUTHORISED", "CONSUMED", "EXPIRED"] as const;
export type TransferAuthorisationStatus = (typeof TRANSFER_AUTHORISATION_STATUSES)[number];

/** Lifecycle of the transfer itself. */
export const TRANSFER_STATUSES = ["RECORDED", "DELIVERED", "FAILED"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** A registered target fiduciary. Never includes delivery key material. */
export interface RecipientSummary {
  recipient_id: string;
  code: string;
  name: string;
  /** The target's X25519 public key. Public by design. */
  public_key: string;
  algorithm: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Result of registering a recipient. The delivery key exists in readable form
 * only in this response; Rift stores nothing but its digest.
 */
export interface RecipientCreated extends RecipientSummary {
  delivery_key: string;
}

/**
 * A granted authorisation. The source needs every field here to seal a payload:
 * the public key to encrypt to, and the binding fields to build the AAD.
 */
export interface TransferAuthorisationSummary {
  authorisation_id: string;
  site_id: string;
  principal_external_id: string;
  purpose_code: string;
  recipient_code: string;
  recipient_public_key: string;
  algorithm: string;
  /** The exact consent decision this authorisation relied on. */
  consent_record_id: string;
  nonce: string;
  status: TransferAuthorisationStatus;
  expires_at: string;
  created_at: string;
}

/** Routing metadata for a completed transfer. Contains no payload. */
export interface TransferRecordSummary {
  transfer_id: string;
  authorisation_id: string;
  site_id: string;
  purpose_code: string;
  recipient_code: string;
  principal_external_id: string;
  consent_record_id: string;
  status: TransferStatus;
  /** Integrity check the recipient can verify without Rift reading anything. */
  ciphertext_sha256: string;
  payload_bytes: number;
  recorded_at: string;
  delivered_at: string | null;
}

/**
 * The envelope as it crosses the wire.
 *
 * Deliberately snake_case, matching every other field in this API. The crypto
 * package's `SealedEnvelope` is camelCase because it is a TypeScript value, not
 * a wire format; the two are converted at the boundary rather than leaking one
 * convention into the other.
 */
export interface TransferEnvelopeWire {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  ephemeral_public_key: string;
}

/** The routing facts needed to rebuild the AAD, in wire form. */
export interface TransferBindingWire {
  authorisation_id: string;
  nonce: string;
  purpose_code: string;
  recipient_code: string;
  principal_external_id: string;
}

/**
 * What a target fiduciary collects: the sealed envelope plus exactly the
 * metadata needed to rebuild the AAD and decrypt it.
 */
export interface TransferDelivery {
  transfer_id: string;
  envelope: TransferEnvelopeWire;
  binding: TransferBindingWire;
  ciphertext_sha256: string;
  recorded_at: string;
}

// --- Wire conversion ---------------------------------------------------------
//
// Pure object mapping, so both the server and a fiduciary can use them without
// pulling in any cryptographic code.

export function toWireEnvelope(envelope: SealedEnvelope): TransferEnvelopeWire {
  return {
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    auth_tag: envelope.authTag,
    ephemeral_public_key: envelope.ephemeralPublicKey,
  };
}

export function fromWireEnvelope(wire: TransferEnvelopeWire): SealedEnvelope {
  return {
    ciphertext: wire.ciphertext,
    iv: wire.iv,
    authTag: wire.auth_tag,
    ephemeralPublicKey: wire.ephemeral_public_key,
  };
}

export function toWireBinding(binding: TransferBinding): TransferBindingWire {
  return {
    authorisation_id: binding.authorisationId,
    nonce: binding.nonce,
    purpose_code: binding.purposeCode,
    recipient_code: binding.recipientCode,
    principal_external_id: binding.principalExternalId,
  };
}

export function fromWireBinding(wire: TransferBindingWire): TransferBinding {
  return {
    authorisationId: wire.authorisation_id,
    nonce: wire.nonce,
    purposeCode: wire.purpose_code,
    recipientCode: wire.recipient_code,
    principalExternalId: wire.principal_external_id,
  };
}
