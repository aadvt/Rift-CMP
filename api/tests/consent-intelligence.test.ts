/**
 * Findings, and the restraint they are built with.
 *
 * The failure mode these guard against is not a crash. It is a finding that
 * reads as fact and is not one: an unclassified host reported as a tracker, a
 * first scan reported as twenty-five things appearing, a vendor absent from one
 * crawl reported as removed. Each would render perfectly and send somebody to
 * fix a problem they do not have.
 */
import { describe, expect, it } from "vitest";
import {
  buildPageIntelligence,
  detectDrift,
  detectShadowTrackers,
  type IntelligenceInput,
} from "@/lib/intelligence";
import type { ScanResultsResponse, VendorRecommendation } from "@rift-cmp/shared";

function technology(over: Partial<ScanResultsResponse["technologies"][number]> = {}) {
  return {
    detector_id: "google-analytics",
    name: "Google Analytics",
    category: "analytics",
    confidence: "high" as const,
    evidence: [],
    destination_country: "US",
    crosses_border: true,
    ...over,
  };
}

function results(
  technologies: ScanResultsResponse["technologies"],
): ScanResultsResponse {
  return {
    scan: {} as ScanResultsResponse["scan"],
    summary: {} as ScanResultsResponse["summary"],
    consent_ui: { detected: false, signals: [] },
    pages: [],
    cookies: [],
    scripts: [],
    requests: [],
    storage: [],
    technologies,
  } as unknown as ScanResultsResponse;
}

function recommendation(over: Partial<VendorRecommendation> = {}): VendorRecommendation {
  return {
    detector_id: "google-analytics",
    vendor_name: "Google Analytics",
    category: "analytics",
    suggested_purpose: "analytics",
    data_categories: [],
    jurisdictions: ["EU"],
    consent_requirement: "required",
    opt_out_requirement: "unknown",
    recommended_action: "require_consent",
    reason: "",
    confidence: "high",
    evidence: [],
    rule_references: [],
    overridden: false,
    override_note: null,
    observed_in_latest_scan: true,
    ...over,
  };
}

function input(over: Partial<IntelligenceInput> = {}): IntelligenceInput {
  return {
    siteId: "site_1",
    scanId: "scan_2",
    baselineScanId: "scan_1",
    results: results([technology()]),
    baseline: results([technology()]),
    approved: [],
    policyVersion: 1,
    runtime: [],
    now: new Date("2026-09-05T00:00:00Z"),
    ...over,
  };
}

