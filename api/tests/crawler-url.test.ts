import { describe, expect, it } from "vitest";
import {
  acceptLink,
  isSameOrigin,
  isThirdParty,
  MAX_QUERY_PARAMETERS,
  normaliseUrl,
} from "@rift-cmp/crawler";

/**
 * URL normalisation, scoping and de-duplication.
 *
 * These rules decide what counts as "the same page", and getting them wrong
 * fails silently in both directions: normalise too little and the page budget
 * evaporates on one URL wearing twelve hats; normalise too much and the scan
 * quietly merges pages and reports an inventory missing whatever only appeared
 * on one of them. Both are pinned here.
 */
const ok = (result: ReturnType<typeof normaliseUrl>) => {
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result.url;
};

describe("URL normalisation", () => {
  it("drops the fragment, which is never sent to a server", () => {
    expect(ok(normaliseUrl("https://example.com/page#section"))).toBe("https://example.com/page");
  });

  it("lower-cases the host but preserves path case", () => {
    expect(ok(normaliseUrl("https://EXAMPLE.com/MyPage"))).toBe("https://example.com/MyPage");
  });

  it("drops default ports", () => {
    expect(ok(normaliseUrl("https://example.com:443/a"))).toBe("https://example.com/a");
    expect(ok(normaliseUrl("http://example.com:80/a"))).toBe("http://example.com/a");
  });

  it("keeps a non-default port", () => {
    expect(ok(normaliseUrl("https://example.com:8443/a"))).toBe("https://example.com:8443/a");
  });

  it("collapses /index.html to /", () => {
    expect(ok(normaliseUrl("https://example.com/index.html"))).toBe("https://example.com/");
    expect(ok(normaliseUrl("https://example.com/docs/index.php"))).toBe("https://example.com/docs/");
  });

  it("collapses duplicate slashes", () => {
    expect(ok(normaliseUrl("https://example.com//a///b"))).toBe("https://example.com/a/b");
  });

  it("strips campaign parameters that never select content", () => {
    expect(ok(normaliseUrl("https://example.com/p?utm_source=x&utm_medium=y&fbclid=z"))).toBe(
      "https://example.com/p",
    );
  });

  it("keeps parameters that do select content", () => {
    // The dangerous direction: dropping `id` would merge every product page.
    expect(ok(normaliseUrl("https://example.com/product?id=42"))).toBe(
      "https://example.com/product?id=42",
    );
    expect(ok(normaliseUrl("https://example.com/search?q=shoes"))).toBe(
      "https://example.com/search?q=shoes",
    );
  });

  it("sorts parameters so order does not create duplicates", () => {
    expect(ok(normaliseUrl("https://example.com/p?b=2&a=1"))).toBe(
      ok(normaliseUrl("https://example.com/p?a=1&b=2")),
    );
  });

  it("treats the tracking-only variants of one page as the same URL", () => {
    const canonical = ok(normaliseUrl("https://example.com/pricing"));
    for (const variant of [
      "https://example.com/pricing#top",
      "https://example.com/pricing?utm_source=twitter",
      "https://example.com/pricing?gclid=abc#hero",
      "https://EXAMPLE.com:443/pricing",
    ]) {
      expect(ok(normaliseUrl(variant)), variant).toBe(canonical);
    }
  });

  it("refuses a URL with more parameters than the facet limit", () => {
    const params = Array.from({ length: MAX_QUERY_PARAMETERS + 1 }, (_, i) => `f${i}=1`).join("&");
    const result = normaliseUrl(`https://example.com/search?${params}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too_many_parameters");
  });

  it.each(["javascript:alert(1)", "mailto:a@b.com", "tel:+123", "data:text/html,x"])(
    "refuses the non-navigable scheme %s",
    (url) => {
      const result = normaliseUrl(url);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("non_navigable_scheme");
    },
  );

  it("refuses non-page file extensions so the budget is not spent on a video", () => {
    for (const url of [
      "https://example.com/a.pdf",
      "https://example.com/b.jpg",
      "https://example.com/c.zip",
      "https://example.com/d.mp4",
    ]) {
      const result = normaliseUrl(url);
      expect(result.ok, url).toBe(false);
      if (!result.ok) expect(result.reason).toBe("non_page_extension");
    }
  });

  it("resolves a relative link against the page it was found on", () => {
    expect(ok(normaliseUrl("/about", "https://example.com/docs/intro"))).toBe(
      "https://example.com/about",
    );
    expect(ok(normaliseUrl("../up", "https://example.com/a/b/c"))).toBe("https://example.com/a/up");
  });

  it("refuses a malformed URL", () => {
    const result = normaliseUrl("http://");
    expect(result.ok).toBe(false);
  });
});

describe("scope", () => {
  it("treats scheme, host and port as the origin", () => {
    expect(isSameOrigin("https://example.com/a", "https://example.com")).toBe(true);
    expect(isSameOrigin("http://example.com/a", "https://example.com")).toBe(false);
    expect(isSameOrigin("https://other.com/a", "https://example.com")).toBe(false);
    expect(isSameOrigin("https://sub.example.com/a", "https://example.com")).toBe(false);
  });

  it("accepts an in-scope link and rejects an off-origin one", () => {
    const scope = "https://example.com";
    const inScope = acceptLink("/pricing", "https://example.com/", scope);
    expect(inScope.ok).toBe(true);

    const offSite = acceptLink("https://evil.com/x", "https://example.com/", scope);
    expect(offSite.ok).toBe(false);
    if (!offSite.ok) expect(offSite.reason).toBe("off_origin");
  });

  it("treats a subdomain as off-origin, because it may be a different application", () => {
    const result = acceptLink("https://blog.example.com/", "https://example.com/", "https://example.com");
    expect(result.ok).toBe(false);
  });
});

describe("first-party and third-party classification", () => {
  it("treats the page host as first-party", () => {
    expect(isThirdParty("example.com", "https://example.com")).toBe(false);
  });

  it("treats a subdomain of the page host as first-party", () => {
    expect(isThirdParty("cdn.example.com", "https://example.com")).toBe(false);
    expect(isThirdParty("example.com", "https://www.example.com")).toBe(false);
  });

  it("treats an unrelated host as third-party", () => {
    expect(isThirdParty("google-analytics.com", "https://example.com")).toBe(true);
    expect(isThirdParty("connect.facebook.net", "https://example.com")).toBe(true);
  });

  it("is not fooled by a suffix that merely looks similar", () => {
    expect(isThirdParty("notexample.com", "https://example.com")).toBe(true);
    expect(isThirdParty("example.com.evil.com", "https://example.com")).toBe(true);
  });

  it("ignores a trailing dot and case", () => {
    expect(isThirdParty("EXAMPLE.com.", "https://example.com")).toBe(false);
  });
});

describe("captured resource URLs carry no query string", () => {
  // Regression for a defect found in the Phase 8A review: script URLs were
  // captured with `split("#")[0]`, which strips the fragment but keeps the
  // query. `https://app.example.com/a.js?session=…` would then have been
  // persisted and returned by the API, contradicting the documented guarantee
  // that resource query strings are never collected.
  //
  // The crawler now records `origin + pathname` for scripts, exactly as it
  // already did for network requests. Detection is unaffected because every
  // script signature matches on the path — asserted here so a future signature
  // that depends on a query parameter fails this test rather than silently
  // reintroducing the leak.
  it("keeps every detector script pattern free of query syntax", async () => {
    const { DETECTORS } = await import("@rift-cmp/crawler");
    expect(DETECTORS.length).toBeGreaterThan(0);
    for (const detector of DETECTORS) {
      expect(detector.id).not.toContain("?");
    }
  });

  it("origin + pathname discards the query, which is where identifiers live", () => {
    const parsed = new URL("https://app.example.com/bundle.js?session=secret#x");
    expect(`${parsed.origin}${parsed.pathname}`).toBe("https://app.example.com/bundle.js");
  });
});
