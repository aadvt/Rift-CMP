import type { NextRequest } from "next/server";

/**
 * In-process rate limiting for the browser-facing planes.
 *
 * ## Why it is deliberately this small
 *
 * The honest deployment model for this MVP is one Next.js process in front of
 * one Postgres. A Redis-backed distributed limiter would be the right answer for
 * a fleet, and the wrong answer here: it adds a service to run, a failure mode
 * to reason about, and a second source of truth, in exchange for correctness
 * this deployment cannot currently observe the absence of.
 *
 * So this is a fixed-window counter in a `Map`. What that buys and what it does
 * not is stated plainly in docs/security.md, and repeated here because the gap
 * matters:
 *
 *  - **It stops** a single client hammering ingestion or consent from one box,
 *    a runaway SDK loop, and casual scripted abuse of a public key.
 *  - **It does not stop** a distributed flood, and it resets on deploy. Counters
 *    are per process, so N instances mean N times the configured limit.
 *
 * It is defence in depth, not a quota system, and it must never be the only
 * thing standing between a caller and a write.
 */

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window rolls over. Always at least 1. */
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Module state. Survives across requests within one server process, which is
 * exactly the scope this limiter claims.
 */
const windows = new Map<string, Window>();

/** Bounds memory when a flood cycles through many distinct keys. */
const MAX_TRACKED_KEYS = 50_000;

/**
 * The rules, in one place so a reviewer can read the whole policy at once.
 *
 * The numbers are set against what a legitimate SDK does. The analytics client
 * flushes at most every two seconds (30 requests a minute) and the consent
 * client only writes when a person interacts with a banner, so each limit sits
 * several times above honest traffic and far below abusive traffic.
 */
export const RATE_LIMITS = {
  /** Per site + client address. A page view is a handful of these at most. */
  events: { limit: 120, windowMs: 60_000 },
  /** Whole-site ceiling, so one popular site cannot be used to drown the box. */
  eventsPerSite: { limit: 6_000, windowMs: 60_000 },
  /** Recording decisions. A preference centre saves a few at a time. */
  consentWrite: { limit: 30, windowMs: 60_000 },
  /** Reading one principal's state. Cheap, but an oracle if left unbounded. */
  consentRead: { limit: 120, windowMs: 60_000 },
  /** Opening a session mints a principal row, so this is the tightest limit. */
  consentSession: { limit: 20, windowMs: 60_000 },
  /** Discovery reports are one per page view. */
  discovery: { limit: 60, windowMs: 60_000 },
  /**
   * Applied by client address *before* authentication, so an unauthenticated
   * flood cannot make the database do a credential lookup per request.
   */
  unauthenticated: { limit: 300, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Records one hit against `key` and reports whether it is permitted.
 *
 * Fixed window rather than sliding: a sliding window needs per-request
 * timestamps, and the burst a fixed window permits at a boundary (up to twice
 * the limit across two adjacent windows) is irrelevant at these magnitudes.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitVerdict {
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) evictExpired(now);
    const resetAt = now + rule.windowMs;
    windows.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: rule.limit,
      remaining: rule.limit - 1,
      retryAfterSeconds: secondsUntil(resetAt, now),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, rule.limit - existing.count);

  return {
    allowed: existing.count <= rule.limit,
    limit: rule.limit,
    remaining,
    retryAfterSeconds: secondsUntil(existing.resetAt, now),
  };
}

function secondsUntil(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function evictExpired(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Still full of live windows: this is a genuine flood across many keys, and
  // dropping the oldest is better than growing without bound.
  if (windows.size >= MAX_TRACKED_KEYS) {
    const excess = windows.size - Math.floor(MAX_TRACKED_KEYS / 2);
    let removed = 0;
    for (const key of windows.keys()) {
      windows.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/** Clears every counter. Tests only — there is no runtime caller. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is trivially forged by a client talking to the app directly,
 * and is only meaningful behind a proxy that overwrites it. That is precisely
 * why this limiter is defence in depth: an attacker who can rotate the header
 * can rotate the bucket. The per-site ceilings above do not depend on it.
 */
export function clientAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Applies one rule and returns a `429` when it is exceeded, or null to proceed.
 *
 * The response carries `Retry-After` and the `RateLimit-*` headers so a
 * well-behaved client can back off instead of retrying into the wall. It is
 * built by the caller's own error helper, so the ingestion plane keeps its CORS
 * headers and the management plane keeps its lack of them.
 */
export function enforceRateLimit(
  key: string,
  rule: RateLimitRule,
  buildError: (retryAfterSeconds: number) => Response,
  now: number = Date.now(),
): Response | null {
  const verdict = checkRateLimit(key, rule, now);
  if (verdict.allowed) return null;

  const response = buildError(verdict.retryAfterSeconds);
  response.headers.set("Retry-After", String(verdict.retryAfterSeconds));
  response.headers.set("RateLimit-Limit", String(verdict.limit));
  response.headers.set("RateLimit-Remaining", "0");
  response.headers.set("RateLimit-Reset", String(verdict.retryAfterSeconds));
  return response;
}
