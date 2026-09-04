import { describe, expect, it } from "vitest";
import { detectTechnologies, isAllowed, parseRobots, pathForRobots } from "@rift-cmp/crawler";
import type { DetectionInput } from "@rift-cmp/crawler";

/**
 * Detector and robots behaviour.
 *
 * The load-bearing assertion in this file is a negative one: a detector reports
 * *what* a technology is and *why* it thinks so, and never what the law
 * requires. If a `consent_required` field ever appears in a finding, the test at
 * the bottom fails, because that decision belongs to the compliance layer and
 * burying it in a pattern table would put it where no lawyer would find it.
 */

const empty: DetectionInput = { requests: [], scripts: [], cookies: [], storage: [] };

const request = (host: string, thirdParty = true) => ({
  url: `https://${host}/collect`,
  host,
  method: "GET",
  resourceType: "script",
  status: 200,
  isThirdParty: thirdParty,
  observedOn: "https://example.com/",
  failed: false,
});

const script = (url: string) => ({
  url,
  host: new URL(url).hostname,
  inline: false,
  isThirdParty: true,
  observedOn: "https://example.com/",
});

const cookie = (name: string) => ({
  name,
  domain: ".example.com",
  path: "/",
  expires: null,
  secure: true,
  httpOnly: false,
  sameSite: "Lax",
  isThirdParty: false,
  firstSeenOn: "https://example.com",
});

const detect = (input: Partial<DetectionInput>) =>
  detectTechnologies({ ...empty, ...input }, { maxEvidencePerFinding: 5 });

describe("tracker detectors: positive cases", () => {
  it("detects Google Analytics from a script URL", () => {
    const findings = detect({ scripts: [script("https://www.googletagmanager.com/gtag/js?id=G-X")] });
    const ga = findings.find((f) => f.detectorId === "google-analytics");
    expect(ga).toBeDefined();
    expect(ga!.category).toBe("analytics");
    expect(ga!.evidence.some((e) => e.type === "script")).toBe(true);
  });

  it("detects Meta Pixel from a cookie name alone, at lower confidence", () => {
    const findings = detect({ cookies: [cookie("_fbp")] });
    const meta = findings.find((f) => f.detectorId === "meta-pixel");
    expect(meta).toBeDefined();
    expect(meta!.confidence).toBe("medium");
  });

  it("raises confidence to high when two independent kinds of signal agree", () => {
    const findings = detect({
      scripts: [script("https://connect.facebook.net/en_US/fbevents.js")],
      cookies: [cookie("_fbp")],
    });
    const meta = findings.find((f) => f.detectorId === "meta-pixel");
    expect(meta!.confidence).toBe("high");
    // Both kinds of evidence are retained so the UI can explain the verdict.
    expect(new Set(meta!.evidence.map((e) => e.type))).toEqual(new Set(["script", "cookie"]));
  });

  it("matches a cookie-name prefix pattern", () => {
    const findings = detect({ cookies: [cookie("_hjSessionUser_123")] });
    expect(findings.some((f) => f.detectorId === "hotjar")).toBe(true);
  });

  it("detects a consent manager as a technology like any other", () => {
    const findings = detect({ scripts: [script("https://cdn.cookielaw.org/otSDKStub.js")] });
    const cmp = findings.find((f) => f.detectorId === "onetrust");
    expect(cmp).toBeDefined();
    expect(cmp!.category).toBe("consent_management");
  });

  it("carries the destination country through from the shared catalogue", () => {
    const findings = detect({ requests: [request("google-analytics.com")] });
    const ga = findings.find((f) => f.detectorId === "google-analytics");
    expect(ga!.destinationCountry).toBe("US");
    expect(ga!.crossesBorder).toBe(true);
  });

  it("deduplicates repeated evidence, since one host seen often is one fact", () => {
    const findings = detect({
      requests: [request("google-analytics.com"), request("google-analytics.com")],
    });
    const ga = findings.find((f) => f.detectorId === "google-analytics");
    expect(ga!.evidence.filter((e) => e.value === "google-analytics.com")).toHaveLength(1);
  });

  it("bounds evidence per finding", () => {
    const many = Array.from({ length: 30 }, (_, i) => script(`https://connect.facebook.net/${i}.js`));
    const findings = detectTechnologies({ ...empty, scripts: many }, { maxEvidencePerFinding: 3 });
    const meta = findings.find((f) => f.detectorId === "meta-pixel");
    expect(meta!.evidence.length).toBeLessThanOrEqual(3);
  });
});

