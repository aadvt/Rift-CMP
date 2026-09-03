/**
 * Origin validation for the browser-facing planes.
 *
 * ## What an `Origin` header is worth
 *
 * It is set by the browser and cannot be overridden by page script, so it is
 * genuine evidence about **which page made a cross-origin request from a
 * browser**. It is worth nothing at all against a caller that is not a browser:
 * `curl` simply omits it, and omitting it is indistinguishable from a legitimate
 * server-to-server call.
 *
 * So this check is **defence in depth and nothing more**. It raises the cost of
 * using a site's public key from an attacker-controlled *web page* — which is
 * the realistic abuse, because the key is sitting in page source — and it does
 * not, and cannot, prove that a consent decision was made by a human. The thing
 * that binds a decision to a browser is the principal secret and the consent
 * session in `database/consent-sessions.ts`. This is a second lock on the same
 * door, not the door.
 *
 * ## The rule
 *
 * - **No `Origin` header** → allowed. Server-to-server integrators, the SDK's
 *   own tests and every existing non-browser caller keep working.
 * - **An `Origin` header** → its hostname must match the site's registered
 *   `domain` (or a subdomain of it, or the `www.` form), or appear verbatim in
 *   the site's `allowed_origins`.
 * - **Loopback** (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`) → allowed
 *   outside production on any port, so local development is untouched. In
 *   production it must be listed explicitly like anything else.
 * - **`null`** — the opaque origin a sandboxed iframe or a `file://` page sends
 *   → refused. There is no site it could be checked against.
 */

export interface OriginPolicy {
  /** The site's registered domain. Bare hostname, no scheme. */
  domain: string;
  /** Extra full origins, e.g. `https://app.example.com`, `http://localhost:5173`. */
  allowedOrigins: readonly string[];
}

export interface OriginVerdict {
  allowed: boolean;
  /** The origin to echo in `Access-Control-Allow-Origin`, or null for `*`. */
  echo: string | null;
  reason: "absent" | "matched_domain" | "matched_allowlist" | "loopback" | "rejected";
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

function isLoopback(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

/** Lower-cased hostname of an origin string, or null if it is not a usable origin. */
function hostnameOf(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Normalises an origin for comparison: lower-cased scheme+host+port, no trailing slash. */
function normaliseOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Decides whether a request's `Origin` is acceptable for a site.
 *
 * `isProduction` is passed in rather than read from `process.env` so the rule is
 * a pure function and both branches are testable without mutating the
 * environment.
 */
export function evaluateOrigin(
  origin: string | null | undefined,
  policy: OriginPolicy,
  isProduction: boolean,
): OriginVerdict {
  if (origin === null || origin === undefined || origin.trim() === "") {
    return { allowed: true, echo: null, reason: "absent" };
  }

  const raw = origin.trim();

  // The literal string "null" is what a sandboxed iframe or a file:// page
  // sends. It names no site, so there is nothing to check it against.
  if (raw === "null") {
    return { allowed: false, echo: null, reason: "rejected" };
  }

  const normalised = normaliseOrigin(raw);
  const hostname = hostnameOf(raw);
  if (!normalised || !hostname) {
    return { allowed: false, echo: null, reason: "rejected" };
  }

  const allowlist = policy.allowedOrigins
    .map((entry) => normaliseOrigin(entry))
    .filter((entry): entry is string => entry !== null);

  if (allowlist.includes(normalised)) {
    return { allowed: true, echo: raw, reason: "matched_allowlist" };
  }

  const domain = policy.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (domain) {
    const bare = domain.replace(/^www\./, "");
    if (hostname === bare || hostname === `www.${bare}` || hostname.endsWith(`.${bare}`)) {
      return { allowed: true, echo: raw, reason: "matched_domain" };
    }
  }

  if (!isProduction && isLoopback(hostname)) {
    return { allowed: true, echo: raw, reason: "loopback" };
  }

  return { allowed: false, echo: null, reason: "rejected" };
}

/** Whether this process is running as a production deployment. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
