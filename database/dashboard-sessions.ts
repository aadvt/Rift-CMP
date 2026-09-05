import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { DASHBOARD_SESSION_PREFIX } from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";

/**
 * Operator sessions for the dashboard.
 *
 * ## What was wrong with the previous design
 *
 * The dashboard signed in with the organisation secret and put that secret,
 * verbatim, into an eight-hour cookie. It was `httpOnly` and `sameSite: strict`,
 * so page script could not read it and cross-site requests did not carry it —
 * but the cookie *was* the credential. Anything that ever obtained it held the
 * organisation for as long as it liked, and there was no way to revoke one
 * session short of rotating a secret the API has no endpoint to rotate.
 *
 * ## What replaces it
 *
 * The cookie now holds an opaque token, and the organisation secret is sealed at
 * rest with a key derived from that token. Three properties follow, and they are
 * the whole justification for the extra table:
 *
 *  1. **The cookie is no longer the credential.** On its own it opens nothing:
 *     the sealed secret lives in the database.
 *  2. **The database is no longer enough either.** A dump yields ciphertext and
 *     a SHA-256 digest. The key that opens it is derived from a token that was
 *     only ever sent to one browser, and is not stored anywhere.
 *  3. **Sessions are revocable.** Signing out deletes the row, and the token
 *     stops working immediately rather than at the cookie's expiry.
 *
 * ## What it is not
 *
 * It is not user accounts and it is not RBAC. There is still exactly one
 * operator credential per organisation, every session speaks for all of it, and
 * the audit trail still records what the organisation did rather than who did
 * it. That limitation is real and is documented in docs/security.md rather than
 * dressed up as solved.
 *
 * AES-256-GCM and HKDF-SHA256 from `node:crypto` are used exactly as intended:
 * a random 96-bit IV per seal, the tag stored beside the ciphertext, and no
 * novel construction anywhere.
 */

/** Absolute lifetime. Unchanged from the cookie it replaces. */
export const DASHBOARD_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Idle timeout: an abandoned session stops working long before it expires. */
export const DASHBOARD_SESSION_IDLE_SECONDS = 60 * 60;

