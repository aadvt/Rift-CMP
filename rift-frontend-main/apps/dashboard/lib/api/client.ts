import 'server-only';
import type { RiftError } from './errors';
import { riftError } from './errors';

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
async function authHeaders(): Promise<Record<string, string>> {
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