describe("tracker detectors: negative cases", () => {
  it("finds nothing on an empty observation set", () => {
    expect(detect({})).toEqual([]);
  });

  it("does not match a host that merely looks similar", () => {
    const findings = detect({ requests: [request("notgoogle-analytics.com")] });
    expect(findings.some((f) => f.detectorId === "google-analytics")).toBe(false);
  });

  it("does not detect anything from first-party traffic alone", () => {
    const findings = detect({ requests: [request("example.com", false)] });
    expect(findings).toEqual([]);
  });

  it("reports an unknown third-party host as low confidence rather than dropping it", () => {
    // An unmatched third party is the row an operator most needs to see.
    const findings = detect({ requests: [request("some-unknown-vendor.example")] });
    expect(findings).toHaveLength(1);
    expect(findings[0].confidence).toBe("low");
    expect(findings[0].category).toBe("unclassified");
    expect(findings[0].name).toBe("some-unknown-vendor.example");
  });

  it("does not report an unknown host as safe or as a known vendor", () => {
    const findings = detect({ requests: [request("weird-host.example")] });
    expect(findings[0].destinationCountry).toBeNull();
    expect(findings[0].crossesBorder).toBe(false);
  });
});

describe("detectors state facts, not legal conclusions", () => {
  it("emits no field that decides consent or lawfulness", () => {
    const findings = detect({
      scripts: [script("https://www.googletagmanager.com/gtag/js?id=G-X")],
      cookies: [cookie("_ga")],
    });
    expect(findings.length).toBeGreaterThan(0);

    for (const finding of findings) {
      const keys = Object.keys(finding);
      for (const forbidden of [
        "consentRequired",
        "consent_required",
        "lawful",
        "gdpr",
        "legalBasis",
        "requiresConsent",
      ]) {
        expect(keys, `finding must not decide "${forbidden}"`).not.toContain(forbidden);
      }
      // What it does carry: an identification, a confidence and the evidence.
      expect(finding).toHaveProperty("confidence");
      expect(finding.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("robots.txt", () => {
  it("allows everything when there are no rules", () => {
    const policy = parseRobots("", "RiftCMP-Scanner/1.0");
    expect(isAllowed(policy, "/anything")).toBe(true);
  });

  it("honours a wildcard disallow", () => {
    const policy = parseRobots("User-agent: *\nDisallow: /admin", "RiftCMP-Scanner/1.0");
    expect(isAllowed(policy, "/admin")).toBe(false);
    expect(isAllowed(policy, "/admin/users")).toBe(false);
    expect(isAllowed(policy, "/public")).toBe(true);
  });

  it("lets a longer Allow override a broader Disallow", () => {
    const policy = parseRobots("User-agent: *\nDisallow: /\nAllow: /public/", "RiftCMP-Scanner/1.0");
    expect(isAllowed(policy, "/public/page")).toBe(true);
    expect(isAllowed(policy, "/private")).toBe(false);
  });

  it("prefers a group naming our agent over the wildcard group", () => {
    const policy = parseRobots(
      "User-agent: *\nDisallow: /\n\nUser-agent: RiftCMP-Scanner\nDisallow: /secret",
      "RiftCMP-Scanner/1.0",
    );
    expect(isAllowed(policy, "/anything")).toBe(true);
    expect(isAllowed(policy, "/secret")).toBe(false);
  });

  it("treats an empty Disallow as permission, not prohibition", () => {
    const policy = parseRobots("User-agent: *\nDisallow:", "RiftCMP-Scanner/1.0");
    expect(isAllowed(policy, "/anything")).toBe(true);
  });

  it("supports wildcard and end-anchor patterns", () => {
    const policy = parseRobots("User-agent: *\nDisallow: /*.pdf$", "RiftCMP-Scanner/1.0");
    expect(isAllowed(policy, "/docs/report.pdf")).toBe(false);
    expect(isAllowed(policy, "/docs/report.pdf.html")).toBe(true);
  });

  it("reads crawl-delay and sitemaps", () => {
    const policy = parseRobots(
      "User-agent: *\nCrawl-delay: 2\nSitemap: https://example.com/sitemap.xml",
      "RiftCMP-Scanner/1.0",
    );
    expect(policy.crawlDelaySeconds).toBe(2);
    expect(policy.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("ignores comments and blank lines", () => {
    const policy = parseRobots("# comment\nUser-agent: *  # inline\nDisallow: /x", "RiftCMP-Scanner/1.0");
    expect(isAllowed(policy, "/x")).toBe(false);
  });

  it("matches rules against path plus query", () => {
    expect(pathForRobots("https://example.com/a/b?c=1#frag")).toBe("/a/b?c=1");
  });
});
