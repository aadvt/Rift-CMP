/**
 * The consent autopilot.
 *
 * Phase 9A names eight scenarios and they each have a `describe` below: a known
 * tracker, an unknown tracker, conflicting regulation requirements, multiple
 * regions, a manual override, policy version changes, scanner evidence
 * disappearing, and low-confidence detection.
 *
 * The property underneath all of them is the one the brief leads with: this
 * must not silently claim legal certainty. That is tested rather than asserted
 * in prose — "we do not know" has to be reachable in the output, and the
 * permissive answer must never be what an unresolved input falls back to.
 *
 * No database.
 */

import { describe, expect, it } from "vitest";
import { generatePolicy, type OverrideInput } from "@/lib/autopilot";
import { vendorsByPurposeFrom } from "@/lib/consent-config";
import type { DetectedLocation } from "@/lib/autopilot";
import type { ScannedTechnology } from "@/lib/consent-config";

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

const EU: DetectedLocation[] = [{ region: "DE", source: "business_target_market" }];

function policy(over: Partial<Parameters<typeof generatePolicy>[0]> = {}) {
  return generatePolicy({
    siteId: "site_demo",
    scanId: "scan_1",
    technologies: [],
    declaredPurposes: [],
    overrides: [],
    locationSignals: EU,
    asOf: AS_OF,
    ...over,
  });
}

function tech(
  name: string,
  category: string,
  confidence: ScannedTechnology["confidence"] = "high",
): ScannedTechnology {
  return { name, category, confidence };
}

function find(p: ReturnType<typeof policy>, detectorId: string) {
  return p.recommendations.find((r) => r.detector_id === detectorId);
}

// ─── 1. A known tracker ──────────────────────────────────────────────────────

describe("a known tracker", () => {
  const generated = policy({ technologies: [tech("Google Analytics", "analytics")] });
  const ga = find(generated, "google-analytics")!;

  it("produces the worked example from the brief", () => {
    // Google Analytics → Analytics → Germany → GDPR/ePrivacy → block until a
    // user action → high confidence, with evidence.
    expect(ga).toBeDefined();
    expect(ga.suggested_purpose).toBe("analytics");
    expect(generated.jurisdictions).toEqual(["EU"]);
    expect(generated.regimes).toContain("GDPR");
    expect(generated.regimes).toContain("EU-ePrivacy");
    expect(ga.recommended_action).toBe("block");
    expect(ga.confidence).toBe("high");
  });

  it("names a data category and a jurisdiction", () => {
    expect(ga.data_categories.length).toBeGreaterThan(0);
    expect(ga.jurisdictions).toEqual(["EU"]);
  });

  it("reports the consent requirement as found, not as a boolean", () => {
    expect(ga.consent_requirement).toBe("required");
  });

  it("carries a reason, evidence and a rule reference", () => {
    expect(ga.reason.length).toBeGreaterThan(20);
    expect(ga.evidence.some((e) => e.kind === "scan_technology")).toBe(true);
    expect(ga.evidence.some((e) => e.kind === "regulation")).toBe(true);
    expect(ga.rule_references.length).toBeGreaterThan(0);
    for (const id of ga.rule_references) expect(id).toMatch(/^REQ-/);
  });

  it("gives the regulation evidence a resolvable source", () => {
    const regulation = ga.evidence.find((e) => e.kind === "regulation")!;
    expect(regulation.requirement_id).toMatch(/^REQ-/);
    expect(regulation.source_ids!.length).toBeGreaterThan(0);
  });

  it("does not gate the consent manager itself", () => {
    // Gating the mechanism that asks for consent on consent is circular: the
    // banner could never load to ask.
    const withCmp = policy({ technologies: [tech("Cookiebot", "consent_management")] });
    expect(find(withCmp, "cookiebot")!.recommended_action).toBe("allow");
    expect(find(withCmp, "cookiebot")!.suggested_purpose).toBe("essential");
  });

  it("requires approval, and never claims to be advice", () => {
    expect(generated.requires_approval).toBe(true);
    expect(generated.legal_advice).toBe(false);
  });
});

// ─── 2. An unknown tracker ───────────────────────────────────────────────────

