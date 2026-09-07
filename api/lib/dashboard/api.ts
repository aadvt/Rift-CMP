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
 * The origin to call the platform API on, and the origin customers are told to
 * load the SDK from.
 *
 * Exported so sign-in uses the same rule. They previously disagreed — sign-in
 * defaulted to `http` while this defaulted to `https` for any non-local host —
 * which behind a TLS proxy that does not set `x-forwarded-proto` would have made
 * sign-in call itself over http while every page call used https.
 *
 * ## Why this is not a detail
 *
 * `/sites/{id}/install` builds `script_url` and `api_origin` from this. That is
 * the `<script src>` an operator pastes into their own site, so a wrong answer
 * here does not degrade a screen — it hands a paying customer a tag that cannot
 * load, and the failure surfaces on their site rather than in this product.
 *
 * It was wrong. `https` was assumed for every non-local host whether or not
 * anything was listening on 443, which is exactly the deployment this ran in:
 * plain HTTP on :3000, snippets pointing at an `https://` origin that refused
 * every connection.
 *
 * ## So the scheme is configured, not guessed
 *
 * `RIFT_PUBLIC_ORIGIN` is the authoritative answer and a deployment serving
 * real customers should set it. It is the full origin — scheme, host and port —
 * because those three travel together: a deployment behind a proxy on 443 has a
 * different host *and* a different port from the container's own, and deriving
 * two of them from a request while taking the third from configuration is how
 * the halves drift apart.
 *
 * Everything below it is fallback for development and for deployments that have
 * not set it:
 *
 *   `x-forwarded-proto`, which any competent TLS terminator sets. Trusted only
 *   because this app is never exposed directly — but note that a client can
 *   forge it when it is, which is the other reason to prefer the env var.
 *
 *   `http` for localhost and loopback, where there is never TLS.
 *
 *   `https` otherwise, kept as the last resort because a public deployment
 *   without TLS is the rarer and more alarming case of the two. It is a guess,
 *   and the point of `RIFT_PUBLIC_ORIGIN` is that nobody serving customers
 *   should be relying on it.
 */
export function configuredPublicOrigin(): string | null {
  const configured = process.env.RIFT_PUBLIC_ORIGIN?.trim();
  if (!configured) return null;

  try {
    // Parsed rather than string-trimmed so a malformed value fails here, at
    // startup of the first request, instead of being pasted into a customer's
    // site as a broken URL.
    const url = new URL(configured);
    return url.origin;
  } catch {
    return null;
  }
}

export async function requestOrigin(): Promise<string> {
  const configured = configuredPublicOrigin();
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "127.0.0.1:3000";
  const forwarded = requestHeaders.get("x-forwarded-proto");
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const protocol = forwarded ?? (isLocal ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Writes through the same public API the dashboard reads from.
 *
 * The dashboard has been read-only until now, which meant every write — adding
 * a site, starting a scan, declaring a purpose — was a `curl` an operator had to
 * assemble by hand. Those flows go through here rather than touching the
 * database, for the same reason the reads do: if a screen needs something the
 * API cannot express, the API is what should change.
 *
 * The organisation secret is read from the session server-side and never
 * reaches the browser.
 */
export async function apiSend<T>(
  path: string,
  options: { method: "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<ApiResult<T>> {
  const key = await readSessionKey();
  if (!key) {
    return { ok: false, status: 401, code: "unauthorized", message: "Not signed in." };
  }

  try {
    const response = await fetch(`${await requestOrigin()}${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string } }).error;
      return {
        ok: false,
        status: response.status,
        // The API's `code` is the stable part of an error; the message is for
        // humans. Both are carried so a form can show one and branch on the other.
        code: error?.code ?? "request_failed",
        message: error?.message ?? `Request failed with status ${response.status}.`,
      };
    }

    return { ok: true, data: body as T };
  } catch (error) {
    console.error("[rift-cmp] dashboard API write failed", error);
    return {
      ok: false,
      status: 503,
      code: "api_unreachable",
      message: "The platform API could not be reached.",
    };
  }
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
