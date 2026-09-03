import type { NextRequest } from "next/server";
import { prisma, getEffectiveConsent, resolveConsentSession } from "database";
import type { ResolvedConsentSession } from "database";
import { CONSENT_SESSION_HEADER, isPurposeGranted } from "@rift-cmp/shared";
import { authenticateIngest, type SiteCaller } from "./auth";
import { jsonError } from "./cors";
import { evaluateOrigin, isProductionRuntime } from "./origin";
import {
  RATE_LIMITS,
  clientAddress,
  enforceRateLimit,
  type RateLimitName,
} from "./rate-limit";

/**
 * The shared front door of every browser-facing route.
 *
 * All five of them — events, consent read, consent write, consent session and
 * discovery — need the same four things to happen in the same order, and the
 * order is the security property:
 *
 *   1. **Rate limit by client address, before authentication.** Otherwise an
 *      unauthenticated flood makes the database do a credential lookup per
 *      request, and the limiter protects nothing that matters.
 *   2. **Authenticate the site public key.** The credential decides the tenant;
 *      nothing in the URL or body ever does.
 *   3. **Rate limit per site.** Now that the site is known, the tighter,
 *      meaningful limits apply.
 *   4. **Check the `Origin`.** Defence in depth only — see `lib/origin.ts`.
 *
 * Routes get back a caller plus the origin to echo, or a finished response.
 */

export interface GuardedIngest {
  caller: SiteCaller;
  /** Origin to echo in CORS headers, or null to send `*`. */
  allowOrigin: string | null;
}

export type IngestGuardResult =
  | { ok: true; guarded: GuardedIngest }
  | { ok: false; response: Response };

export async function guardIngest(
  request: NextRequest,
  options: { limit: RateLimitName; siteCeiling?: RateLimitName; route: string },
): Promise<IngestGuardResult> {
  const address = clientAddress(request);

  const preAuth = enforceRateLimit(
    `pre:${options.route}:${address}`,
    RATE_LIMITS.unauthenticated,
    (retryAfter) =>
      jsonError(
        "rate_limited",
        `Too many requests. Retry after ${retryAfter}s.`,
        [],
        429,
      ),
  );
  if (preAuth) return { ok: false, response: preAuth };

  const auth = await authenticateIngest(request);
  if (!auth.ok) return { ok: false, response: auth.response };
  const caller = auth.caller;

  const perSite = enforceRateLimit(
    `${options.route}:${caller.siteId}:${address}`,
    RATE_LIMITS[options.limit],
    (retryAfter) =>
      jsonError("rate_limited", `Too many requests. Retry after ${retryAfter}s.`, [], 429),
  );
  if (perSite) return { ok: false, response: perSite };

  if (options.siteCeiling) {
    const ceiling = enforceRateLimit(
      `${options.route}:site:${caller.siteId}`,
      RATE_LIMITS[options.siteCeiling],
      (retryAfter) =>
        jsonError("rate_limited", `Too many requests. Retry after ${retryAfter}s.`, [], 429),
    );
    if (ceiling) return { ok: false, response: ceiling };
  }

  const origin = evaluateOrigin(
    request.headers.get("origin"),
    { domain: caller.domain, allowedOrigins: caller.allowedOrigins },
    isProductionRuntime(),
  );

  if (!origin.allowed) {
    return {
      ok: false,
      response: jsonError(
        "origin_not_allowed",
        "This site does not accept requests from that origin.",
        [],
        403,
      ),
    };
  }

  return { ok: true, guarded: { caller, allowOrigin: origin.echo } };
}

/** Reads the consent session token a browser presents, if any. */
export function readConsentSessionToken(request: NextRequest): string | null {
  return request.headers.get(CONSENT_SESSION_HEADER)?.trim() || null;
}

export type ConsentSessionGuard =
  | { ok: true; session: ResolvedConsentSession }
  | { ok: false; response: Response };

/**
 * Resolves the presented consent session, scoped to the authenticated site.
 *
 * A session minted on one site is invalid on every other, including sites in the
 * same organisation, because `siteId` here always comes from the credential.
 */
export async function requireConsentSession(
  request: NextRequest,
  caller: SiteCaller,
  allowOrigin: string | null,
): Promise<ConsentSessionGuard> {
  const token = readConsentSessionToken(request);
  if (!token) {
    return {
      ok: false,
      response: jsonError(
        "consent_session_required",
        `A consent session is required. Open one with POST /api/v1/consent/session and send it as \`${CONSENT_SESSION_HEADER}\`.`,
        [],
        401,
        { allowOrigin },
      ),
    };
  }

  const resolved = await resolveConsentSession(prisma, { siteId: caller.siteId, token });
  if (!resolved.ok) {
    return {
      ok: false,
      response: jsonError(resolved.code, resolved.message, [], undefined, { allowOrigin }),
    };
  }

  return { ok: true, session: resolved.session };
}

/**
 * Server-side consent enforcement for analytics ingestion.
 *
 * The SDK can gate events client-side, and a browser is not a place to enforce
 * anything: an attacker holding the site's public key — which is everyone —
 * simply does not run the gate. So when a site declares
 * `analytics_consent_purpose`, the ingestion plane requires the request to prove
 * the decision, and it proves it by re-deriving the effective consent from the
 * append-only log rather than by believing anything the client said.
 *
 * Two properties are worth being explicit about:
 *
 *  - **The token is not the evidence; the log is.** A valid session only names
 *    a principal. Whether that principal currently permits the purpose is read
 *    from `consent_records` on every batch, so a withdrawal takes effect on the
 *    next request rather than when a cached token happens to expire.
 *  - **Nothing is persisted.** The principal is resolved in-request to answer
 *    "may these events be stored", and is never written onto a session or event
 *    row. The rule that analytics carries no consent state and no principal
 *    identifier is intact — see docs/mvp.md.
 *
 * Sites that have not set `analytics_consent_purpose` are unaffected, which is
 * every site that existed before Phase 6A.
 */
export async function enforceAnalyticsConsent(
  request: NextRequest,
  caller: SiteCaller,
  allowOrigin: string | null,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const purposeCode = caller.analyticsConsentPurpose;
  if (!purposeCode) return { ok: true };

  const session = await requireConsentSession(request, caller, allowOrigin);
  if (!session.ok) return { ok: false, response: session.response };

  const state = await getEffectiveConsent(prisma, {
    siteId: caller.siteId,
    principalExternalId: session.session.principalExternalId,
  });

  if (!isPurposeGranted(state?.effective ?? [], purposeCode)) {
    return {
      ok: false,
      response: jsonError(
        "consent_required",
        `This site requires consent for "${purposeCode}" before analytics events are accepted.`,
        [],
        403,
        { allowOrigin },
      ),
    };
  }

  return { ok: true };
}