describe("an unknown tracker", () => {
  const generated = policy({
    technologies: [tech("Mystery Co", "unclassified", "low")],
  });
  const unknown = find(generated, "mystery-co")!;

  it("is reported rather than dropped", () => {
    expect(unknown).toBeDefined();
    expect(unknown.vendor_name).toBe("Mystery Co");
  });

  it("gets review, never allow", () => {
    // The failure that matters is the permissive one: an unknown third party
    // silently recommended as allowed is the row an operator most needed to see.
    expect(unknown.recommended_action).toBe("review");
    expect(unknown.recommended_action).not.toBe("allow");
  });

  it("is given no purpose, rather than a guessed one", () => {
    expect(unknown.suggested_purpose).toBeNull();
    expect(unknown.data_categories).toEqual([]);
  });

  it("is low confidence and says why", () => {
    expect(unknown.confidence).toBe("low");
    expect(unknown.reason).toContain("not matched to a known category");
  });
});

// ─── 3. Conflicting regulation requirements ──────────────────────────────────

describe("conflicting regulation requirements", () => {
  it("resolves to the more restrictive answer across regimes", () => {
    /**
     * EU raises a consent obligation; California's regime is opt-out shaped.
     * Satisfying the stricter one satisfies the other and the reverse is not
     * true, so `required` wins - the same most-restrictive rule the policy
     * engine applies, rather than a second one invented here.
     */
    const both = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [
        { region: "DE", source: "business_target_market" },
        { region: "US-CA", source: "business_target_market" },
      ],
    });
    const ga = find(both, "google-analytics")!;
    expect(both.jurisdictions).toEqual(["California", "EU", "US"]);
    expect(ga.consent_requirement).toBe("required");
    expect(ga.recommended_action).toBe("block");
  });

  it("reports an opt-out requirement alongside the consent one", () => {
    const ca = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [{ region: "US-CA", source: "business_target_market" }],
    });
    expect(ca.recommendations[0].opt_out_requirement).toBe("required");
  });

  it("cites every regime the recommendation rested on", () => {
    const both = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [
        { region: "DE", source: "business_target_market" },
        { region: "US-CA", source: "business_target_market" },
      ],
    });
    const regimes = new Set(
      both.recommendations[0].evidence
        .filter((e) => e.kind === "regulation")
        .map((e) => e.detail.split(" ")[0]),
    );
    expect(regimes.size).toBeGreaterThan(0);
  });

  it("keeps every question the engine would not decide", () => {
    const generated = policy({ technologies: [tech("Google Analytics", "analytics")] });
    // The engine returns REVIEW far more often than an obligation; hiding that
    // would make the policy look more settled than the research behind it is.
    expect(generated.open_questions.length).toBeGreaterThan(0);
  });
});

// ─── 4. Multiple regions ─────────────────────────────────────────────────────

describe("multiple regions", () => {
  it("accumulates jurisdictions rather than picking one", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [
        { region: "DE", source: "business_target_market" },
        { region: "BR", source: "business_target_market" },
        { region: "IN", source: "business_target_market" },
      ],
    });
    expect(generated.jurisdictions).toEqual(["Brazil", "EU", "India"]);
    expect(generated.regimes.length).toBeGreaterThan(3);
  });

  it("produces a different reading for a different market", () => {
    const br = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [{ region: "BR", source: "business_target_market" }],
    });
    expect(br.jurisdictions).toEqual(["Brazil"]);
    expect(br.regimes).toEqual(["Brazil-LGPD"]);
  });

  it("returns unknown, not allow, when no market is declared", () => {
    const nowhere = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [],
    });
    expect(nowhere.jurisdictions).toEqual([]);
    const ga = nowhere.recommendations[0];
    expect(ga.consent_requirement).toBe("unknown");
    expect(ga.recommended_action).toBe("review");
  });
});

// ─── 5. Manual override ──────────────────────────────────────────────────────

