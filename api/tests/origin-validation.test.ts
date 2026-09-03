import { describe, expect, it } from "vitest";
import { evaluateOrigin } from "@/lib/origin";

/**
 * Unit tests for origin validation.
 *
 * The single most important assertion in this file is the last describe block:
 * **an absent `Origin` is allowed**. That is not an oversight, it is what makes
 * this defence in depth rather than a control. A browser cannot lie about its
 * origin; anything that is not a browser simply does not send one, and there is
 * no way to tell that apart from a legitimate server-to-server call.
 *
 * So origin validation raises the cost of abusing a site's public key *from a
 * web page*, which is the realistic attack given the key is in page source, and
 * it proves nothing whatsoever about consent. The thing that binds a decision to
 * a browser is the consent session — see `consent-authenticity.test.ts`.
 */

const site = { domain: "example.com", allowedOrigins: [] as string[] };

describe("matching the registered domain", () => {
  it("accepts the exact domain", () => {
    expect(evaluateOrigin("https://example.com", site, true).allowed).toBe(true);
  });

  it("accepts the www form", () => {
    expect(evaluateOrigin("https://www.example.com", site, true).allowed).toBe(true);
  });

  it("accepts a subdomain", () => {
    expect(evaluateOrigin("https://shop.example.com", site, true).allowed).toBe(true);
  });

  it("accepts http as well as https", () => {
    // TLS termination is an assumption stated in docs/mvp.md, not something this
    // check can enforce, and refusing http here would break plain-http staging
    // without adding any protection.
    expect(evaluateOrigin("http://example.com", site, true).allowed).toBe(true);
  });

  it("accepts a domain registered with a www prefix, asked for bare", () => {
    const wwwSite = { domain: "www.example.com", allowedOrigins: [] };
    expect(evaluateOrigin("https://example.com", wwwSite, true).allowed).toBe(true);
  });

  it("is case insensitive", () => {
    expect(evaluateOrigin("https://EXAMPLE.com", site, true).allowed).toBe(true);
  });

  it("ignores the port", () => {
    expect(evaluateOrigin("https://example.com:8443", site, true).allowed).toBe(true);
  });
});

describe("refusing what does not match", () => {
  it("refuses an unrelated origin", () => {
    expect(evaluateOrigin("https://evil.test", site, true).allowed).toBe(false);
  });

  it("refuses a suffix that is not a subdomain", () => {
    // `notexample.com` ends with `example.com` as a string. A naive
    // `endsWith` would accept it, which is the classic way this check is got
    // wrong.
    expect(evaluateOrigin("https://notexample.com", site, true).allowed).toBe(false);
  });

  it("refuses the domain used as a subdomain of somewhere else", () => {
    expect(evaluateOrigin("https://example.com.evil.test", site, true).allowed).toBe(false);
  });

  it("refuses the opaque `null` origin", () => {
    // Sent by a sandboxed iframe and by `file://` pages. It names no site, so
    // there is nothing to check it against.
    expect(evaluateOrigin("null", site, true).allowed).toBe(false);
  });

  it("refuses a non-http scheme", () => {
    expect(evaluateOrigin("chrome-extension://abcdef", site, true).allowed).toBe(false);
    expect(evaluateOrigin("file://", site, true).allowed).toBe(false);
  });

  it("refuses something that is not a URL at all", () => {
    expect(evaluateOrigin("example.com", site, true).allowed).toBe(false);
    expect(evaluateOrigin("¯\\_(ツ)_/¯", site, true).allowed).toBe(false);
  });
});

describe("the configured allowlist", () => {
  const configured = {
    domain: "example.com",
    allowedOrigins: ["https://app.partner.test", "http://localhost:5173"],
  };

  it("accepts a listed origin", () => {
    expect(evaluateOrigin("https://app.partner.test", configured, true).allowed).toBe(true);
  });

  it("matches on the full origin, not just the host", () => {
    // A listed `https://` origin must not silently authorise the `http://` one.
    expect(evaluateOrigin("http://app.partner.test", configured, true).allowed).toBe(false);
  });

  it("does not accept a subdomain of a listed origin", () => {
    expect(evaluateOrigin("https://sub.app.partner.test", configured, true).allowed).toBe(false);
  });

  it("lets an operator keep a dev origin working in production", () => {
    expect(evaluateOrigin("http://localhost:5173", configured, true).allowed).toBe(true);
  });
});

describe("local development", () => {
  it("accepts loopback on any port outside production", () => {
    for (const origin of [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "https://app.localhost:4000",
    ]) {
      expect(evaluateOrigin(origin, site, false).allowed).toBe(true);
    }
  });

  it("refuses loopback in production unless it is listed", () => {
    expect(evaluateOrigin("http://localhost:3000", site, true).allowed).toBe(false);
  });

  it("still refuses a non-loopback mismatch outside production", () => {
    // Development being permissive about loopback must not make it permissive
    // about everything, or the check would never be exercised until deploy.
    expect(evaluateOrigin("https://evil.test", site, false).allowed).toBe(false);
  });
});

describe("an absent Origin is allowed, and that is the whole limitation", () => {
  it("allows a request with no Origin header", () => {
    const verdict = evaluateOrigin(null, site, true);
    expect(verdict.allowed).toBe(true);
    expect(verdict.reason).toBe("absent");
  });

  it("allows an empty Origin header", () => {
    expect(evaluateOrigin("   ", site, true).allowed).toBe(true);
  });

  it("means any non-browser client bypasses the check entirely", () => {
    // curl, a script, a server: none of them send an Origin, and none of them
    // can be distinguished from a legitimate integrator that also does not.
    // Origin is evidence about a browser. It is never proof of consent.
    expect(evaluateOrigin(undefined, { domain: "example.com", allowedOrigins: [] }, true).allowed).toBe(
      true,
    );
  });
});

describe("the echoed CORS origin", () => {
  it("echoes the request's own origin when it matched", () => {
    expect(evaluateOrigin("https://shop.example.com", site, true).echo).toBe(
      "https://shop.example.com",
    );
  });

  it("echoes nothing when there was no origin, so the response stays `*`", () => {
    expect(evaluateOrigin(null, site, true).echo).toBeNull();
  });

  it("echoes nothing on a refusal", () => {
    expect(evaluateOrigin("https://evil.test", site, true).echo).toBeNull();
  });
});