describe("shadow trackers", () => {
  it("reports something observed that no approved recommendation covers", () => {
    const found = detectShadowTrackers(input({ approved: [] }));

    expect(found).toHaveLength(1);
    expect(found[0]?.reason).toBe("not_configured");
    expect(found[0]?.approved).toBe(false);
  });

  it("stays quiet when the configuration already covers it", () => {
    const found = detectShadowTrackers(input({ approved: [recommendation()] }));
    expect(found).toHaveLength(0);
  });

  it("treats a blocked vendor that is still running as the most serious case", () => {
    // The only situation here where the configuration is actively wrong rather
    // than merely incomplete: somebody decided, and the decision is ignored.
    const found = detectShadowTrackers(
      input({ approved: [recommendation({ recommended_action: "block" })] }),
    );

    expect(found[0]?.reason).toBe("blocked_but_observed");
    expect(found[0]?.severity).toBe("critical");
  });

  it("flags a consent-gated vendor with no purpose attached", () => {
    const found = detectShadowTrackers(
      input({ approved: [recommendation({ suggested_purpose: null })] }),
    );

    expect(found[0]?.reason).toBe("no_purpose");
    expect(found[0]?.recommended_action).toMatch(/attach a purpose/i);
  });

  it("reports an unclassified host as unclassified, never as a tracker", () => {
    // The line the whole product rests on. Unknown is not permission and it is
    // not an accusation: it is a task.
    const found = detectShadowTrackers(
      input({
        results: results([
          technology({ detector_id: "unknown-host", name: "tracker.example.com", category: "unclassified", confidence: "low" }),
        ]),
      }),
    );

    expect(found[0]?.reason).toBe("unclassified_behaviour");
    expect(found[0]?.severity).toBe("low");
    expect(found[0]?.category).toBeNull();
    expect(found[0]?.confidence).toBe("low");
  });

  it("does not upgrade the scanner's confidence by reporting it", () => {
    const found = detectShadowTrackers(
      input({ results: results([technology({ confidence: "medium" })]) }),
    );
    expect(found[0]?.confidence).toBe("medium");
  });

  it("ignores infrastructure nobody needs to decide about", () => {
    // A CDN listed beside a real finding buries the finding.
    const found = detectShadowTrackers(
      input({ results: results([technology({ detector_id: "cloudflare", name: "Cloudflare", category: "cdn" })]) }),
    );
    expect(found).toHaveLength(0);
  });

  it("carries evidence naming where the observation came from", () => {
    const found = detectShadowTrackers(input());

    expect(found[0]?.evidence.length).toBeGreaterThan(0);
    expect(found[0]?.evidence[0]?.source).toBe("scan");
    expect(found[0]?.evidence[0]?.scan_id).toBe("scan_2");
  });

  it("treats a host a real browser contacted as runtime evidence", () => {
    const found = detectShadowTrackers(
      input({
        results: results([]),
        runtime: [
          {
            host: "tracker.example.com",
            kind: "script",
            initiator: null,
            sample_path: "/t.js",
            third_party: true,
            request_count: 4,
            first_seen: "2026-09-01T00:00:00Z",
            last_seen: "2026-09-04T00:00:00Z",
            page_url: "https://example.com/checkout",
            vendor: "Example Tracker",
            category: "analytics",
            destination_country: "US",
            crosses_border: true,
          },
        ],
      }),
    );

    expect(found[0]?.evidence[0]?.source).toBe("runtime");
    expect(found[0]?.pages).toEqual(["https://example.com/checkout"]);
  });

  it("orders the worst first", () => {
    const found = detectShadowTrackers(
      input({
        results: results([
          technology({ detector_id: "unknown", name: "unknown.example", category: "unclassified", confidence: "low" }),
          technology({ detector_id: "blocked-one", name: "Blocked One" }),
        ]),
        approved: [recommendation({ detector_id: "blocked-one", vendor_name: "Blocked One", recommended_action: "block" })],
      }),
    );

    expect(found[0]?.severity).toBe("critical");
    expect(found.at(-1)?.severity).toBe("low");
  });
});

describe("drift", () => {
  it("reports a technology that was not in the previous scan", () => {
    const found = detectDrift(
      input({
        baseline: results([]),
        results: results([technology()]),
      }),
    );

    expect(found.some((f) => f.kind === "tracker_added")).toBe(true);
  });

  it("reports nothing as added when there is no previous scan", () => {
    // Everything is "new" relative to nothing, which is true of the data and
    // false about the site.
    const found = detectDrift(input({ baseline: null, baselineScanId: null }));
    expect(found.filter((f) => f.kind === "tracker_added")).toHaveLength(0);
  });

  it("will not claim a vendor was removed without saying it might be the crawl", () => {
    const found = detectDrift(
      input({ baseline: results([technology()]), results: results([]) }),
    );
    const removed = found.find((f) => f.kind === "tracker_removed");

    expect(removed?.severity).toBe("info");
    expect(removed?.recommended_action).toMatch(/may simply not have reached/i);
  });

  it("treats a blocked vendor that is still there as critical", () => {
    const found = detectDrift(
      input({ approved: [recommendation({ recommended_action: "block" })] }),
    );
    const blocked = found.find((f) => f.kind === "blocked_still_active");

    expect(blocked?.severity).toBe("critical");
    expect(blocked?.policy_version).toBe(1);
  });

  it("flags a consent requirement that nothing gates", () => {
    const found = detectDrift(
      input({ approved: [recommendation({ suggested_purpose: null })] }),
    );
    expect(found.some((f) => f.kind === "consent_required_unconfigured")).toBe(true);
  });

  it("says nothing about policy when no policy has been approved", () => {
    // Drift is a difference from a decision. With no decision there is nothing
    // to drift from, and reporting one would invent a baseline.
    const found = detectDrift(input({ approved: [] }));
    expect(found.filter((f) => f.kind === "blocked_still_active")).toHaveLength(0);
  });

  it("carries the scan the difference was observed in", () => {
    const found = detectDrift(input({ baseline: results([]), results: results([technology()]) }));
    expect(found[0]?.evidence[0]?.scan_id).toBe("scan_2");
  });
});

