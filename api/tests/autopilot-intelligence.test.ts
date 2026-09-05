/**
 * Ordering the existing recommendations, and refusing to change them.
 *
 * This layer's whole job is to say what to look at first. The properties worth
 * pinning are the ones that stop it quietly becoming a second engine: the
 * deterministic recommendation must travel through untouched, and the order
 * must not depend on whether an API key happens to be configured.
 */
import { describe, expect, it } from "vitest";
import { buildAutopilotIntelligence } from "@/lib/autopilot-intelligence";
import type { AiAssistance } from "@/lib/ai/assist";
import type { DriftFinding, ShadowTracker, VendorRecommendation } from "@rift-cmp/shared";

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

function shadow(over: Partial<ShadowTracker> = {}): ShadowTracker {
  return {
    id: "ga",
    host: "google-analytics.com",
    vendor: "Google Analytics",
    category: "analytics",
    reason: "not_configured",
    severity: "medium",
    pages: [],
    destination_country: "US",
    crosses_border: true,
    confidence: "high",
    approved: false,
    purpose: null,
    policy_action: null,
    evidence: [],
    recommended_action: "Review it.",
    first_seen: null,
    last_seen: null,
    ...over,
  };
}

function drift(over: Partial<DriftFinding> = {}): DriftFinding {
  return {
    id: "added:ga",
    kind: "tracker_added",
    severity: "high",
    host: "Google Analytics",
    vendor: "Google Analytics",
    page: null,
    previous_state: null,
    current_state: "Observed",
    policy_version: 1,
    evidence: [],
    recommended_action: "Review it.",
    ...over,
  };
}

function assistance(over: Partial<AiAssistance> = {}): AiAssistance {
  return {
    provider: "test",
    model: "test-model",
    advisory: true,
    vendors: [
      {
        detector_id: "ga",
        suggested_category: "advertising",
        reasoning: "Looks like advertising to me.",
        confidence: 0.9,
        evidence_used: [],
        ambiguous: false,
      },
    ],
    explanation: { summary: "Two vendors need attention.", ambiguities: [], confidence: 0.6 },
    priority: [],
    ...over,
  };
}

const base = {
  siteId: "site_1",
  shadowTrackers: [] as ShadowTracker[],
  drift: [] as DriftFinding[],
  assistance: null,
  aiConfigured: false,
  now: new Date("2026-09-05T00:00:00Z"),
};

describe("the deterministic recommendation is carried, not replaced", () => {
  it("returns each recommendation unchanged", () => {
    const rec = recommendation();
    const out = buildAutopilotIntelligence({ ...base, recommendations: [rec] });

    expect(out.recommendations[0]?.recommendation).toBe(rec);
  });

  it("never applies anything by itself", () => {
    const out = buildAutopilotIntelligence({ ...base, recommendations: [recommendation()] });
    expect(out.requires_approval).toBe(true);
    expect(out.legal_advice).toBe(false);
  });
});

