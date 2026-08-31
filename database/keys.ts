import { createHash, randomBytes } from "node:crypto";
import { PUBLIC_KEY_PREFIX, SECRET_KEY_PREFIX } from "@rift-cmp/shared";

/**
 * Credential material for the two authentication planes.
 *
 * - Public keys (`pk_...`) identify a *website*. They ship inside browser code,
 *   so they are treated as public: stored in plaintext and readable by the
 *   owning organisation. They authorise event ingestion for one site only.
 *
 * - Secret keys (`sk_...`) identify an *organisation*. They are server-side
 *   credentials, shown once at creation and stored only as a SHA-256 digest.
 *   They authorise management of that organisation's websites.
 *
 * SHA-256 (rather than a password hash such as argon2) is the right choice here
 * because these are 256-bit random tokens, not user-chosen passwords: there is
 * no dictionary to attack, so a slow KDF would only add latency.
 */

export { PUBLIC_KEY_PREFIX, SECRET_KEY_PREFIX };

export function generatePublicKey(): string {
  return `${PUBLIC_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
}

export function generateSecretKey(): string {
  return `${SECRET_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
}

/** Digest used as the stored, indexed lookup value for a secret key. */
export function hashSecretKey(secretKey: string): string {
  return createHash("sha256").update(secretKey, "utf8").digest("hex");
}

export function isPublicKeyFormat(value: string): boolean {
  return value.startsWith(PUBLIC_KEY_PREFIX) && value.length > PUBLIC_KEY_PREFIX.length;
}

export function isSecretKeyFormat(value: string): boolean {
  return value.startsWith(SECRET_KEY_PREFIX) && value.length > SECRET_KEY_PREFIX.length;
}
