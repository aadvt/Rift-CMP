import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import {
  AUTH_TAG_BYTES,
  HKDF_INFO_LABEL,
  IV_BYTES,
  MAX_CIPHERTEXT_BYTES,
  type SealedEnvelope,
} from "./envelope";

/**
 * The fiduciary half of the secure transfer boundary — the only code that can
 * turn plaintext into an envelope or back again.
 *
 * **The Consent Manager must never import this module.** It belongs to the
 * source and target fiduciaries, which in this prototype are mock actors and in
 * a real deployment would be separate systems Rift has no access to. The
 * separation is enforced by a test, not by convention.
 *
 * The construction is textbook hybrid public-key encryption (the shape of ECIES
 * and libsodium's sealed boxes), assembled from `node:crypto`. Nothing here is
 * novel, which is the point: novel cryptography in a proof of concept would be a
 * liability, not a feature.
 */

export interface RecipientKeyPair {
  /** base64 SPKI. Safe to publish; this is what gets registered with Rift. */
  publicKey: string;
  /** base64 PKCS8. Must never leave the target fiduciary. */
  privateKey: string;
}

/**
 * Generates a target fiduciary's long-term X25519 key pair.
 *
 * Only the public half is ever sent to Rift. The private half is what makes the
 * target the sole party able to decrypt anything addressed to it.
 */
export function generateRecipientKeyPair(): RecipientKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  };
}

/**
 * Derives the per-transfer symmetric key from an ECDH shared secret.
 *
 * The raw ECDH output is not uniformly random and must never be used directly as
 * an AES key. HKDF fixes that. Both public keys are mixed into `info` so the
 * derived key is bound to this specific pair of parties: a shared secret
 * reproduced in another context yields a different key.
 */
function deriveKey(sharedSecret: Buffer, ephemeralPublicKey: Buffer, recipientPublicKey: Buffer): Buffer {
  const info = Buffer.concat([
    Buffer.from(HKDF_INFO_LABEL, "utf8"),
    ephemeralPublicKey,
    recipientPublicKey,
  ]);

  // Empty salt is the HKDF default and is appropriate here: the input is already
  // a high-entropy ECDH secret, not a low-entropy password.
  return Buffer.from(hkdfSync("sha256", sharedSecret, Buffer.alloc(0), info, 32));
}

/**
 * Seals a plaintext payload for one recipient. Run by the **source fiduciary**,
 * before anything is sent to Rift.
 *
 * A fresh ephemeral key pair is generated per call and its private half is
 * dropped when this function returns, so each transfer has an independent key:
 * compromising one reveals nothing about the others.
 *
 * `aad` binds the envelope to its routing metadata — see `buildTransferAad`.
 */
export function sealEnvelope(input: {
  plaintext: string | Buffer;
  recipientPublicKey: string;
  aad: Buffer;
}): SealedEnvelope {
  const plaintext = Buffer.isBuffer(input.plaintext)
    ? input.plaintext
    : Buffer.from(input.plaintext, "utf8");

  if (plaintext.length > MAX_CIPHERTEXT_BYTES) {
    throw new Error(`Payload exceeds ${MAX_CIPHERTEXT_BYTES} bytes.`);
  }

  const recipientKey = createPublicKey({
    key: Buffer.from(input.recipientPublicKey, "base64"),
    format: "der",
    type: "spki",
  });

  const ephemeral = generateKeyPairSync("x25519");
  const ephemeralPublicDer = ephemeral.publicKey.export({ type: "spki", format: "der" });
  const recipientPublicDer = recipientKey.export({ type: "spki", format: "der" });

  const sharedSecret = diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: recipientKey,
  });
  const key = deriveKey(sharedSecret, ephemeralPublicDer, recipientPublicDer);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(input.aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ephemeralPublicKey: ephemeralPublicDer.toString("base64"),
  };
}

/**
 * Opens a sealed envelope. Run by the **target fiduciary**, which is the only
 * party holding the private key this needs.
 *
 * Throws if the ciphertext, the AAD, or the recipient is wrong — AES-GCM's tag
 * check does not distinguish between them, and it must not: returning partial or
 * corrupted plaintext would be far worse than failing.
 */
export function openEnvelope(input: {
  envelope: SealedEnvelope;
  recipientPrivateKey: string;
  aad: Buffer;
}): Buffer {
  const privateKey = createPrivateKey({
    key: Buffer.from(input.recipientPrivateKey, "base64"),
    format: "der",
    type: "pkcs8",
  });

  const ephemeralPublicDer = Buffer.from(input.envelope.ephemeralPublicKey, "base64");
  const ephemeralPublicKey = createPublicKey({
    key: ephemeralPublicDer,
    format: "der",
    type: "spki",
  });

  const sharedSecret = diffieHellman({ privateKey, publicKey: ephemeralPublicKey });
  const recipientPublicDer = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const key = deriveKey(sharedSecret, ephemeralPublicDer, recipientPublicDer);

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(input.envelope.iv, "base64"),
    { authTagLength: AUTH_TAG_BYTES },
  );
  decipher.setAAD(input.aad);
  decipher.setAuthTag(Buffer.from(input.envelope.authTag, "base64"));

  // `final()` is where the tag is verified, so tampering surfaces here.
  return Buffer.concat([
    decipher.update(Buffer.from(input.envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
}