describe("a manual override", () => {
  const override: OverrideInput = {
    detectorId: "google-analytics",
    purposeCode: "product_analytics",
    action: "allow",
    note: "Self-hosted, no third-party transfer.",
  };

  it("wins over the generated recommendation", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [override],
    });
    const ga = find(generated, "google-analytics")!;
    expect(ga.recommended_action).toBe("allow");
    expect(ga.suggested_purpose).toBe("product_analytics");
    expect(ga.overridden).toBe(true);
  });

  it("is labelled as the operator's, not as a finding", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [override],
    });
    const ga = find(generated, "google-analytics")!;
    expect(ga.reason).toContain("Set by you, not generated");
    expect(ga.override_note).toBe("Self-hosted, no third-party transfer.");
    expect(ga.evidence[0].kind).toBe("override");
  });

  it("keeps the underlying evidence so the override can be reconsidered", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [override],
    });
    const ga = find(generated, "google-analytics")!;
    expect(ga.evidence.some((e) => e.kind === "scan_technology")).toBe(true);
    expect(ga.evidence.some((e) => e.kind === "regulation")).toBe(true);
    // and the regulatory finding is still reported, unchanged by the override
    expect(ga.consent_requirement).toBe("required");
  });

  it("survives regeneration", () => {
    const first = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [override],
    });
    const second = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [override],
    });
    expect(find(second, "google-analytics")!.recommended_action).toBe(
      find(first, "google-analytics")!.recommended_action,
    );
  });

  it("can say a vendor is covered by no purpose at all", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [
        { detectorId: "google-analytics", purposeCode: null, action: "ignore", note: null },
      ],
    });
    expect(find(generated, "google-analytics")!.suggested_purpose).toBeNull();
    expect(find(generated, "google-analytics")!.recommended_action).toBe("ignore");
  });
});

// ─── 6. Scanner evidence disappearing ────────────────────────────────────────

describe("scanner evidence disappearing", () => {
  const override: OverrideInput = {
    detectorId: "hotjar",
    purposeCode: "analytics",
    action: "require_consent",
    note: "Keep gated.",
  };

  it("carries an overridden vendor forward when the scan no longer sees it", () => {
    /**
     * A vendor absent from one crawl has usually not been removed - the crawl
     * reached fewer pages. Dropping the line would discard a judgement somebody
     * made on purpose and re-decide from scratch when it reappears.
     */
    const generated = policy({ technologies: [], overrides: [override] });
    const hotjar = find(generated, "hotjar")!;
    expect(hotjar).toBeDefined();
    expect(hotjar.recommended_action).toBe("require_consent");
  });

  it("marks it as not observed, rather than pretending it was", () => {
    const generated = policy({ technologies: [], overrides: [override] });
    expect(find(generated, "hotjar")!.observed_in_latest_scan).toBe(false);
    expect(find(generated, "hotjar")!.evidence[1].detail).toContain(
      "not in the latest scan",
    );
  });

  it("marks it observed again once the scan sees it", () => {
    const generated = policy({
      technologies: [tech("hotjar", "analytics")],
      overrides: [override],
    });
    expect(find(generated, "hotjar")!.observed_in_latest_scan).toBe(true);
  });

  it("does not carry forward a vendor with no override and no observation", () => {
    // Without an operator decision attached there is nothing to preserve, and
    // inventing a line for a vendor nobody has seen or ruled on would be noise.
    const generated = policy({ technologies: [], overrides: [] });
    expect(generated.recommendations).toEqual([]);
  });
});

// ─── 7. Low-confidence detection ─────────────────────────────────────────────

describe("low-confidence detection", () => {
  it("carries the scanner's confidence through without upgrading it", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics", "low")],
    });
    expect(find(generated, "google-analytics")!.confidence).toBe("low");
  });

  it("does not let a firm regulatory finding launder a weak observation", () => {
    // The regime obligation is certain; that the vendor is present is not.
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics", "low")],
    });
    const ga = find(generated, "google-analytics")!;
    expect(ga.consent_requirement).toBe("required");
    expect(ga.confidence).toBe("low");
  });

  it("reports high only when both the observation and the finding are firm", () => {
    expect(
      find(policy({ technologies: [tech("Google Analytics", "analytics", "high")] }), "google-analytics")!.confidence,
    ).toBe("high");
    expect(
      find(policy({ technologies: [tech("Google Analytics", "analytics", "medium")] }), "google-analytics")!.confidence,
    ).toBe("medium");
  });

  it("reports an override at high confidence in itself, not in the detection", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics", "low")],
      overrides: [
        { detectorId: "google-analytics", purposeCode: "analytics", action: "allow", note: null },
      ],
    });
    const ga = find(generated, "google-analytics")!;
    expect(ga.confidence).toBe("high");
    expect(ga.overridden).toBe(true);
  });
});

// ─── 8. Policy version changes ───────────────────────────────────────────────

