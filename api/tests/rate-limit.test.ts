import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  RATE_LIMITS,
  checkRateLimit,
  clientAddress,
  enforceRateLimit,
  resetRateLimits,
} from "@/lib/rate-limit";
import { jsonError } from "@/lib/cors";

/**
 * Unit tests for the rate limiter.
 *
 * Driven directly rather than through routes, because the interesting behaviour
 * is about time and bucket identity, and both are awkward to steer through HTTP.
 * The route-level wiring is covered by `browser-plane-guard.test.ts`.
 */

beforeEach(resetRateLimits);

const RULE = { limit: 3, windowMs: 1_000 };

describe("fixed-window counting", () => {
  it("permits exactly `limit` requests in a window", () => {
    const now = 1_000_000;
    for (let i = 0; i < RULE.limit; i += 1) {
      expect(checkRateLimit("bucket", RULE, now).allowed).toBe(true);
    }
    expect(checkRateLimit("bucket", RULE, now).allowed).toBe(false);
  });

  it("reports how much of the allowance is left", () => {
    const now = 1_000_000;
    expect(checkRateLimit("bucket", RULE, now).remaining).toBe(2);
    expect(checkRateLimit("bucket", RULE, now).remaining).toBe(1);
    expect(checkRateLimit("bucket", RULE, now).remaining).toBe(0);
    expect(checkRateLimit("bucket", RULE, now).remaining).toBe(0);
  });

  it("starts a fresh window once the old one has elapsed", () => {
    const now = 1_000_000;
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit("bucket", RULE, now);
    expect(checkRateLimit("bucket", RULE, now).allowed).toBe(false);

    expect(checkRateLimit("bucket", RULE, now + RULE.windowMs).allowed).toBe(true);
  });

  it("never reports a retry-after of zero", () => {
    const now = 1_000_000;
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit("bucket", RULE, now);

    // One millisecond before the window rolls over, "retry in 0 seconds" would
    // invite an immediate retry that is guaranteed to fail again.
    const verdict = checkRateLimit("bucket", RULE, now + RULE.windowMs - 1);
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("bucket isolation", () => {
  it("counts each bucket separately", () => {
    const now = 1_000_000;
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit("site-a", RULE, now);

    expect(checkRateLimit("site-a", RULE, now).allowed).toBe(false);
    expect(checkRateLimit("site-b", RULE, now).allowed).toBe(true);
  });

  it("does not let one tenant exhaust another tenant's allowance", () => {
    const now = 1_000_000;
    const rule = RATE_LIMITS.consentWrite;

    for (let i = 0; i < rule.limit; i += 1) {
      checkRateLimit("consent-write:site-a:10.0.0.1", rule, now);
    }

    expect(checkRateLimit("consent-write:site-a:10.0.0.1", rule, now).allowed).toBe(false);
    expect(checkRateLimit("consent-write:site-b:10.0.0.1", rule, now).allowed).toBe(true);
  });
});

describe("the configured policy", () => {
  it("leaves ample headroom above what an honest SDK sends", () => {
    // The analytics client flushes at most every two seconds: 30 requests a
    // minute. Anything at or below that would throttle correct behaviour.
    expect(RATE_LIMITS.events.limit).toBeGreaterThan(30);
    expect(RATE_LIMITS.events.windowMs).toBe(60_000);
  });

  it("is tightest on the endpoint that creates rows for anonymous callers", () => {
    expect(RATE_LIMITS.consentSession.limit).toBeLessThan(RATE_LIMITS.consentWrite.limit);
    expect(RATE_LIMITS.consentSession.limit).toBeLessThan(RATE_LIMITS.events.limit);
  });

  it("keeps the per-site ceiling far above the per-client limit", () => {
    expect(RATE_LIMITS.eventsPerSite.limit).toBeGreaterThan(RATE_LIMITS.events.limit);
  });
});

describe("enforceRateLimit", () => {
  it("returns null while the caller is within the limit", () => {
    const now = 1_000_000;
    const response = enforceRateLimit(
      "bucket",
      RULE,
      () => jsonError("rate_limited", "no"),
      now,
    );
    expect(response).toBeNull();
  });

  it("returns 429 with the headers a client needs to back off", async () => {
    const now = 1_000_000;
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit("bucket", RULE, now);

    const response = enforceRateLimit(
      "bucket",
      RULE,
      (retryAfter) => jsonError("rate_limited", `Retry after ${retryAfter}s.`, [], 429),
      now,
    );

    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("1");
    expect(response?.headers.get("RateLimit-Limit")).toBe("3");
    expect(response?.headers.get("RateLimit-Remaining")).toBe("0");
    // The ingestion plane's error helper keeps its CORS headers, so a browser
    // can read the 429 rather than seeing an opaque network failure.
    expect(response?.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("clientAddress", () => {
  const request = (headers: Record<string, string>) =>
    new NextRequest(new URL("http://localhost:3000/api/v1/events"), { headers: new Headers(headers) });

  it("prefers the first entry of x-forwarded-for", () => {
    expect(clientAddress(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientAddress(request({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("returns a stable placeholder when nothing identifies the client", () => {
    // Every such caller shares one bucket. That is the honest behaviour: with no
    // proxy in front, there is nothing to attribute a request to.
    expect(clientAddress(request({}))).toBe("unknown");
  });
});

describe("what this limiter does not claim", () => {
  it("is per process, so counters do not survive a restart", () => {
    const now = 1_000_000;
    for (let i = 0; i < RULE.limit; i += 1) checkRateLimit("bucket", RULE, now);
    expect(checkRateLimit("bucket", RULE, now).allowed).toBe(false);

    // Standing in for a redeploy or a second instance. Documented in
    // docs/security.md as a limitation, not hidden behind a passing test.
    resetRateLimits();
    expect(checkRateLimit("bucket", RULE, now).allowed).toBe(true);
  });

  it("is defeated by a client that rotates its forwarded address", () => {
    const now = 1_000_000;
    const rule = RATE_LIMITS.consentSession;

    for (let i = 0; i < rule.limit; i += 1) checkRateLimit("cs:site:10.0.0.1", rule, now);
    expect(checkRateLimit("cs:site:10.0.0.1", rule, now).allowed).toBe(false);

    // A different claimed address is a different bucket. This is why the limiter
    // is defence in depth and never the only control on a write.
    expect(checkRateLimit("cs:site:10.0.0.2", rule, now).allowed).toBe(true);
  });
});
