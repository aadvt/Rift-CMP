import type { ApiErrorCode, ApiErrorDetail, ApiErrorBody } from "@rift-cmp/shared";

/**
 * Ingestion is called by browsers on arbitrary customer domains, so it must be
 * open cross-origin. The management API is called server-to-server with a secret
 * key and has no browser use case, so it deliberately sends no CORS headers.
 *
 * Phase 6A added one refinement: once a request has been authenticated and its
 * `Origin` checked against the site's configuration, the response echoes that
 * exact origin instead of `*`. `*` remains the answer for preflights and for
 * unauthenticated failures, because at that point there is no site to check the
 * origin against — a browser sends no `Authorization` header on an `OPTIONS`
 * preflight, so the site is genuinely unknown there.
 *
 * Note that CORS is a browser policy, not an access control. It governs whether
 * a *page* may read our response; it stops nothing that is not a browser. The
 * access control is the credential, and — for consent — the session.
 */
export function setCorsHeaders(response: Response, allowOrigin: string | null = null): Response {
  response.headers.set("Access-Control-Allow-Origin", allowOrigin ?? "*");
  if (allowOrigin) {
    // Without this a shared cache could serve one origin's response to another.
    response.headers.append("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-Rift-Consent-Session",
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

const DEFAULT_STATUS: Partial<Record<ApiErrorCode, number>> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  consent_session_required: 401,
  invalid_session: 401,
  session_expired: 401,
  session_exhausted: 429,
  principal_mismatch: 403,
  consent_required: 403,
  origin_not_allowed: 403,
  rate_limited: 429,
  payload_too_large: 413,
};

export function jsonError(
  code: ApiErrorCode,
  message: string,
  details: ApiErrorDetail[] = [],
  status: number = DEFAULT_STATUS[code] ?? 400,
  options: { cors?: boolean; allowOrigin?: string | null } = {},
): Response {
  const body: ApiErrorBody = { error: { code, message, details } };
  const response = Response.json(body, { status });
  return options.cors === false
    ? response
    : setCorsHeaders(response, options.allowOrigin ?? null);
}

/** Error response for the management plane (no CORS headers). */
export function managementError(
  code: ApiErrorCode,
  message: string,
  details: ApiErrorDetail[] = [],
  status?: number,
): Response {
  return jsonError(code, message, details, status ?? DEFAULT_STATUS[code] ?? 400, { cors: false });
}
