import { headers } from "next/headers";
import { readSessionKey } from "./session";

/**
 * The dashboard's only route to data.
 *
 * Every page reads through the public platform API rather than touching the
 * database, so the dashboard is a consumer like any other integrator. That is
 * slightly slower than querying directly, and it is the point: if a screen needs
 * something the API cannot express, the API is what should change.
 *
 * Requests are made server-side with the organisation secret from the session
 * cookie, so the credential never reaches the browser.
 */

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

/**
 * The origin to call the platform API on.
 *
 * Exported so sign-in uses the same rule. They previously disagreed — sign-in
 * defaulted to `http` while this defaulted to `https` for any non-local host —
 * which behind a TLS proxy that does not set `x-forwarded-proto` would have made
 * sign-in call itself over http while every page call used https.
 */
export async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "127.0.0.1:3000";
  const forwarded = requestHeaders.get("x-forwarded-proto");
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const protocol = forwarded ?? (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const key = await readSessionKey();
  if (!key) {
    return { ok: false, status: 401, code: "unauthorized", message: "Not signed in." };
  }

  try {
    const response = await fetch(`${await requestOrigin()}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      // Dashboard data is operational and must not be served stale.
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string } }).error;
      return {
        ok: false,
        status: response.status,
        code: error?.code ?? "request_failed",
        message: error?.message ?? `Request failed with status ${response.status}.`,
      };
    }

    return { ok: true, data: body as T };
  } catch (error) {
    // A failed fetch here means the API is unreachable, which the dashboard
    // should say plainly rather than rendering an empty page as if there were
    // simply no data.
    console.error("[rift-cmp] dashboard API request failed", error);
    return {
      ok: false,
      status: 503,
      code: "api_unreachable",
      message: "The platform API could not be reached.",
    };
  }
}
