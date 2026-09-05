import type { NextRequest } from "next/server";
import {
  prisma,
  findRecipientByDeliveryKey,
  hashSecretKey,
  isDeliveryKeyFormat,
  isPublicKeyFormat,
  isSecretKeyFormat,
  isDashboardSessionTokenFormat,
  resolveDashboardSession,
} from "database";
import { jsonError, managementError } from "./cors";

/**
 * Request authentication for all three planes: ingestion (site public key),
 * management (organisation secret key) and delivery (recipient delivery key).
 * Each is prefix-checked before any database lookup, so no plane can be probed
 * with another plane's credential.
 *
 * Note on naming: the authenticated *caller* here is a security subject - a site
 * or an organisation. It is deliberately not called a "principal", because this
 * codebase reserves that word for the `Principal` model in the consent domain,
 * which is a person. Two different meanings of one word in the same route file
 * would be a trap.
 *
 * The single most important rule here: **the credential decides which tenant a
 * request acts on**. Nothing in a URL or request body is ever trusted to select
 * a site or an organisation. Routes receive a caller derived purely from the
 * presented key, and every subsequent lookup is scoped to it.
 */

export interface SiteCaller {
  siteId: string;
  organisationId: string;
  /** The registered domain, for the origin check in `lib/origin.ts`. */
  domain: string;
  /** Extra browser origins this site accepts, as full origins. */
  allowedOrigins: string[];
  /**
   * Purpose code that must resolve to `GRANTED` before this site's analytics
   * events are accepted. Null means the ingestion plane applies no consent gate.
   */
  analyticsConsentPurpose: string | null;
}

export interface OrganisationCaller {
  organisationId: string;
  name: string;
  slug: string;
  /**
   * The person behind the request, when one signed in.
   *
   * Null for an organisation key, which has no person attached — and saying so
   * with `null` rather than omitting the field keeps "a machine did this" and
   * "we did not record who" from looking identical.
   */
  userId: string | null;
}

/** A target fiduciary collecting sealed envelopes addressed to it. */
export interface RecipientCaller {
  recipientId: string;
  recipientCode: string;
  organisationId: string;
}

export type AuthResult<T> = { ok: true; caller: T } | { ok: false; response: Response };

/**
 * Reads the presented credential.
 *
 * Header only, on every plane. An earlier revision accepted the site public key
 * as a `?pk=` query parameter, because `navigator.sendBeacon` cannot set request
 * headers. The SDK now flushes with `fetch(..., { keepalive: true })`, which
 * survives unload *and* supports headers, so that workaround is gone: no
 * credential of any kind belongs in a URL, where it can reach access logs,
 * browser history and `Referer`.
 */
export function readBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

/**
 * Authenticates an ingestion request against a website public key.
 *
 * Returns 401 for a missing, malformed, wrong-plane or unknown key — the same
 * response in every case, so the endpoint cannot be used to test whether a given
 * key exists. Returns 403 only once the key is known-good but the site is off.
 */
export async function authenticateIngest(
  request: NextRequest,
): Promise<AuthResult<SiteCaller>> {
  const unauthorized = () =>
    jsonError("unauthorized", "A valid site public key is required.", [], 401);

  const token = readBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: jsonError(
        "unauthorized",
        "Missing credential. Send `Authorization: Bearer <public_key>`.",
        [],
        401,
      ),
    };
  }

  // An organisation secret must never authorise ingestion.
  if (!isPublicKeyFormat(token)) {
    return { ok: false, response: unauthorized() };
  }

  let website: {
    id: string;
    organisationId: string;
    isActive: boolean;
    domain: string;
    allowedOrigins: string[];
    analyticsConsentPurpose: string | null;
  } | null;
  try {
    website = await prisma.website.findUnique({
      where: { publicKey: token },
      select: {
        id: true,
        organisationId: true,
        isActive: true,
        domain: true,
        allowedOrigins: true,
        analyticsConsentPurpose: true,
      },
    });
  } catch (error) {
    // A database outage must not surface as an uncaught throw: Next's default
    // 500 carries no CORS headers, so a browser would see an opaque CORS
    // failure rather than a status the SDK can act on.
    console.error("[rift-cmp] failed to look up site credentials", error);
    return {
      ok: false,
      response: jsonError("ingest_failed", "Failed to verify site credentials.", [], 500),
    };
  }

  if (!website) {
    return { ok: false, response: unauthorized() };
  }

  if (!website.isActive) {
    return {
      ok: false,
      response: jsonError("forbidden", "This site is inactive and cannot accept events.", [], 403),
    };
  }

  return {
    ok: true,
    caller: {
      siteId: website.id,
      organisationId: website.organisationId,
      domain: website.domain,
      allowedOrigins: website.allowedOrigins,
      analyticsConsentPurpose: website.analyticsConsentPurpose,
    },
  };
}

