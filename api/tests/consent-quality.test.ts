/**
 * The score, and the things it refuses to reward.
 *
 * A posture score is easy to make and easy to make useless. Two properties
 * matter more than the arithmetic:
 *
 *   It must not reward a worse consent experience. A site with no banner
 *   accepts everything, and any score containing acceptance rate would rise as
 *   the product got worse.
 *
 *   A missing input must not read as a failure. "Nobody has scanned this yet"
 *   and "this site has unresolved trackers" are different problems with
 *   different fixes, and scoring them the same sends people to the wrong one.
 */
import { describe, expect, it } from "vitest";
import { computeConsentQuality, type QualityInput } from "@/lib/consent-quality";
import { QUALITY_WEIGHTS } from "@rift-cmp/shared";
import type { VendorRecommendation } from "@rift-cmp/shared";

function recommendation(over: Partial<VendorRecommendation> = {}): VendorRecommendation {
  return {
    detector_id: "ga",
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

const NOW = new Date("2026-09-05T00:00:00Z");

/** A site doing everything right, as a baseline to degrade from. */
function healthy(over: Partial<QualityInput> = {}): QualityInput {
  return {
    siteId: "site_1",
    declaredPurposes: 2,
    undeclaredPurposes: 0,
    approved: [recommendation()],
    proposed: [recommendation()],
    hasApprovedPolicy: true,
    enforcementMode: "enforce",
    enforcementRules: 3,
    lastCompletedScanAt: NOW,
    shadowTrackers: [],
    drift: [],
    jurisdictions: ["EU"],
    decisions: 10,
    decisionsWithProof: 10,
    now: NOW,
    ...over,
  };
}

describe("the shape of the model", () => {
  it("weights sum to 100", () => {
    const total = Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it("scores a well-configured site highly", () => {
    const out = computeConsentQuality(healthy());
    expect(out.score).toBe(100);
    expect(out.band).toBe("strong");
  });

  it("never claims to be a legal determination", () => {
    expect(computeConsentQuality(healthy()).legal_advice).toBe(false);
  });
});

describe("explainability", () => {
  it("gives every component a measurement a person can check", () => {
    const out = computeConsentQuality(healthy());
    for (const c of out.components) {
      expect(c.detail.length).toBeGreaterThan(10);
      expect(c.weight).toBe(QUALITY_WEIGHTS[c.id]);
    }
  });

  it("names what would raise a component that is not full marks", () => {
    const out = computeConsentQuality(healthy({ hasApprovedPolicy: false, approved: [] }));
    const coverage = out.components.find((c) => c.id === "consent_coverage");

    expect(coverage?.earned).toBe(0);
    expect(coverage?.remedy).toMatch(/accept/i);
  });

  it("offers no remedy for something already right", () => {
    const out = computeConsentQuality(healthy());
    expect(out.components.every((c) => c.remedy === null)).toBe(true);
  });
});

describe("absent input is set aside, not failed", () => {
  it("excludes tracker resolution when nothing has been found", () => {
    const out = computeConsentQuality(healthy({ proposed: [], approved: [] }));
    const resolution = out.components.find((c) => c.id === "tracker_resolution");

    expect(resolution?.applicable).toBe(false);
    expect(out.not_applicable).toContain("tracker_resolution");
    // Excluded from the denominator, so it cannot drag the score down for a
    // problem the site does not have.
    expect(out.weight_considered).toBe(100 - QUALITY_WEIGHTS.tracker_resolution);
  });

  it("excludes proof completeness when nobody has decided anything", () => {
    const out = computeConsentQuality(healthy({ decisions: 0, decisionsWithProof: 0 }));
    expect(out.not_applicable).toContain("proof_completeness");
  });

  it("says which components were set aside, so a thin score cannot hide", () => {
    const out = computeConsentQuality(healthy({ proposed: [], approved: [], decisions: 0, decisionsWithProof: 0 }));
    expect(out.not_applicable.length).toBe(2);
    expect(out.weight_considered).toBeLessThan(100);
  });
});

describe("what lowers the score", () => {
  it("penalises having no approved configuration", () => {
    const out = computeConsentQuality(healthy({ hasApprovedPolicy: false, approved: [] }));
    expect(out.score).toBeLessThan(100);
    expect(out.components.find((c) => c.id === "consent_coverage")?.earned).toBe(0);
  });

  it("penalises a purpose the configuration needs and nobody declared", () => {
    const out = computeConsentQuality(healthy({ undeclaredPurposes: 2 }));
    const completeness = out.components.find((c) => c.id === "policy_completeness");

    expect(completeness?.earned).toBeLessThan(QUALITY_WEIGHTS.policy_completeness);
    expect(completeness?.remedy).toMatch(/declare/i);
  });

  it("gives observe mode partial credit rather than none", () => {
    // Scoring observe as zero would push operators straight to enforce, which
    // is the single change most likely to break a checkout.
    const off = computeConsentQuality(healthy({ enforcementMode: "off" }));
    const observing = computeConsentQuality(healthy({ enforcementMode: "observe" }));
    const enforcing = computeConsentQuality(healthy());

    expect(off.score).toBeLessThan(observing.score);
    expect(observing.score).toBeLessThan(enforcing.score);
  });

  it("weights one critical shadow tracker above several trivial ones", () => {
    const critical = computeConsentQuality(
      healthy({ shadowTrackers: [{ severity: "critical" }] as never }),
    );
    const trivial = computeConsentQuality(
      healthy({ shadowTrackers: [{ severity: "low" }, { severity: "low" }, { severity: "low" }] as never }),
    );

    expect(critical.score).toBeLessThan(trivial.score);
  });

  it("decays with the age of the last scan", () => {
    const fresh = computeConsentQuality(healthy());
    const old = computeConsentQuality(
      healthy({ lastCompletedScanAt: new Date("2026-08-15T00:00:00Z") }),
    );
    const never = computeConsentQuality(healthy({ lastCompletedScanAt: null }));

    expect(old.score).toBeLessThan(fresh.score);
    expect(never.score).toBeLessThan(old.score);
    expect(never.components.find((c) => c.id === "scanner_freshness")?.detail).toMatch(/never been scanned/i);
  });

  it("penalises declaring no markets, because then nothing resolves", () => {
    const out = computeConsentQuality(healthy({ jurisdictions: [] }));
    expect(out.components.find((c) => c.id === "jurisdiction_coverage")?.earned).toBe(0);
  });
});

describe("what the score deliberately ignores", () => {
  it("has no component derived from acceptance rate", () => {
    // A site with no banner accepts 100%. Any score containing acceptance would
    // rise as the consent experience got worse.
    const ids = computeConsentQuality(healthy()).components.map((c) => c.id);
    expect(ids.join(" ")).not.toMatch(/accept/i);
  });

  it("cannot be raised by recording more decisions", () => {
    const few = computeConsentQuality(healthy({ decisions: 2, decisionsWithProof: 2 }));
    const many = computeConsentQuality(healthy({ decisions: 2000, decisionsWithProof: 2000 }));
    expect(few.score).toBe(many.score);
  });
});

describe("bands", () => {
  it("describes a broken site as weak and a healthy one as strong", () => {
    const broken = computeConsentQuality(
      healthy({
        hasApprovedPolicy: false,
        approved: [],
        undeclaredPurposes: 3,
        enforcementMode: "off",
        lastCompletedScanAt: null,
        jurisdictions: [],
        shadowTrackers: [{ severity: "critical" }, { severity: "high" }] as never,
      }),
    );

    expect(broken.band).toBe("weak");
    expect(computeConsentQuality(healthy()).band).toBe("strong");
  });
});