describe("page intelligence", () => {
  function withPages(over: Partial<IntelligenceInput> = {}): IntelligenceInput {
    const base = results([technology()]);
    return input({
      results: {
        ...base,
        pages: [{ url: "https://example.com/", title: "Home", status: 200 }],
        scripts: [
          { url: "https://www.google-analytics.com/ga.js", host: "www.google-analytics.com", inline: false, third_party: true, observed_on: "https://example.com/" },
          { url: "https://example.com/app.js", host: "example.com", inline: false, third_party: false, observed_on: "https://example.com/" },
          { url: "https://other.example/x.js", host: "other.example", inline: false, third_party: true, observed_on: "https://example.com/elsewhere" },
        ],
        cookies: [{ name: "_ga", domain: ".google-analytics.com", path: "/", expires: null, secure: true, http_only: false, same_site: "lax", third_party: true }],
      } as never,
      ...over,
    });
  }

  it("returns nothing when the site has never been scanned", () => {
    expect(buildPageIntelligence(input({ results: null }))).toEqual([]);
  });

  it("attributes a script to the page it was seen on, and only that page", () => {
    const [page] = buildPageIntelligence(withPages());

    expect(page?.url).toBe("https://example.com/");
    expect(page?.components.map((c) => c.host)).toContain("www.google-analytics.com");
    // Seen on a different page; including it would make the page view a lie.
    expect(page?.components.map((c) => c.host)).not.toContain("other.example");
  });

  it("marks a script as observed and a cookie as inferred", () => {
    // The distinction the whole view rests on: the crawler records cookies for
    // the scan, not the page, so a cookie here matched a host rather than being
    // seen.
    const [page] = buildPageIntelligence(withPages());

    expect(page?.components.find((c) => c.host === "www.google-analytics.com")?.attribution).toBe("observed");
    expect(page?.cookies.every((c) => c.attribution === "inferred")).toBe(true);
  });

  it("carries the policy's answer verbatim rather than flattening it", () => {
    const [page] = buildPageIntelligence(
      withPages({ approved: [recommendation({ consent_requirement: "conditional" })] }),
    );
    const ga = page?.components.find((c) => c.host === "www.google-analytics.com");

    // "conditional" and "unknown" are real answers from the engine and are
    // never collapsed into a boolean.
    expect(ga?.consent_required).toBe("conditional");
  });

  it("counts what needs review, which is the reason to open a page", () => {
    const [page] = buildPageIntelligence(withPages({ approved: [] }));
    expect(page?.summary.needs_review).toBeGreaterThan(0);
  });

  it("reports a page with no third-party components as quiet", () => {
    const [page] = buildPageIntelligence(
      input({
        results: {
          ...results([]),
          pages: [{ url: "https://example.com/quiet", title: "Quiet", status: 200 }],
          scripts: [{ url: "https://example.com/app.js", host: "example.com", inline: false, third_party: false, observed_on: "https://example.com/quiet" }],
          cookies: [],
        } as never,
      }),
    );

    expect(page?.summary.third_party).toBe(0);
    expect(page?.shadow_trackers).toEqual([]);
    expect(page?.unresolved).toEqual([]);
  });

  it("lists a third-party host with no known vendor as unresolved, not as a tracker", () => {
    const [page] = buildPageIntelligence(
      input({
        results: {
          ...results([]),
          pages: [{ url: "https://example.com/", title: "Home", status: 200 }],
          scripts: [{ url: "https://unknown.example/x.js", host: "unknown.example", inline: false, third_party: true, observed_on: "https://example.com/" }],
          cookies: [],
        } as never,
      }),
    );

    expect(page?.unresolved.map((u) => u.host)).toContain("unknown.example");
    expect(page?.unresolved[0]?.confidence).toBe("low");
  });

  it("shows the policy version its judgements were made against", () => {
    const [page] = buildPageIntelligence(withPages({ policyVersion: 7 }));
    expect(page?.policy_version).toBe(7);
  });
});
