/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  recommend,
  type PreviewScanResult,
} from "../../rift-frontend-main/apps/dashboard/lib/preview-recommendations";

/**
 * What the landing page tells a stranger to do about their own site.
 *
 * These are the only claims Rift makes to somebody who has not signed up, made
 * from three pages of crawling and no declared markets — so what is worth
 * pinning is not the wording but the restraint: that a failed measurement
 * produces no advice, and that nothing here is phrased as an obligation.
 */
function scan(over: Partial<PreviewScanResult> = {}): PreviewScanResult {
  return {
    url: "https://example.com",
    scanned_at: new Date().toISOString(),
    duration_ms: 1000,
    summary: {
      pages_scanned: 3,
      cookies: 0,
      third_party_domains: 0,
      technologies: 0,
      likely_need_consent: 0,
      consent_ui_detected: false,
    },
    technologies: [],
    destinations: [],
    cookies: [],
    pages: [],
    limits: { truncated: false, note: "note" },
    legal_advice: false,
    ...over,
  };
}

const tracker = {
  name: "Google AdSense",
  category: "advertising",
  confidence: "medium" as const,
  destination_country: "US",
  crosses_border: true,
  likely_needs_consent: true,
};

describe("recommend", () => {
  it("says nothing about a site it found nothing on", () => {
    expect(recommend(scan())).toEqual([]);
  });

  it("leads with gating when tracking ran and no banner was seen", () => {
    const steps = recommend(scan({ technologies: [tracker] }));
    expect(steps[0]?.title).toMatch(/gate/i);
    expect(steps[0]?.tone).toBe("error");
  });

  it("asks whether the banner enforces when one is present", () => {
    const steps = recommend(
      scan({
        technologies: [tracker],
        summary: { ...scan().summary, consent_ui_detected: true },
      }),
    );
    // Not "you have a banner, you are fine" — the banner being present is the
    // reason to check, not the reason to stop.
    expect(steps[0]?.title).toMatch(/blocks anything/i);
  });

  it("refuses to advise on a crawl that finished no pages", () => {
    // The failure this guards: a slow site emits requests and cookies while no
    // page ever completes, which looks like a clean result and is not one.
    const steps = recommend(
      scan({
        summary: { ...scan().summary, pages_scanned: 0, third_party_domains: 9 },
        cookies: [{ name: "a", domain: "x.test", third_party: true }],
      }),
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]?.title).toMatch(/did not finish/i);
  });

  it("never states an obligation", () => {
    const steps = recommend(
      scan({
        technologies: [tracker],
        destinations: [{ host: "t.example", country: "US", crosses_border: true }],
        cookies: [{ name: "a", domain: "x.test", third_party: true }],
        limits: { truncated: true, note: "note" },
      }),
    );
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const text = `${step.title} ${step.body}`;
      // "must", "required to", "you are in breach" are claims about somebody's
      // legal position that a three-page crawl cannot support.
      expect(text).not.toMatch(/\byou must\b|\brequired to\b|\bin breach\b|\billegal\b|\bnon-compliant\b/i);
    }
  });

  it("keeps the list short enough to be read", () => {
    const steps = recommend(
      scan({
        technologies: [tracker],
        destinations: [{ host: "t.example", country: "US", crosses_border: true }],
        cookies: [{ name: "a", domain: "x.test", third_party: true }],
        summary: { ...scan().summary, third_party_domains: 12 },
        limits: { truncated: true, note: "note" },
      }),
    );
    expect(steps.length).toBeLessThanOrEqual(4);
  });
});
