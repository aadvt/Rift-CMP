import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  CONSENT_SESSION_MAX_DECISIONS,
  CONSENT_SESSION_PREFIX,
  CONSENT_SESSION_TTL_SECONDS,
  PRINCIPAL_SECRET_PREFIX,
} from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";

/**
 * Consent sessions: the thing a browser presents to prove that a decision it is
 * recording is its own.
 *
 * ## Why this exists
 *
 * Before Phase 6A, `POST /api/v1/consent` was authenticated with the site public
 * key alone. That key ships in page source, so "a caller holds it" carried no
 * information at all: anyone could record `GRANTED` for any
 * `principal_external_id` they could name, on any site, from anywhere. The
 * append-only decision log was therefore append-only *and* forgeable, which is
 * the worst combination - a permanent record of something that never happened.
 *
 * ## What a session actually proves
 *
 * A session is minted in one of exactly two ways:
 *
 *  - **A brand new principal.** The server mints both the identifier and a
 *    256-bit secret and hands them back once. Nothing is proven, and nothing
 *    needs to be: there is no earlier decision to hijack.
 *  - **An existing principal.** The caller must present that principal's secret,
 *    which was only ever returned to the browser that created it. Only its
 *    SHA-256 digest is stored, so a database dump does not yield it.
 *
 * So the property is: **a decision can only be recorded against a principal
 * whose secret the caller holds.** That is materially different from the old
 * position, and it is deliberately narrower than "a human clicked a button" -
 * see the limits in docs/security.md. Nothing here proves a human was involved,
 * and nothing can, from a browser.
 *
 * Sessions are short-lived and cap how many decisions they may record, which
 * bounds both replay of a stolen token and a runaway client.
 */

