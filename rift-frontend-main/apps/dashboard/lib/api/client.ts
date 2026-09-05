import 'server-only';
import type { RiftError } from './errors';
import { riftError } from './errors';
import { redirect } from 'next/navigation';
import { clearSessionToken, readSessionToken } from '../auth/session';

/**
 * The one place the frontend talks to the Rift API.
 *
 * Server-only by design: the access token never reaches the browser, and site
 * scoping is attached per request on the server. Client components reach the
 * API through the `/api/rift/*` proxy in `app/api/rift/[...path]/route.ts`,
 * which calls straight back into this module.
 */

export const API_URL = process.env.RIFT_API_URL?.replace(/\/$/, '') ?? '';
export const USE_FIXTURES = !API_URL || process.env.RIFT_USE_FIXTURES === 'true';

const TIMEOUT = Number(process.env.RIFT_API_TIMEOUT ?? 15_000);

export interface RiftFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Cache tags so a mutation can `revalidateTag` the reads it invalidates. */
  tags?: string[];
  /** Seconds. Omit for the default (no store on mutations, cached on GET). */
  revalidate?: number | false;
}

export async function riftFetch<T>(path: string, options: RiftFetchOptions = {}): Promise<T> {
  if (USE_FIXTURES) {
    throw riftError('fixtures_only', 'RIFT_API_URL is not set — this call should have been served from fixtures.', 500);
  }

  const { body, tags, revalidate, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(await authHeaders()),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      next: {
        ...(tags ? { tags } : {}),
        ...(revalidate !== undefined ? { revalidate: revalidate === false ? 0 : revalidate } : {}),
      },
    });

    /**
     * An expired session is not an error to show somebody.
     *
     * Sessions lapse — eight hours at most, one idle — and every read on every
     * screen then fails with a 401. Left to propagate, the first one throws and
     * the person gets "a server-side exception has occurred" with a digest,
     * which says nothing, offers nothing to do, and is indistinguishable from
     * the product being broken.
     *
     * The honest response to "your session is no longer valid" is to stop
     * treating them as signed in and ask them to sign in. The cookie is cleared
     * first so the middleware does not bounce them straight back here with the
     * same dead token.
     *
     * Only when a session was actually presented: a 401 with no cookie is the
     * API rejecting something else, and redirecting would hide that.
     */
    if (res.status === 401 && (await readSessionToken().catch(() => null))) {
      // Deleting a cookie is not permitted while rendering a page, so this is
      // best-effort and the marker below is what actually breaks the loop:
      // /signin sends anyone holding a cookie to /dashboard, which would fail
      // the same way and come straight back.
      await clearSessionToken().catch(() => {});
      redirect('/signin?expired=1');
    }

    if (!res.ok) {
      const payload = await safeJson(res);
      throw riftError(
        typeof payload?.code === 'string' ? payload.code : 'upstream_error',
        typeof payload?.message === 'string' ? payload.message : `Rift API responded ${res.status}.`,
        res.status,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw riftError('timeout', `The Rift API did not respond within ${TIMEOUT / 1000}s.`, 504);
    }
    if (isRiftError(err)) throw err;
    // Next signals dynamic rendering and navigation by throwing. Wrapping one of
    // those in a "could not reach the API" would replace a precise framework
    // message with a misleading one, and send whoever hits it looking at the
    // network instead of at the route.
    if (isFrameworkSignal(err)) throw err;
    throw riftError('network_error', 'Could not reach the Rift API.', 502, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Swap this for your session lookup once auth is wired. During development
 * a static token from the environment is enough to talk to a backend.
 */
/**
 * The credential for this request.
 *
 * A signed-in session comes first: it is per-person, revocable and expires, and
 * it is what the audit trail can attribute an action to. `RIFT_API_TOKEN` is the
 * fallback for a deployment that has no user accounts yet and for local work
 * against a fixed organisation key.
 *
 * The order matters. Preferring the env key would mean signing out changed
 * nothing, because every request would keep using the shared credential
 * underneath.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const session = await readSessionToken().catch(() => null);
  if (session) return { Authorization: `Bearer ${session}` };

  const token = process.env.RIFT_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try { return (await res.json()) as Record<string, unknown>; } catch { return null; }
}

function isRiftError(e: unknown): e is RiftError {
  return typeof e === 'object' && e !== null && 'riftCode' in e;
}

/** Next's control-flow throws carry a `digest`; ours never do. */
function isFrameworkSignal(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest !== '';
}