const SEAL_INFO = Buffer.from("rift-cmp/dashboard-session/v1", "utf8");

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function generateDashboardSessionToken(): string {
  return `${DASHBOARD_SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/**
 * Derives the sealing key from the cookie token.
 *
 * The token is high-entropy random material, not a password, so HKDF is the
 * right primitive: there is no dictionary for a slow KDF to defend against, and
 * the only job here is to turn 256 bits of randomness into a distinct 256-bit
 * key that cannot be confused with the lookup digest.
 */
function sealingKey(token: string, salt: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(token, "utf8"), Buffer.from(salt, "utf8"), SEAL_INFO, 32),
  );
}

export interface SealedSecret {
  sealedSecret: string;
  sealIv: string;
  sealTag: string;
}

export function sealSecret(token: string, salt: string, secret: string): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealingKey(token, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    sealedSecret: ciphertext.toString("base64"),
    sealIv: iv.toString("base64"),
    sealTag: cipher.getAuthTag().toString("base64"),
  };
}

/** Returns null rather than throwing: a tampered row must read as "no session". */
export function openSecret(token: string, salt: string, sealed: SealedSecret): string | null {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      sealingKey(token, salt),
      Buffer.from(sealed.sealIv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(sealed.sealTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(sealed.sealedSecret, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

export function isDashboardSessionTokenFormat(value: string): boolean {
  return (
    value.startsWith(DASHBOARD_SESSION_PREFIX) && value.length > DASHBOARD_SESSION_PREFIX.length
  );
}

export interface CreatedDashboardSession {
  token: string;
  expiresAt: Date;
}

/**
 * Opens a session for an organisation whose secret has already been verified.
 *
 * The session id doubles as the HKDF salt, which is why the row is created in
 * two steps: the id has to exist before the secret can be sealed against it.
 */
export async function createDashboardSession(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    /**
     * Present when somebody typed an organisation key and it was verified. It
     * is sealed against the session id so later requests can recover it.
     *
     * Absent when a user signed in with an email and password: there is no
     * secret to seal, and the platform cannot produce one, because
     * `secret_key_hash` is a digest and the plaintext was shown once at
     * creation and never stored. Such a session still proves which organisation
     * the caller belongs to, which is what the management plane checks.
     */
    secretKey?: string;
    userId?: string;
    maxAgeSeconds?: number;
  },
): Promise<CreatedDashboardSession> {
  const token = generateDashboardSessionToken();
  const expiresAt = new Date(
    Date.now() + (input.maxAgeSeconds ?? DASHBOARD_SESSION_MAX_AGE_SECONDS) * 1000,
  );

  const placeholder = input.secretKey ? sealSecret(token, "pending", input.secretKey) : null;
  const row = await prisma.dashboardSession.create({
    data: {
      organisationId: input.organisationId,
      tokenHash: digest(token),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(placeholder
        ? {
            sealedSecret: placeholder.sealedSecret,
            sealIv: placeholder.sealIv,
            sealTag: placeholder.sealTag,
          }
        : {}),
      expiresAt,
    },
    select: { id: true },
  });

  if (input.secretKey) {
    const sealed = sealSecret(token, row.id, input.secretKey);
    await prisma.dashboardSession.update({ where: { id: row.id }, data: sealed });
  }

  return { token, expiresAt };
}

export interface ResolvedDashboardSession {
  sessionId: string;
  organisationId: string;
  userId: string | null;
  /** Null for a session opened by signing in, which seals no key. */
  secretKey: string | null;
}

/**
 * Resolves a cookie token back to the organisation secret, or null.
 *
 * Every failure — unknown token, revoked, expired, idle too long, ciphertext
 * that will not open — returns the same null. A dashboard has no reason to
 * distinguish them, and doing so would turn the cookie into an oracle.
 *
 * `touch` advances the idle clock. It is off for pure checks so that reading the
 * session in two places on one page render does not cost two writes.
 */
export async function resolveDashboardSession(
  prisma: PrismaClient,
  token: string,
  options: { touch?: boolean; idleSeconds?: number; now?: Date } = {},
): Promise<ResolvedDashboardSession | null> {
  if (!isDashboardSessionTokenFormat(token)) return null;

  const now = options.now ?? new Date();
  const idleSeconds = options.idleSeconds ?? DASHBOARD_SESSION_IDLE_SECONDS;

  const row = await prisma.dashboardSession.findUnique({
    where: { tokenHash: digest(token) },
    select: {
      id: true,
      organisationId: true,
      userId: true,
      sealedSecret: true,
      sealIv: true,
      sealTag: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!row || row.revokedAt !== null) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  if (now.getTime() - row.lastSeenAt.getTime() > idleSeconds * 1000) return null;

  // Nothing sealed means a user session, which is valid and simply carries no
  // key. Ciphertext that will not open is different: that is a tampered or
  // corrupt row, and it fails like every other failure here.
  let secretKey: string | null = null;
  if (row.sealedSecret !== null && row.sealIv !== null && row.sealTag !== null) {
    secretKey = openSecret(token, row.id, {
      sealedSecret: row.sealedSecret,
      sealIv: row.sealIv,
      sealTag: row.sealTag,
    });
    if (!secretKey) return null;
  }

  if (options.touch) {
    await prisma.dashboardSession.update({
      where: { id: row.id },
      data: { lastSeenAt: now },
    });
  }

  return {
    sessionId: row.id,
    organisationId: row.organisationId,
    userId: row.userId,
    secretKey,
  };
}

/** Signing out. Deleting rather than flagging: the row holds a sealed secret. */
export async function revokeDashboardSession(
  prisma: PrismaClient,
  token: string,
): Promise<boolean> {
  if (!isDashboardSessionTokenFormat(token)) return false;
  const { count } = await prisma.dashboardSession.deleteMany({
    where: { tokenHash: digest(token) },
  });
  return count > 0;
}

/** Revokes every session for an organisation. The nearest thing to a panic button. */
export async function revokeAllDashboardSessions(
  prisma: PrismaClient,
  organisationId: string,
): Promise<number> {
  const { count } = await prisma.dashboardSession.deleteMany({ where: { organisationId } });
  return count;
}

/** Removes sessions that can no longer be used. No scheduler calls this yet. */
export async function purgeExpiredDashboardSessions(
  prisma: PrismaClient,
  before: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.dashboardSession.deleteMany({
    where: { expiresAt: { lt: before } },
  });
  return count;
}