/** Digest used for every stored credential in this repo. */
function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests of equal length. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generateConsentSessionToken(): string {
  return `${CONSENT_SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function generatePrincipalSecret(): string {
  return `${PRINCIPAL_SECRET_PREFIX}${randomBytes(32).toString("hex")}`;
}

export function isConsentSessionTokenFormat(value: string): boolean {
  return value.startsWith(CONSENT_SESSION_PREFIX) && value.length > CONSENT_SESSION_PREFIX.length;
}

export function isPrincipalSecretFormat(value: string): boolean {
  return value.startsWith(PRINCIPAL_SECRET_PREFIX) && value.length > PRINCIPAL_SECRET_PREFIX.length;
}

export interface OpenConsentSessionInput {
  siteId: string;
  /** Omitted by a browser that has never had a principal on this site. */
  principalExternalId?: string | null;
  /** Required whenever `principalExternalId` is supplied. */
  principalSecret?: string | null;
  /** The browser's `Origin`, recorded for forensics only. */
  origin?: string | null;
  ttlSeconds?: number;
  maxDecisions?: number;
}

export interface OpenConsentSessionSuccess {
  ok: true;
  sessionToken: string;
  principalExternalId: string;
  /**
   * Present only when the secret was minted or bound by this call. A returning
   * browser already holds it, and we never re-send a credential unnecessarily.
   */
  principalSecret: string | null;
  expiresAt: Date;
  maxDecisions: number;
}

export type OpenConsentSessionResult =
  | OpenConsentSessionSuccess
  /**
   * One failure code for "unknown principal" and "wrong secret" alike, so the
   * endpoint cannot be used to test whether a principal id exists on a site.
   */
  | { ok: false; code: "unauthorized"; message: string };

/**
 * Mints a consent session, creating or authenticating the principal behind it.
 *
 * Trust-on-first-use applies to a principal whose `secretHash` is null - one
 * created before Phase 6A, by the seed script, or by a bulk import. The first
 * caller to present a secret for such a principal binds it. This is a real
 * weakness for pre-existing principals and is documented as one; the
 * alternative, refusing them outright, would lock every returning visitor out
 * of changing their own mind.
 */
export async function openConsentSession(
  prisma: PrismaClient,
  input: OpenConsentSessionInput,
): Promise<OpenConsentSessionResult> {
  const ttl = input.ttlSeconds ?? CONSENT_SESSION_TTL_SECONDS;
  const maxDecisions = input.maxDecisions ?? CONSENT_SESSION_MAX_DECISIONS;

  const claimedId = input.principalExternalId?.trim() || null;
  const claimedSecret = input.principalSecret?.trim() || null;

  let principalId: string;
  let principalExternalId: string;
  let mintedSecret: string | null = null;

  if (!claimedId) {
    // A brand new principal. The server mints the identifier so a client cannot
    // choose one that collides with, or squats on, somebody else's.
    principalExternalId = randomUUID();
    mintedSecret = generatePrincipalSecret();
    const created = await prisma.principal.create({
      data: {
        siteId: input.siteId,
        externalId: principalExternalId,
        kind: "anonymous",
        secretHash: digest(mintedSecret),
      },
      select: { id: true },
    });
    principalId = created.id;
  } else {
    // Shape-checked before the lookup, so obvious garbage costs no query — the
    // same order the credential planes use in `api/lib/auth.ts`.
    if (!claimedSecret || !isPrincipalSecretFormat(claimedSecret)) {
      return {
        ok: false,
        code: "unauthorized",
        message: "Principal could not be authenticated.",
      };
    }

    const existing = await prisma.principal.findUnique({
      where: { siteId_externalId: { siteId: input.siteId, externalId: claimedId } },
      select: { id: true, externalId: true, secretHash: true },
    });

    // Identical response for "no such principal" and "wrong secret".
    if (!existing) {
      return { ok: false, code: "unauthorized", message: "Principal could not be authenticated." };
    }

    if (existing.secretHash === null) {
      // Trust on first use: adopt the presented secret for a legacy principal.
      await prisma.principal.update({
        where: { id: existing.id },
        data: { secretHash: digest(claimedSecret) },
      });
    } else if (!digestsMatch(existing.secretHash, digest(claimedSecret))) {
      return { ok: false, code: "unauthorized", message: "Principal could not be authenticated." };
    }

    principalId = existing.id;
    principalExternalId = existing.externalId;
  }

  const sessionToken = generateConsentSessionToken();
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await prisma.consentSession.create({
    data: {
      siteId: input.siteId,
      principalId,
      tokenHash: digest(sessionToken),
      origin: input.origin ?? null,
      maxDecisions,
      expiresAt,
    },
  });

  return {
    ok: true,
    sessionToken,
    principalExternalId,
    principalSecret: mintedSecret,
    expiresAt,
    maxDecisions,
  };
}

export interface ResolvedConsentSession {
  sessionId: string;
  siteId: string;
  principalId: string;
  principalExternalId: string;
  decisionCount: number;
  maxDecisions: number;
  expiresAt: Date;
}

export type ResolveConsentSessionResult =
  | { ok: true; session: ResolvedConsentSession }
  | { ok: false; code: "invalid_session" | "session_expired" | "session_exhausted"; message: string };

/**
 * Resolves a presented token to a live session on the *authenticated* site.
 *
 * `siteId` is the site the request's public key resolved to, never a value from
 * the request body: a session minted on one site can therefore never be
 * presented on another, even within the same organisation.
 */
export async function resolveConsentSession(
  prisma: PrismaClient,
  input: { siteId: string; token: string },
): Promise<ResolveConsentSessionResult> {
  const invalid = {
    ok: false as const,
    code: "invalid_session" as const,
    message: "The consent session is not valid for this site.",
  };

  if (!isConsentSessionTokenFormat(input.token)) return invalid;

  const row = await prisma.consentSession.findUnique({
    where: { tokenHash: digest(input.token) },
    select: {
      id: true,
      siteId: true,
      principalId: true,
      decisionCount: true,
      maxDecisions: true,
      expiresAt: true,
      revokedAt: true,
      principal: { select: { externalId: true } },
    },
  });

  if (!row || row.siteId !== input.siteId || row.revokedAt !== null) return invalid;

  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, code: "session_expired", message: "The consent session has expired." };
  }

  if (row.decisionCount >= row.maxDecisions) {
    return {
      ok: false,
      code: "session_exhausted",
      message: "This consent session has recorded its maximum number of decisions.",
    };
  }

  return {
    ok: true,
    session: {
      sessionId: row.id,
      siteId: row.siteId,
      principalId: row.principalId,
      principalExternalId: row.principal.externalId,
      decisionCount: row.decisionCount,
      maxDecisions: row.maxDecisions,
      expiresAt: row.expiresAt,
    },
  };
}

/**
 * Charges one decision against a session.
 *
 * Conditional on the count the caller read, so two concurrent decisions cannot
 * both slip past the cap. Returns false when the session was already exhausted
 * or revoked between resolve and write.
 */
export async function consumeConsentSessionDecision(
  prisma: PrismaClient,
  input: { sessionId: string; expectedDecisionCount: number },
): Promise<boolean> {
  const { count } = await prisma.consentSession.updateMany({
    where: {
      id: input.sessionId,
      decisionCount: input.expectedDecisionCount,
      revokedAt: null,
    },
    data: { decisionCount: { increment: 1 } },
  });
  return count === 1;
}

/**
 * Deletes sessions that expired before `before`.
 *
 * Sessions are credentials, not history: nothing in the audit trail references
 * one, so removing an expired row destroys no evidence. There is no scheduler in
 * this MVP - see the limitation in docs/security.md.
 */
export async function purgeExpiredConsentSessions(
  prisma: PrismaClient,
  before: Date = new Date(),
): Promise<number> {
  const { count } = await prisma.consentSession.deleteMany({
    where: { expiresAt: { lt: before } },
  });
  return count;
}
