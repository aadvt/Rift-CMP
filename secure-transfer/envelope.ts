import { createHash } from "node:crypto";

/**
 * The Rift-safe half of the secure transfer boundary.
 *
 * This module describes the *shape* of a sealed envelope and how to derive the
 * data that is authenticated alongside it. It contains no key generation, no
 * encryption and no decryption — those live in `./fiduciary`, which the Consent
 * Manager deliberately does not import.
 *
 * The split is structural on purpose. Rift not decrypting payloads should not
 * depend on anyone remembering not to call a function; the function is not in
 * Rift's dependency graph at all. `api/tests/transfer-boundary.test.ts` asserts
 * this and fails the build if it ever stops being true.
 */

/**
 * The construction identifier, stored on every recipient.
 *
 * Recorded per recipient rather than assumed globally so the scheme can be
 * changed later without guessing how existing envelopes were sealed.
 */
export const TRANSFER_ALGORITHM = "X25519-HKDF-SHA256-AES256GCM";

/** Domain separation label mixed into key derivation. */
export const HKDF_INFO_LABEL = "rift-cmp/secure-transfer/v1";

/** AES-GCM standard nonce length, in bytes. */
export const IV_BYTES = 12;

/** AES-GCM authentication tag length, in bytes. */
export const AUTH_TAG_BYTES = 16;

/** X25519 keys are 32 bytes raw; SPKI/PKCS8 wrapping makes them a little longer. */
export const MAX_KEY_BASE64_LENGTH = 256;

/**
 * Upper bound on a single payload. A proof of concept relays envelopes through
 * the database, so an unbounded body would be a trivial denial of service.
 */
export const MAX_CIPHERTEXT_BYTES = 256 * 1024;

/**
 * A sealed payload. Every field is opaque to Rift.
 *
 * `ephemeralPublicKey` is the sender's one-time public key. Together with the
 * recipient's *private* key it reproduces the shared secret — which is precisely
 * why Rift, holding only public keys, cannot.
 */
export interface SealedEnvelope {
  /** base64 AES-256-GCM ciphertext. */
  ciphertext: string;
  /** base64 96-bit nonce. */
  iv: string;
  /** base64 128-bit GCM authentication tag. */
  authTag: string;
  /** base64 SPKI-encoded ephemeral X25519 public key. */
  ephemeralPublicKey: string;
}

/**
 * The routing facts an envelope is cryptographically bound to.
 *
 * Every field here is metadata Rift already holds, so both the sender and the
 * receiver can rebuild the AAD independently — no extra channel needed.
 */
export interface TransferBinding {
  authorisationId: string;
  nonce: string;
  purposeCode: string;
  recipientCode: string;
  principalExternalId: string;
}

/**
 * Builds the additional authenticated data for a transfer.
 *
 * AAD is authenticated but not encrypted: it does not hide the routing metadata,
 * it makes it impossible to change without invalidating the envelope. Replaying
 * a valid ciphertext under a different authorisation, purpose or recipient
 * changes this string, so the GCM tag check fails.
 *
 * Field order is fixed rather than derived from object key order, because the
 * sender and receiver must produce byte-identical input.
 */
export function buildTransferAad(binding: TransferBinding): Buffer {
  const canonical = JSON.stringify([
    "rift-cmp/transfer/v1",
    binding.authorisationId,
    binding.nonce,
    binding.purposeCode,
    binding.recipientCode,
    binding.principalExternalId,
  ]);
  return Buffer.from(canonical, "utf8");
}

/**
 * SHA-256 of the ciphertext, so Rift can prove an envelope was not altered in
 * storage without being able to read it.
 */
export function envelopeDigest(envelope: SealedEnvelope): string {
  return createHash("sha256").update(Buffer.from(envelope.ciphertext, "base64")).digest("hex");
}

/** Size of the ciphertext in bytes, for accounting and limit checks. */
export function ciphertextBytes(envelope: SealedEnvelope): number {
  return Buffer.from(envelope.ciphertext, "base64").length;
}

function isBase64OfLength(value: unknown, bytes: number): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    return Buffer.from(value, "base64").length === bytes;
  } catch {
    return false;
  }
}

/**
 * Structural validation only.
 *
 * This says an envelope is the right shape, never that it is authentic — only
 * the recipient's private key can establish that. Rift checks shape so it can
 * reject malformed input early; it cannot check meaning.
 */
export function isSealedEnvelope(value: unknown): value is SealedEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SealedEnvelope>;

  return (
    typeof candidate.ciphertext === "string" &&
    candidate.ciphertext.length > 0 &&
    isBase64OfLength(candidate.iv, IV_BYTES) &&
    isBase64OfLength(candidate.authTag, AUTH_TAG_BYTES) &&
    typeof candidate.ephemeralPublicKey === "string" &&
    candidate.ephemeralPublicKey.length > 0 &&
    candidate.ephemeralPublicKey.length <= MAX_KEY_BASE64_LENGTH
  );
}
