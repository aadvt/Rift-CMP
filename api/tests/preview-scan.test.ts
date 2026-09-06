/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { PREVIEW_NOTE, likelyNeedsConsent } from "@rift-cmp/shared";

/**
 * The preview scan's judgement, such as it is.
 *
 * The endpoint itself is not exercised here: it launches a browser against a
 * caller-chosen target, which belongs in the crawler's own tests rather than in
 * a unit suite. What is worth pinning is the part that produces a claim — the
 * heuristic — and the properties that keep it from overclaiming.
 */
describe("likelyNeedsConsent", () => {
  it("gates the categories that ordinarily require consent in the EU", () => {
    for (const category of ["analytics", "advertising", "marketing", "session_replay", "social"]) {
      expect(likelyNeedsConsent(category)).toBe(true);
    }
  });

  it("leaves an unknown category alone rather than guessing", () => {
    // The failure mode that matters is the permissive one: a category nobody
    // has classified must not be reported as needing consent, because a preview
    // that cries wolf about a CDN teaches people to ignore it.
    expect(likelyNeedsConsent("cdn")).toBe(false);
    expect(likelyNeedsConsent("unclassified")).toBe(false);
    expect(likelyNeedsConsent("something-nobody-has-catalogued")).toBe(false);
    expect(likelyNeedsConsent("")).toBe(false);
  });

  it("does not depend on how the scanner cased the category", () => {
    expect(likelyNeedsConsent("Analytics")).toBe(true);
    expect(likelyNeedsConsent("ADVERTISING")).toBe(true);
  });
});

describe("PREVIEW_NOTE", () => {
  it("says a preview is partial, so a count is never read as the whole site", () => {
    // This travels on the response rather than living in the page, so the
    // limits follow the numbers wherever they are rendered. A version of it
    // that dropped the caveat would let "3 trackers" be read as a total.
    expect(PREVIEW_NOTE).toMatch(/not the whole site/i);
    expect(PREVIEW_NOTE).toMatch(/few pages/i);
  });
});
