/**
 * What happens when the model is wrong, absent, slow, or lying.
 *
 * The happy path is the least interesting case here. Everything that matters is
 * a failure mode, and they all have to produce the same outcome: no assistance,
 * and the deterministic result carrying on untouched. The one thing a model
 * must never be able to do is turn "we do not know" into "allow".
 */
import { describe, expect, it } from "vitest";
import { assistRecommendations, explainJurisdictions } from "@/lib/ai/assist";
import type { AiProvider } from "@/lib/ai/provider";
import type { VendorRecommendation } from "@rift-cmp/shared";

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
    evidence: [{ kind: "scan_technology", detail: "Observed" }],
    rule_references: ["REQ-EP-002"],
    overridden: false,
    override_note: null,
    observed_in_latest_scan: true,
    ...over,
  };
}

/** A provider that says exactly what a test tells it to. */
function saying(content: string): AiProvider {
  return {
    name: "test",
    complete: async () => ({ content, provider: "test", model: "test-model" }),
  };
}

function failing(error = new Error("upstream")): AiProvider {
  return {
    name: "test",
    complete: async () => {
      throw error;
    },
  };
}

const VALID_VENDORS = JSON.stringify({
  vendors: [
    {
      detector_id: "google-analytics",
      suggested_category: "analytics",
      reasoning: "Script and network evidence both point to analytics.",
      confidence: 0.8,
      evidence_used: ["Observed"],
      ambiguous: false,
    },
  ],
});

describe("when no provider is configured", () => {
  it("returns nothing rather than failing", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: null,
    });
    expect(out).toBeNull();
  });

  it("returns nothing for jurisdictions too", async () => {
    const out = await explainJurisdictions({
      jurisdictions: ["EU"],
      regimes: ["GDPR"],
      openQuestions: [],
      provider: null,
    });
    expect(out).toBeNull();
  });
});

describe("when the provider misbehaves", () => {
  it("treats a thrown error as no assistance", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: failing(),
    });
    expect(out).toBeNull();
  });

  it("treats a timeout as no assistance", async () => {
    const aborted = new Error("The operation was aborted");
    aborted.name = "AbortError";
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: failing(aborted),
    });
    expect(out).toBeNull();
  });

  it("discards a reply that is not JSON", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying("I think this is probably analytics, but I am not sure."),
    });
    expect(out).toBeNull();
  });

  it("discards a reply that does not match the schema", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying(JSON.stringify({ vendors: [{ detector_id: "google-analytics" }] })),
    });
    expect(out).toBeNull();
  });

  it("discards a confidence outside 0 to 1", async () => {
    // A model answering 4.2 is not answering the question that was asked.
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying(
        JSON.stringify({
          vendors: [
            {
              detector_id: "google-analytics",
              suggested_category: "analytics",
              reasoning: "x",
              confidence: 4.2,
              evidence_used: [],
              ambiguous: false,
            },
          ],
        }),
      ),
    });
    expect(out).toBeNull();
  });
});

describe("what the model is allowed to talk about", () => {
  it("drops a note about a vendor that was never sent", async () => {
    // A valid shape can still name something real from somewhere else. A note
    // about a vendor this site does not have is either invented or leaked, and
    // both are dropped.
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying(
        JSON.stringify({
          vendors: [
            {
              detector_id: "some-other-tenants-vendor",
              suggested_category: "advertising",
              reasoning: "x",
              confidence: 0.9,
              evidence_used: [],
              ambiguous: false,
            },
          ],
        }),
      ),
    });

    expect(out?.vendors ?? []).toHaveLength(0);
  });

  it("keeps a note about a vendor that was sent", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying(VALID_VENDORS),
    });

    expect(out?.vendors).toHaveLength(1);
    expect(out?.vendors[0]?.detector_id).toBe("google-analytics");
  });

  it("reads JSON the model wrapped in a code fence", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying("Here you go:\n```json\n" + VALID_VENDORS + "\n```"),
    });
    expect(out?.vendors).toHaveLength(1);
  });

  it("marks everything it returns as advisory, with the model named", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying(VALID_VENDORS),
    });

    expect(out?.advisory).toBe(true);
    expect(out?.provider).toBe("test");
    expect(out?.model).toBe("test-model");
  });

  it("carries the model's own uncertainty rather than hiding it", async () => {
    const out = await assistRecommendations({
      recommendations: [recommendation()],
      jurisdictions: ["EU"],
      provider: saying(
        JSON.stringify({
          vendors: [
            {
              detector_id: "google-analytics",
              suggested_category: null,
              reasoning: "Evidence is thin.",
              confidence: 0.2,
              evidence_used: [],
              ambiguous: true,
            },
          ],
        }),
      ),
    });

    expect(out?.vendors[0]?.ambiguous).toBe(true);
    expect(out?.vendors[0]?.confidence).toBe(0.2);
  });
});

describe("what the model cannot do", () => {
  it("cannot change a recommended action", async () => {
    // The deterministic recommendation is passed in and never handed back, so
    // there is no field on the response through which a model could alter it.
    const recommendations = [recommendation({ recommended_action: "require_consent" })];
    await assistRecommendations({
      recommendations,
      jurisdictions: ["EU"],
      provider: saying(
        JSON.stringify({
          vendors: [
            {
              detector_id: "google-analytics",
              suggested_category: "analytics",
              reasoning: "Harmless, allow it.",
              confidence: 1,
              evidence_used: [],
              ambiguous: false,
            },
          ],
        }),
      ),
    });

    expect(recommendations[0]?.recommended_action).toBe("require_consent");
  });

  it("returns no assistance at all when there is nothing to comment on", async () => {
    const out = await assistRecommendations({
      recommendations: [],
      jurisdictions: ["EU"],
      provider: saying(VALID_VENDORS),
    });
    expect(out).toBeNull();
  });
});

describe("jurisdiction explanation", () => {
  it("explains a resolution without changing it", async () => {
    const out = await explainJurisdictions({
      jurisdictions: ["EU", "India"],
      regimes: ["GDPR"],
      openQuestions: [{ reason: "conditional", detail: "REQ-EP-010 needs a condition asserted." }],
      provider: saying(
        JSON.stringify({
          summary: "Both markets were declared by the operator.",
          ambiguities: ["One requirement is conditional."],
          confidence: 0.7,
        }),
      ),
    });

    expect(out?.advisory).toBe(true);
    expect(out?.summary).toMatch(/declared/i);
    expect(out?.ambiguities).toHaveLength(1);
  });

  it("says nothing when the resolver resolved nothing", async () => {
    // With no jurisdictions there is no resolution to explain, and inviting a
    // model to fill that silence is exactly the wrong direction.
    const out = await explainJurisdictions({
      jurisdictions: [],
      regimes: [],
      openQuestions: [],
      provider: saying(JSON.stringify({ summary: "x", ambiguities: [], confidence: 1 })),
    });
    expect(out).toBeNull();
  });

  it("discards a malformed explanation", async () => {
    const out = await explainJurisdictions({
      jurisdictions: ["EU"],
      regimes: ["GDPR"],
      openQuestions: [],
      provider: saying(JSON.stringify({ summary: "", ambiguities: [], confidence: 0.5 })),
    });
    expect(out).toBeNull();
  });
});