/**
 * Authenticates a management request, by organisation key or by session.
 *
 * Two credentials are accepted and they mean different things:
 *
 *   **`sk_...`** — an organisation secret key. Machine to machine, no person
 *   attached, no expiry. This is what an integrator uses.
 *
 *   **`ds_...`** — a dashboard session, opened either by typing a key or by a
 *   user signing in with an email and password. It is revocable, expires, and
 *   goes stale when idle, none of which a key does.
 *
 * Both resolve to exactly one organisation, and every route downstream scopes on
 * that id, so tenant isolation is unchanged by adding the second one. What a
 * session adds is a person: `userId` is set when one signed in, which is what
 * makes an audit trail able to say who rather than only which organisation.
 *
 * A website public key is explicitly rejected here — `pk_` is designed to ship
 * in page source, and a browser-readable credential must never reach the plane
 * that can read another site's data.
 */
export async function authenticateManagement(
  request: NextRequest,
): Promise<AuthResult<OrganisationCaller>> {
  const unauthorized = () =>
    managementError(
      "unauthorized",
      "A valid organisation secret key or dashboard session is required.",
      [],
      401,
    );

  const token = readBearerToken(request);
  if (!token) return { ok: false, response: unauthorized() };

  if (isDashboardSessionTokenFormat(token)) {
    // `touch` advances the idle clock: a caller actively using the dashboard is
    // not idle, and without this a long working session would expire mid-task.
    const session = await resolveDashboardSession(prisma, token, { touch: true });
    if (!session) return { ok: false, response: unauthorized() };

    const organisation = await prisma.organisation.findUnique({
      where: { id: session.organisationId },
      select: { id: true, name: true, slug: true },
    });
    if (!organisation) return { ok: false, response: unauthorized() };

    return {
      ok: true,
      caller: {
        organisationId: organisation.id,
        name: organisation.name,
        slug: organisation.slug,
        userId: session.userId,
      },
    };
  }

  if (!isSecretKeyFormat(token)) {
    return { ok: false, response: unauthorized() };
  }

  const organisation = await prisma.organisation.findUnique({
    where: { secretKeyHash: hashSecretKey(token) },
    select: { id: true, name: true, slug: true },
  });

  if (!organisation) {
    return { ok: false, response: unauthorized() };
  }

  return {
    ok: true,
    caller: {
      organisationId: organisation.id,
      name: organisation.name,
      slug: organisation.slug,
      userId: null,
    },
  };
}

/**
 * Authenticates a delivery request against a recipient delivery key.
 *
 * This is the narrowest plane: it authorises collecting ciphertext addressed to
 * one recipient and nothing else. Critically, it grants no ability to *read*
 * that ciphertext - decryption needs the recipient's X25519 private key, which
 * Rift has never held.
 */
export async function authenticateDelivery(
  request: NextRequest,
): Promise<AuthResult<RecipientCaller>> {
  const unauthorized = () =>
    managementError("unauthorized", "A valid recipient delivery key is required.", [], 401);

  const token = readBearerToken(request);
  if (!token || !isDeliveryKeyFormat(token)) {
    return { ok: false, response: unauthorized() };
  }

  const recipient = await findRecipientByDeliveryKey(prisma, token);
  if (!recipient || !recipient.isActive) {
    return { ok: false, response: unauthorized() };
  }

  return {
    ok: true,
    caller: {
      recipientId: recipient.id,
      recipientCode: recipient.code,
      organisationId: recipient.organisationId,
    },
  };
}

/**
 * Resolves a site *within* the authenticated organisation.
 *
 * A site owned by another organisation returns 404 rather than 403: replying
 * "forbidden" would confirm the site exists, letting one tenant enumerate
 * another's site IDs. From the caller's perspective sites it does not own simply
 * do not exist.
 */
export async function findOwnedWebsite(organisationId: string, siteId: string) {
  return prisma.website.findFirst({
    where: { id: siteId, organisationId },
  });
}

export function siteNotFound(siteId: string): Response {
  return managementError("not_found", `No site found with id: ${siteId}.`, [], 404);
}