describe("ordering comes from evidence", () => {
  it("puts a blocked-but-running vendor above an ordinary one", () => {
    const out = buildAutopilotIntelligence({
      ...base,
      recommendations: [
        recommendation({ detector_id: "quiet", vendor_name: "Quiet Vendor" }),
        recommendation({ detector_id: "ga", vendor_name: "Google Analytics" }),
      ],
      shadowTrackers: [shadow({ severity: "critical", reason: "blocked_but_observed" })],
    });

    const first = out.recommendations[0]?.recommendation as VendorRecommendation;
    expect(first.vendor_name).toBe("Google Analytics");
    expect(out.recommendations[0]?.priority_reason).toMatch(/blocked/i);
  });

  it("raises something the engine would not decide", () => {
    const out = buildAutopilotIntelligence({
      ...base,
      recommendations: [
        recommendation({ detector_id: "decided", vendor_name: "Decided" }),
        recommendation({ detector_id: "undecided", vendor_name: "Undecided", recommended_action: "review" }),
      ],
    });

    const first = out.recommendations[0]?.recommendation as VendorRecommendation;
    expect(first.vendor_name).toBe("Undecided");
    expect(out.recommendations[0]?.priority_reason).toMatch(/needs a person/i);
  });

  it("counts breadth: the same vendor on more pages matters more", () => {
    const many = buildAutopilotIntelligence({
      ...base,
      recommendations: [recommendation()],
      pagesByVendor: new Map([["ga", ["/a", "/b", "/c", "/d"]]]),
    });
    const one = buildAutopilotIntelligence({
      ...base,
      recommendations: [recommendation()],
      pagesByVendor: new Map([["ga", ["/a"]]]),
    });

    expect(many.recommendations[0]?.priority).toBeGreaterThan(one.recommendations[0]?.priority ?? 0);
    expect(many.recommendations[0]?.priority_reason).toMatch(/4 pages/);
  });

  it("attaches the findings that produced the order", () => {
    const out = buildAutopilotIntelligence({
      ...base,
      recommendations: [recommendation()],
      shadowTrackers: [shadow()],
      drift: [drift()],
    });

    expect(out.recommendations[0]?.shadow_trackers).toHaveLength(1);
    expect(out.recommendations[0]?.drift).toHaveLength(1);
  });

  it("says so plainly when there is nothing against a vendor", () => {
    const out = buildAutopilotIntelligence({ ...base, recommendations: [recommendation()] });
    expect(out.recommendations[0]?.priority_reason).toMatch(/no findings/i);
  });
});

describe("AI is attached, never obeyed", () => {
  it("works with no assistance at all", () => {
    const out = buildAutopilotIntelligence({ ...base, recommendations: [recommendation()] });

    expect(out.ai_summary).toBeNull();
    expect(out.ai_configured).toBe(false);
    expect(out.recommendations[0]?.ai).toBeNull();
  });

  it("marks a model's note as advisory, with the model named", () => {
    const out = buildAutopilotIntelligence({
      ...base,
      recommendations: [recommendation()],
      assistance: assistance(),
      aiConfigured: true,
    });

    expect(out.recommendations[0]?.ai?.advisory).toBe(true);
    expect(out.recommendations[0]?.ai?.model).toBe("test-model");
    expect(out.ai_summary?.advisory).toBe(true);
  });

  it("does not let a model's opinion change the category the engine decided", () => {
    // The model here says "advertising" while the engine says "analytics". Both
    // are visible; only one is the recommendation.
    const out = buildAutopilotIntelligence({
      ...base,
      recommendations: [recommendation({ category: "analytics" })],
      assistance: assistance(),
      aiConfigured: true,
    });

    expect((out.recommendations[0]?.recommendation as VendorRecommendation).category).toBe("analytics");
    expect(out.recommendations[0]?.ai?.suggested_category).toBe("advertising");
  });

  it("produces the same order with and without a model", () => {
    // The property that matters most: a list that reordered itself when an API
    // key was added would not be one anybody could trust.
    const recommendations = [
      recommendation({ detector_id: "quiet", vendor_name: "Quiet Vendor" }),
      recommendation({ detector_id: "ga", vendor_name: "Google Analytics" }),
    ];
    const findings = [shadow({ severity: "critical" })];

    const without = buildAutopilotIntelligence({ ...base, recommendations, shadowTrackers: findings });
    const with_ = buildAutopilotIntelligence({
      ...base,
      recommendations,
      shadowTrackers: findings,
      assistance: assistance({ priority: [{ detector_id: "quiet", rank: 1, reasoning: "trust me" }] }),
      aiConfigured: true,
    });

    const names = (o: typeof without) =>
      o.recommendations.map((r) => (r.recommendation as VendorRecommendation).vendor_name);
    expect(names(with_)).toEqual(names(without));
  });

  it("reports that a provider is configured even when it said nothing useful", () => {
    const out = buildAutopilotIntelligence({
      ...base,
      recommendations: [recommendation()],
      assistance: null,
      aiConfigured: true,
    });

    // "Configured but silent" and "not configured" are different states and the
    // UI needs to tell them apart.
    expect(out.ai_configured).toBe(true);
    expect(out.ai_summary).toBeNull();
  });
});
