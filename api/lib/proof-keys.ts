import { createPublicKey, createPrivateKey } from "node:crypto";
import type { KeyRing, SigningKey, VerificationKey } from "@rift-cmp/shared/consent-signature";

/**
 * Signing keys, and the rules about where they are allowed to exist.
 *
 * ## Server-side, and nowhere else
 *
 * This module imports `node:crypto` and is reachable only from route handlers
 * and server-side libraries. It is not exported from `@rift-cmp/shared`'s barrel
 * — that barrel is bundled into the browser SDK — and nothing here is ever
 * returned by an API. The private key is read once from the environment, held in
 * memory, and used to sign; `activeSigningKey()` is the only function that
 * returns it, it is not called from any route, and no code path stringifies a
 * `SigningKey` into a response or a log line.
 *
 * The guard against accidental exposure is `assertNoPrivateMaterial`, which the
 * proof and verification routes run over their own response bodies before
 * sending them. A test that merely asserts "the route does not return the key"
 * passes for as long as nobody adds a field; a check on the body itself keeps
 * passing when somebody does.
 *
 * ## Rotation
 *
 * `RIFT_PROOF_KEY_ID` names the key that signs new proofs. Every key that has
 * ever signed stays in `RIFT_PROOF_PUBLIC_KEYS` so historical proofs remain
 * verifiable — a proof made in March under `k1` must still verify in June under
 * `k2`, and dropping `k1` would silently convert every March proof from "valid"
 * to "unknown key". Rotation is therefore: generate a new pair, append the new
 * public key to the ring, point `RIFT_PROOF_KEY_ID` at it, and leave the old
 * entry alone.
 *
 * Revocation is a third state and not a deletion. A revoked key's entry stays,
 * marked, so verification reports "signature genuine, key revoked" rather than
 * "unknown key" — different facts, and an auditor needs to tell them apart.
 *
 * ## Unconfigured is a supported state
 *
 * With no key set, proofs are still issued and still carry integrity and chain
 * links; they simply say `signature: null`, and every surface reports them as
 * unsigned. Refusing to record a consent decision because an optional hardening
 * feature was not configured would make it load-bearing for the product's core
 * function, which is the wrong trade in both directions.
 */

export interface KeyConfigProblem {
  variable: string;
  message: string;
}

interface LoadedKeys {
  signing: SigningKey | null;
  ring: KeyRing;
  problems: KeyConfigProblem[];
}

let cached: LoadedKeys | null = null;

/**
 * PEM, possibly base64-wrapped.
 *
 * A PKCS#8 PEM has newlines, and newlines do not survive most secret managers
 * and every `.env` file, so an operator who pastes one gets a key that fails to
 * parse with no useful error. Accepting base64 of the PEM removes that whole
 * class of support ticket.
 */
function readPem(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("-----BEGIN")) return value.replace(/\\n/g, "\n");
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return decoded.includes("-----BEGIN") ? decoded : null;
  } catch {
    return null;
  }
}

