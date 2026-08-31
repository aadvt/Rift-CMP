import type { NextRequest } from "next/server";
import {
  prisma,
  findRecipientByDeliveryKey,
  hashSecretKey,
  isDeliveryKeyFormat,
  isPublicKeyFormat,
  isSecretKeyFormat,
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
}

export interface OrganisationCaller {
  organisationId: string;
  name: string;
  slug: string;
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
 * `navigator.sendBeacon` cannot set request headers, so ingestion additionally
 * accepts the public key as a `?pk=` query parameter. That is acceptable only
 * because public keys are not secrets — the management plane never does this,
 * so an organisation secret can never end up in a URL, log or Referer header.
 */
function readBearerToken(request: NextRequest, allowQueryParam = false): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (token) return token;

  if (allowQueryParam) {
    const fromQuery = request.nextUrl.searchParams.get("pk")?.trim();
    if (fromQuery) return fromQuery;
  }

  return null;
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

  const token = readBearerToken(request, true);
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

  const website = await prisma.website.findUnique({
    where: { publicKey: token },
    select: { id: true, organisationId: true, isActive: true },
  });

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
    caller: { siteId: website.id, organisationId: website.organisationId },
  };
}

/**
 * Authenticates a management request against an organisation secret key.
 * A website public key is explicitly rejected here.
 */
export async function authenticateManagement(
  request: NextRequest,
): Promise<AuthResult<OrganisationCaller>> {
  const unauthorized = () =>
    managementError("unauthorized", "A valid organisation secret key is required.", [], 401);

  const token = readBearerToken(request, false);
  if (!token || !isSecretKeyFormat(token)) {
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
    caller: { organisationId: organisation.id, name: organisation.name, slug: organisation.slug },
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

  const token = readBearerToken(request, false);
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
