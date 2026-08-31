import type { ApiErrorCode, ApiErrorDetail, ApiErrorBody } from "@rift-cmp/shared";

/**
 * Ingestion is called by browsers on arbitrary customer domains, so it must be
 * open cross-origin. The management API is called server-to-server with a secret
 * key and has no browser use case, so it deliberately sends no CORS headers.
 */
export function setCorsHeaders(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

const DEFAULT_STATUS: Partial<Record<ApiErrorCode, number>> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
};

export function jsonError(
  code: ApiErrorCode,
  message: string,
  details: ApiErrorDetail[] = [],
  status: number = DEFAULT_STATUS[code] ?? 400,
  options: { cors?: boolean } = {},
): Response {
  const body: ApiErrorBody = { error: { code, message, details } };
  const response = Response.json(body, { status });
  return options.cors === false ? response : setCorsHeaders(response);
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