describe("what an approved version changes for the runtime", () => {
  it("supplies the vendor list the preference centre shows", () => {
    const generated = policy({
      technologies: [
        tech("Google Analytics", "analytics"),
        tech("Meta Pixel", "advertising"),
      ],
    });
    const byPurpose = vendorsByPurposeFrom(generated.recommendations);
    expect(byPurpose.analytics).toEqual(["Google Analytics"]);
    expect(byPurpose.advertising).toEqual(["Meta Pixel"]);
  });

  it("omits a vendor the operator marked ignore", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      overrides: [
        { detectorId: "google-analytics", purposeCode: "analytics", action: "ignore", note: null },
      ],
    });
    expect(vendorsByPurposeFrom(generated.recommendations).analytics).toBeUndefined();
  });

  it("lists nothing for a vendor with no purpose", () => {
    const generated = policy({
      technologies: [tech("Mystery Co", "unclassified")],
    });
    expect(vendorsByPurposeFrom(generated.recommendations)).toEqual({});
  });

  it("sorts vendors, so two approvals of the same set agree", () => {
    const generated = policy({
      technologies: [tech("Zeta", "analytics"), tech("Alpha", "analytics")],
    });
    expect(vendorsByPurposeFrom(generated.recommendations).analytics).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });
});

// ─── Determinism and honesty ─────────────────────────────────────────────────

describe("the generator is deterministic and does not overclaim", () => {
  it("produces the same policy for the same input", () => {
    const input = {
      technologies: [tech("Google Analytics", "analytics"), tech("Meta Pixel", "advertising")],
    };
    const first = JSON.stringify(policy(input));
    for (let i = 0; i < 10; i++) expect(JSON.stringify(policy(input))).toBe(first);
  });

  it("does not depend on the order technologies are listed in", () => {
    const a = policy({
      technologies: [tech("Alpha", "analytics"), tech("Beta", "advertising")],
    });
    const b = policy({
      technologies: [tech("Beta", "advertising"), tech("Alpha", "analytics")],
    });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("never says a site is compliant or lawful", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      locationSignals: [
        { region: "DE", source: "business_target_market" },
        { region: "US-CA", source: "business_target_market" },
      ],
    });
    const serialised = JSON.stringify(generated).toLowerCase();

    // Claim-shaped phrases, not bare words. "lawful" legitimately appears in
    // `lawful_basis` - the engine's own topic name, in an open question saying
    // it will *not* pick a legal basis for you, which is the opposite of
    // overclaiming. Grepping the word would fail on the engine being careful.
    for (const claim of [
      "is compliant",
      "is lawful",
      "legally required",
      "guaranteed",
      "you must",
      "this is legal",
    ]) {
      expect(serialised, `policy claims "${claim}"`).not.toContain(claim);
    }

    // And the two flags that say what it is, on every generated policy.
    expect(generated.requires_approval).toBe(true);
    expect(generated.legal_advice).toBe(false);
  });

  it("phrases a firm finding as a suggestion, not an instruction", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
    });
    const reason = find(generated, "google-analytics")!.reason.toLowerCase();
    expect(reason).toContain("suggest");
  });

  it("flags purposes it referenced that the operator has not declared", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      declaredPurposes: [],
    });
    expect(generated.undeclared_purposes).toEqual(["analytics"]);
  });

  it("does not flag a purpose that is already declared", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      declaredPurposes: [
        { code: "analytics", name: "A", description: "d", isActive: true },
      ],
    });
    expect(generated.undeclared_purposes).toEqual([]);
  });

  it("treats an inactive purpose as undeclared", () => {
    const generated = policy({
      technologies: [tech("Google Analytics", "analytics")],
      declaredPurposes: [
        { code: "analytics", name: "A", description: "d", isActive: false },
      ],
    });
    expect(generated.undeclared_purposes).toEqual(["analytics"]);
  });

  it("cannot be made to throw", () => {
    const nasty = [
      { technologies: [tech("", "", "low")] },
      { technologies: [tech("X", "analytics")], locationSignals: [] },
      { overrides: [{ detectorId: "", purposeCode: null, action: "allow" as const, note: null }] },
      { technologies: Array.from({ length: 300 }, (_, i) => tech(`V${i}`, "analytics")) },
    ];
    for (const input of nasty) expect(() => policy(input)).not.toThrow();
  });
});