function load(): LoadedKeys {
  const problems: KeyConfigProblem[] = [];
  const keys: VerificationKey[] = [];

  const rawRing = process.env.RIFT_PROOF_PUBLIC_KEYS?.trim();
  if (rawRing) {
    try {
      const parsed: unknown = JSON.parse(rawRing);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      for (const entry of parsed as Array<Record<string, unknown>>) {
        const keyId = typeof entry.keyId === "string" ? entry.keyId : null;
        const pem = typeof entry.publicKey === "string" ? readPem(entry.publicKey) : null;
        if (!keyId || !pem) {
          problems.push({
            variable: "RIFT_PROOF_PUBLIC_KEYS",
            message: "An entry is missing a keyId or a readable publicKey.",
          });
          continue;
        }
        try {
          createPublicKey(pem);
        } catch {
          problems.push({
            variable: "RIFT_PROOF_PUBLIC_KEYS",
            message: `The public key for "${keyId}" could not be parsed.`,
          });
          continue;
        }
        keys.push({
          keyId,
          publicKeyPem: pem,
          ...(entry.revoked === true ? { revoked: true } : {}),
        });
      }
    } catch {
      problems.push({
        variable: "RIFT_PROOF_PUBLIC_KEYS",
        message: "Not valid JSON. Expected an array of { keyId, publicKey, revoked? }.",
      });
    }
  }

  let signing: SigningKey | null = null;
  const rawPrivate = process.env.RIFT_PROOF_SIGNING_KEY?.trim();
  const activeKeyId = process.env.RIFT_PROOF_KEY_ID?.trim() || null;

  if (rawPrivate) {
    const pem = readPem(rawPrivate);
    if (!pem) {
      problems.push({
        variable: "RIFT_PROOF_SIGNING_KEY",
        message: "Not a PEM, and not base64 of one.",
      });
    } else if (!activeKeyId) {
      problems.push({
        variable: "RIFT_PROOF_KEY_ID",
        // Without an id, a proof cannot say which key made it, and rotation
        // becomes impossible after the fact.
        message: "A signing key was supplied with no key id, so nothing can be rotated later.",
      });
    } else {
      try {
        const privateKey = createPrivateKey(pem);
        if (privateKey.asymmetricKeyType !== "ed25519") {
          problems.push({
            variable: "RIFT_PROOF_SIGNING_KEY",
            message: `Expected an Ed25519 key, found ${privateKey.asymmetricKeyType ?? "an unknown type"}.`,
          });
        } else {
          signing = { keyId: activeKeyId, privateKeyPem: pem };

          // Derive and add the matching public key when the ring does not carry
          // it. Otherwise the very first deployment signs proofs it cannot
          // verify, which looks exactly like tampering.
          if (!keys.some((k) => k.keyId === activeKeyId)) {
            keys.push({
              keyId: activeKeyId,
              publicKeyPem: createPublicKey(privateKey)
                .export({ type: "spki", format: "pem" })
                .toString(),
            });
          }
        }
      } catch {
        problems.push({
          variable: "RIFT_PROOF_SIGNING_KEY",
          message: "The private key could not be parsed.",
        });
      }
    }
  }

  if (activeKeyId && keys.some((k) => k.keyId === activeKeyId && k.revoked)) {
    problems.push({
      variable: "RIFT_PROOF_KEY_ID",
      message: `"${activeKeyId}" is marked revoked and must not sign new proofs.`,
    });
    signing = null;
  }

  return { signing, ring: { activeKeyId, keys }, problems };
}

function keys(): LoadedKeys {
  cached ??= load();
  return cached;
}

/** Drops the cache. For tests that set the environment between cases. */
export function resetProofKeys(): void {
  cached = null;
}

/**
 * The key that signs new proofs, or null when none is configured.
 *
 * Returns private material. Call it from the signing path and from nowhere
 * else — in particular, never from a route that builds a response.
 */
export function activeSigningKey(): SigningKey | null {
  return keys().signing;
}

/** Public keys only. Safe to hand to anything, including a verification API. */
export function verificationKeyRing(): KeyRing {
  return keys().ring;
}

/** Configuration problems, for an operator-facing status surface. */
export function proofKeyProblems(): KeyConfigProblem[] {
  return keys().problems;
}

/** What a status endpoint may say about the keys. No key material of any kind. */
export interface ProofKeyStatus {
  signing_configured: boolean;
  active_key_id: string | null;
  /** Every key id that can still be verified against, and whether it is revoked. */
  known_keys: Array<{ key_id: string; active: boolean; revoked: boolean }>;
  problems: KeyConfigProblem[];
}

export function proofKeyStatus(): ProofKeyStatus {
  const { signing, ring, problems } = keys();
  return {
    signing_configured: signing !== null,
    active_key_id: ring.activeKeyId,
    known_keys: ring.keys.map((k) => ({
      key_id: k.keyId,
      active: k.keyId === ring.activeKeyId,
      revoked: k.revoked === true,
    })),
    problems,
  };
}

/**
 * Throw if a response body contains private key material.
 *
 * A belt-and-braces check run by the routes that serve proofs. The failure it
 * catches — somebody widening a `select`, or spreading a config object into a
 * response — is the kind that no reviewer notices and no unit test written
 * against today's fields would catch either.
 */
export function assertNoPrivateMaterial(body: unknown): void {
  const serialised = JSON.stringify(body ?? null);
  if (!serialised) return;
  for (const marker of ["BEGIN PRIVATE KEY", "BEGIN EC PRIVATE KEY", "BEGIN RSA PRIVATE KEY", "privateKeyPem"]) {
    if (serialised.includes(marker)) {
      throw new Error("[rift-cmp] refusing to serve a response containing private key material");
    }
  }
}
