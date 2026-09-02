import { describe, expect, it } from "vitest";
import { catalogueSize, classifyHost, HOME_COUNTRY } from "database";

/**
 * Classification is pure and has no database dependency, so it lives in the
 * unit project and runs in milliseconds.
 *
 * The cases that matter here are the ones where a naive implementation is
 * confidently wrong: a lookalike domain, a subdomain that should inherit its
 * parent, and a more specific entry that must beat a broader one.
 */
describe("host classification", () => {
  it("matches a known vendor exactly", () => {
    const result = classifyHost("google-analytics.com");
    expect(result.vendor).toBe("Google Analytics");
    expect(result.category).toBe("analytics");
    expect(result.destination_country).toBe("US");
  });

  it("matches a subdomain against its parent entry", () => {
    expect(classifyHost("ssl.google-analytics.com").vendor).toBe("Google Analytics");
    expect(classifyHost("region1.google-analytics.com").vendor).toBe("Google Analytics");
  });

  it("prefers the most specific entry over a broader one", () => {
    // `googleapis.com` is catalogued generically; the fonts subdomain is not the
    // same service and must not be reported as one.
    expect(classifyHost("fonts.googleapis.com").vendor).toBe("Google Fonts");
    expect(classifyHost("storage.googleapis.com").vendor).toBe("Google APIs");
  });

  it("does not match a lookalike domain by substring", () => {
    // The whole point of label-wise matching: `notgoogle-analytics.com` shares a
    // suffix as raw text but is a different registrable domain.
    expect(classifyHost("notgoogle-analytics.com").vendor).toBeNull();
    expect(classifyHost("google-analytics.com.evil.example").vendor).toBeNull();
  });

  it("is case and trailing-dot insensitive", () => {
    expect(classifyHost("GOOGLE-ANALYTICS.COM").vendor).toBe("Google Analytics");
    expect(classifyHost("google-analytics.com.").vendor).toBe("Google Analytics");
  });

  it("reports an unknown host as unclassified rather than safe", () => {
    const result = classifyHost("some-vendor-we-have-never-seen.example");
    expect(result.vendor).toBeNull();
    expect(result.category).toBeNull();
    expect(result.destination_country).toBeNull();
    // Unknown destination is not asserted as a border crossing: claiming a
    // transfer we cannot evidence would be worse than reporting it as unknown.
    expect(result.crosses_border).toBe(false);
  });

  it("treats a domestic vendor as not crossing the border", () => {
    const razorpay = classifyHost("checkout.razorpay.com");
    expect(razorpay.destination_country).toBe(HOME_COUNTRY);
    expect(razorpay.crosses_border).toBe(false);
  });

  it("flags a foreign vendor as crossing the border", () => {
    const meta = classifyHost("connect.facebook.net");
    expect(meta.destination_country).toBe("US");
    expect(meta.crosses_border).toBe(true);
  });

  it("handles degenerate input without throwing", () => {
    for (const input of ["", " ", ".", "localhost", "127.0.0.1"]) {
      expect(() => classifyHost(input)).not.toThrow();
    }
    expect(classifyHost("localhost").vendor).toBeNull();
  });

  it("ships a non-trivial catalogue", () => {
    expect(catalogueSize()).toBeGreaterThan(50);
  });
});
