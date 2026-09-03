/**
 * Jurisdiction resolution.
 *
 * The phase brief names ten scenarios. Each has its own test below, named after
 * the brief so the phase can be checked off against the file:
 *
 *   India · EU · California · Brazil · overlapping jurisdictions ·
 *   unknown location · low-confidence location · conflicting signals ·
 *   missing location · configured target market vs detected location
 *
 * Then the constraints, which matter more than the scenarios: never assume one
 * law applies, never treat an address as a residence, keep confidence explicit,
 * keep the rules versioned, and keep legal determination away from geolocation.
 *
 * No database.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_JURISDICTION_RULES,
  WEBSITE_OPERATOR_ROLES,
  DEFAULT_SOURCE_CONFIDENCE,
  SOURCE_IS_RESIDENCE_CLAIM,
  looksLikeIpAddress,
  normaliseRegion,
  resolveContext,
  resolveJurisdictions,
  type ActivityContext,
  type DetectedLocation,
  type JurisdictionRules,
  type VisitorContext,
} from "@rift-cmp/policy";

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

/** An IP-derived observation, the weakest thing anyone actually uses. */
function geo(region: string): DetectedLocation {
  return { region, source: "ip_geolocation" };
}

function visitor(over: Partial<VisitorContext> = {}): VisitorContext {
  return { signals: [], ...over };
}

const ACTIVITY: ActivityContext = {
  actors: ["determines_purpose"],
  asOf: AS_OF,
};

// ─── The named scenarios ─────────────────────────────────────────────────────

describe("the scenarios the brief names", () => {
  it("India", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("IN")] }));
    expect(r.jurisdictions).toEqual(["India"]);
    expect(r.regimes).toEqual(["India-DPDP-Act", "India-DPDP-Rules"]);
  });

  it("EU, from any member state", () => {
    for (const code of ["DE", "FR", "IE", "PL", "MT"]) {
      const r = resolveJurisdictions(visitor({ signals: [geo(code)] }));
      expect(r.jurisdictions, code).toEqual(["EU"]);
      expect(r.regimes, code).toContain("GDPR");
      // ePrivacy comes along with the GDPR for an EU visitor, which is the
      // "relevant ePrivacy context" the brief's worked example asks for.
      expect(r.regimes, code).toContain("EU-ePrivacy");
    }
  });

  it("California, which also carries the generic US state model", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("US-CA")] }));
    expect(r.jurisdictions).toEqual(["California", "US"]);
    expect(r.regimes).toContain("California-CCPA-CPRA");
    // The generic US state model is in scope but rests on derived authority, so
    // it is reported separately - the evaluator holds it back unless asked.
    expect(r.regimes).not.toContain("US-State-Model");
    expect(r.derivedRegimes).toEqual(["US-State-Model"]);
  });

  it("Brazil", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("BR")] }));
    expect(r.jurisdictions).toEqual(["Brazil"]);
    expect(r.regimes).toEqual(["Brazil-LGPD"]);
  });

  it("overlapping jurisdictions", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [
          geo("DE"),
          { region: "IN", source: "business_target_market" },
          { region: "BR", source: "business_target_market" },
        ],
      }),
    );
    expect(r.jurisdictions).toEqual(["Brazil", "EU", "India"]);
    expect(r.regimes.length).toBeGreaterThan(3);
  });

  it("unknown location: a region code nothing maps", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("JP")] }));
    expect(r.jurisdictions).toEqual([]);
    expect(r.reasons.some((x) => x.kind === "region_unmapped")).toBe(true);
    // "Not carried" is not "nothing applies", and the reason says so.
    expect(r.reasons.find((x) => x.kind === "region_unmapped")!.detail).toMatch(
      /carries no requirements|not carried/i,
    );
  });

  it("low-confidence location still contributes", () => {
    const r = resolveJurisdictions(
      visitor({ signals: [{ region: "DE", source: "request_context" }] }),
    );
    // The jurisdiction is NOT dropped for being weakly evidenced.
    expect(r.jurisdictions).toEqual(["EU"]);
    expect(r.confidenceByJurisdiction.EU).toBe("low");
    expect(r.overallConfidence).toBe("low");
  });

  it("conflicting signals keep both jurisdictions", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [geo("DE"), { region: "IN", source: "user_declared" }],
      }),
    );
    expect(r.hasConflictingSignals).toBe(true);
    expect(r.jurisdictions).toEqual(["EU", "India"]);
    expect(r.reasons.some((x) => x.kind === "signals_disagree")).toBe(true);
  });

  it("missing location resolves nothing, and says why", () => {
    const r = resolveJurisdictions(visitor());
    expect(r.jurisdictions).toEqual([]);
    expect(r.overallConfidence).toBeNull();
    expect(r.reasons.some((x) => x.kind === "no_signals")).toBe(true);
  });

  it("configured target market applies even where the visitor is not", () => {
    /**
     * The case that most needs to work. A business offering into the EU is
     * reached by EU law for those users whatever an address says, so a target
     * market is not a fallback for a failed lookup - it is an independent
     * ground, and it stands alongside the detected location rather than
     * competing with it.
     */
    const r = resolveJurisdictions(
      visitor({
        signals: [geo("US-CA"), { region: "DE", source: "business_target_market" }],
      }),
    );
    expect(r.jurisdictions).toEqual(["California", "EU", "US"]);
    expect(r.confidenceByJurisdiction.EU).toBe("high");
    expect(r.confidenceByJurisdiction.California).toBe("medium");
  });

  it("a target market answers even when the visitor is entirely unknown", () => {
    const r = resolveJurisdictions(
      visitor({ signals: [{ region: "DE", source: "business_target_market" }] }),
    );
    expect(r.jurisdictions).toEqual(["EU"]);
    expect(r.overallConfidence).toBe("high");
  });
});

// ─── Never assume exactly one law applies ────────────────────────────────────

describe("never assumes exactly one law applies", () => {
  it("accumulates rather than ranking, so no signal can win outright", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [
          { region: "IN", source: "user_declared" }, // highest confidence
          geo("DE"), // medium
          { region: "BR", source: "request_context" }, // lowest
        ],
      }),
    );
    expect(r.jurisdictions).toEqual(["Brazil", "EU", "India"]);
  });

  it("does not let a high-confidence signal suppress a low-confidence one", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [
          { region: "IN", source: "authenticated_profile" },
          { region: "DE", source: "request_context" },
        ],
      }),
    );
    expect(r.jurisdictions).toContain("EU");
    expect(r.confidenceByJurisdiction.India).toBe("high");
    expect(r.confidenceByJurisdiction.EU).toBe("low");
  });

  it("reports confidence per jurisdiction, not as one number", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [
          { region: "IN", source: "user_declared" },
          { region: "DE", source: "request_context" },
        ],
      }),
    );
    expect(r.confidenceByJurisdiction).toEqual({ India: "high", EU: "low" });
  });

  it("takes the strongest confidence when two signals agree", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [
          { region: "DE", source: "request_context" },
          { region: "FR", source: "user_declared" },
        ],
      }),
    );
    expect(r.jurisdictions).toEqual(["EU"]);
    expect(r.confidenceByJurisdiction.EU).toBe("high");
    // Two member states are not a conflict - they map to the same jurisdiction.
    expect(r.hasConflictingSignals).toBe(false);
  });
});

// ─── An address is not a residence, and is not accepted at all ───────────────

describe("keeps location evidence separate from a claim about a person", () => {
  it("marks which sources are residence claims and which are not", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [geo("DE"), { region: "IN", source: "user_declared" }],
      }),
    );
    const byRegion = new Map(r.signals.map((s) => [s.region, s]));
    expect(byRegion.get("DE")!.isResidenceClaim).toBe(false);
    expect(byRegion.get("IN")!.isResidenceClaim).toBe(true);
  });

  it("says so in the reasoning for a non-residence source", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("DE")] }));
    const reason = r.reasons.find((x) => x.kind === "signal_mapped")!;
    expect(reason.detail).toContain("not about where this person lives");
  });

  it("refuses an IP address outright instead of ignoring it", () => {
    for (const address of ["203.0.113.42", "2001:db8::1", "192.168.1.1"]) {
      const r = resolveJurisdictions(
        visitor({ signals: [{ region: address, source: "ip_geolocation" }] }),
      );
      expect(r.jurisdictions, address).toEqual([]);
      const rejected = r.reasons.find((x) => x.kind === "region_rejected");
      expect(rejected, address).toBeDefined();
      expect(rejected!.detail).toContain("never an address");
    }
  });

  it("recognises addresses through the exported predicate", () => {
    expect(looksLikeIpAddress("203.0.113.42")).toBe(true);
    expect(looksLikeIpAddress("2001:db8::1")).toBe(true);
    expect(looksLikeIpAddress("DE")).toBe(false);
    expect(looksLikeIpAddress("US-CA")).toBe(false);
  });

  it("has no field on the context that would carry an identifier", () => {
    // The type has no place to put one; this pins the runtime shape too.
    const context = visitor({ signals: [geo("DE")] });
    expect(Object.keys(context).sort()).toEqual(["signals"]);
  });

  it("records observation time as a point in time, never as a standing fact", () => {
    const observedAt = new Date("2026-01-01T12:00:00.000Z");
    const r = resolveJurisdictions(
      visitor({ signals: [{ region: "DE", source: "ip_geolocation", observedAt }] }),
    );
    expect(r.signals[0].observedAt).toEqual(observedAt);
    expect(r.signals[0].isResidenceClaim).toBe(false);
  });
});

// ─── Versioned, configurable rules ───────────────────────────────────────────

describe("the jurisdiction rules are configuration, and versioned", () => {
  it("stamps the rule version on every resolution", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("DE")] }));
    expect(r.rulesVersion).toBe(DEFAULT_JURISDICTION_RULES.version);
    expect(r.rulesVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts a caller's own rule set", () => {
    const custom: JurisdictionRules = {
      version: "test-1",
      description: "Only Japan, mapped to the EU to prove the mapping is data.",
      regions: { JP: ["EU"] },
      unmappedRegions: [],
    };
    const r = resolveJurisdictions(visitor({ signals: [geo("JP")] }), custom);
    expect(r.jurisdictions).toEqual(["EU"]);
    expect(r.rulesVersion).toBe("test-1");

    // and the default rule set is untouched by that call
    expect(resolveJurisdictions(visitor({ signals: [geo("JP")] })).jurisdictions)
      .toEqual([]);
  });

  it("does not map the United Kingdom to the EU", () => {
    // The case that justifies versioning the file at all. UK GDPR is a separate
    // instrument the matrix does not carry.
    const r = resolveJurisdictions(visitor({ signals: [geo("GB")] }));
    expect(r.jurisdictions).toEqual([]);
    expect(r.reasons.some((x) => x.kind === "region_unmapped")).toBe(true);
  });

  it("covers the EU-27 plus the three non-EU EEA states", () => {
    const eu = Object.entries(DEFAULT_JURISDICTION_RULES.regions)
      .filter(([, js]) => js.includes("EU"))
      .map(([code]) => code);
    expect(eu).toHaveLength(30);
    for (const code of ["DE", "FR", "IT", "ES", "PL", "IS", "LI", "NO"]) {
      expect(eu, code).toContain(code);
    }
    expect(eu).not.toContain("GB");
    expect(eu).not.toContain("CH");
  });

  it("normalises region codes without guessing at malformed ones", () => {
    expect(normaliseRegion("de")).toBe("DE");
    expect(normaliseRegion(" us-ca ")).toBe("US-CA");
    expect(normaliseRegion("US_CA")).toBe("US-CA");
    expect(normaliseRegion("Germany")).toBeNull();
    expect(normaliseRegion("")).toBeNull();
  });

  it("distinguishes an unrecognisable code from an unmapped one", () => {
    const bad = resolveJurisdictions(visitor({ signals: [geo("Germany")] }));
    expect(bad.reasons.some((x) => x.kind === "region_unrecognised")).toBe(true);

    const unmapped = resolveJurisdictions(visitor({ signals: [geo("JP")] }));
    expect(unmapped.reasons.some((x) => x.kind === "region_unmapped")).toBe(true);
  });
});

// ─── The operator override ───────────────────────────────────────────────────

describe("an operator can assert a jurisdiction", () => {
  it("applies it regardless of any signal, and labels it an override", () => {
    const r = resolveJurisdictions(
      visitor({ signals: [geo("JP")], assertedJurisdictions: ["EU"] }),
    );
    expect(r.jurisdictions).toEqual(["EU"]);
    const reason = r.reasons.find((x) => x.kind === "operator_asserted")!;
    expect(reason.detail).toContain("not a finding");
  });

  it("adds to the signals rather than replacing them", () => {
    const r = resolveJurisdictions(
      visitor({ signals: [geo("BR")], assertedJurisdictions: ["India"] }),
    );
    expect(r.jurisdictions).toEqual(["Brazil", "India"]);
  });
});

// ─── Integration with the Phase 7A engine ────────────────────────────────────

describe("resolveContext carries the answer into the policy engine", () => {
  it("returns the resolution and the decision as separate artifacts", () => {
    const { resolution, decision } = resolveContext(
      visitor({ signals: [geo("DE")] }),
      { ...ACTIVITY, processingContexts: ["cookies"] },
    );
    expect(resolution.jurisdictions).toEqual(["EU"]);
    expect(decision.regimes).toContain("GDPR");
    expect(decision.obligations.length).toBeGreaterThan(0);
  });

  it("evaluates every resolved jurisdiction at once", () => {
    const { decision } = resolveContext(
      visitor({
        signals: [geo("DE"), { region: "IN", source: "business_target_market" }],
      }),
      ACTIVITY,
    );
    expect(decision.regimes).toContain("GDPR");
    expect(decision.regimes).toContain("India-DPDP-Act");
  });

  it("turns an unresolved location into REVIEW, not into permission", () => {
    /**
     * The seam that matters. "We do not know where they are" must not become
     * "nothing is required" - and it does not, because the empty jurisdiction
     * list reaches the evaluator unchanged and it already refuses to guess.
     */
    const { resolution, decision } = resolveContext(visitor(), ACTIVITY);
    expect(resolution.jurisdictions).toEqual([]);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("no_jurisdiction_given");
  });

  it("keeps the two failures distinguishable", () => {
    /**
     * Both come back REVIEW, and a caller has to be able to tell them apart:
     * one is fixed by learning where the visitor is, the other by converting
     * more research. The resolution and the decision are separate artifacts on
     * the result precisely so that question is answerable.
     */
    const unknown = resolveContext(visitor({ signals: [geo("JP")] }), ACTIVITY);
    expect(unknown.resolution.jurisdictions).toEqual([]);
    expect(unknown.decision.outcome).toBe("REVIEW");
    expect(
      unknown.decision.openQuestions.some(
        (q) => q.reason === "no_jurisdiction_given",
      ),
    ).toBe(true);
    expect(unknown.decision.obligations).toHaveLength(0);

    // A resolved jurisdiction gets a real reading, whatever the activity says.
    // Note it does *not* come back "no requirements": an unrecognised
    // processing context narrows nothing, because rules that enumerate no
    // contexts are kept - the asymmetry the evaluator applies everywhere.
    const known = resolveContext(visitor({ signals: [geo("DE")] }), {
      ...ACTIVITY,
      processingContexts: ["a_context_no_record_carries"],
    });
    expect(known.resolution.jurisdictions).toEqual(["EU"]);
    expect(
      known.decision.openQuestions.some(
        (q) => q.reason === "no_jurisdiction_given",
      ),
    ).toBe(false);
    expect(known.decision.obligations.length).toBeGreaterThan(0);
  });

  it("never returns ALLOW for any of the brief's scenarios", () => {
    const scenarios: VisitorContext[] = [
      visitor({ signals: [geo("IN")] }),
      visitor({ signals: [geo("DE")] }),
      visitor({ signals: [geo("US-CA")] }),
      visitor({ signals: [geo("BR")] }),
      visitor({ signals: [geo("DE"), geo("IN")] }),
      visitor({ signals: [geo("JP")] }),
      visitor({ signals: [{ region: "DE", source: "request_context" }] }),
      visitor(),
      visitor({ assertedJurisdictions: ["EU", "India"] }),
    ];
    for (const v of scenarios) {
      const { decision } = resolveContext(v, ACTIVITY);
      expect(decision.outcome).not.toBe("ALLOW");
    }
  });
});

// ─── The website operator's own question ─────────────────────────────────────

describe("a website operator gets the whole legal context", () => {
  /**
   * The end the phase exists for: a company running its own site asks what
   * applies to it, and gets an answer that does not contradict itself.
   *
   * This caught a real defect. Every terminal-equipment requirement binds
   * `service_operator`, while the GDPR's consent and notice duties bind
   * `determines_purpose`. Asking as one role returned the resolver saying
   * "ePrivacy is in scope" and the evaluator returning no ePrivacy obligation
   * whatsoever - the two halves disagreeing in a way nothing would have caught.
   * One company holds both roles, so the context takes a list.
   */
  it("returns GDPR and ePrivacy obligations together for an EU cookie banner", () => {
    const { resolution, decision } = resolveContext(
      {
        signals: [
          { region: "DE", source: "ip_geolocation" },
          { region: "DE", source: "business_target_market" },
        ],
      },
      {
        actors: WEBSITE_OPERATOR_ROLES,
        asOf: AS_OF,
        processingContexts: ["cookies"],
      },
    );

    expect(resolution.jurisdictions).toEqual(["EU"]);
    const regimes = new Set(decision.obligations.map((o) => o.citation.regime));
    expect(regimes).toContain("GDPR");
    expect(regimes).toContain("EU-ePrivacy");
  });

  it("never reports a regime as in scope while citing nothing from it", () => {
    // The invariant behind the bug above, asserted directly across every
    // jurisdiction the rules carry.
    for (const region of ["DE", "IN", "BR", "US-CA"]) {
      const { resolution, decision } = resolveContext(
        { signals: [{ region, source: "business_target_market" }] },
        { actors: WEBSITE_OPERATOR_ROLES, asOf: new Date("2028-01-01") },
      );
      const cited = new Set(decision.considered.map((c) => c.regime));
      for (const regime of resolution.regimes) {
        expect(cited, `${region}: ${regime} in scope but never cited`).toContain(
          regime,
        );
      }
    }
  });

  it("asking as one role only is what loses the terminal-equipment rules", () => {
    const cookies = { asOf: AS_OF, processingContexts: ["cookies"] };
    const visitorContext = { signals: [{ region: "DE", source: "ip_geolocation" as const }] };

    const controllerOnly = resolveContext(visitorContext, {
      ...cookies,
      actors: ["determines_purpose"],
    });
    const both = resolveContext(visitorContext, {
      ...cookies,
      actors: WEBSITE_OPERATOR_ROLES,
    });

    const ep = (d: typeof both.decision) =>
      d.obligations.filter((o) => o.citation.regime === "EU-ePrivacy").length;

    expect(ep(controllerOnly.decision)).toBe(0);
    expect(ep(both.decision)).toBeGreaterThan(0);
  });
});

describe("derived-authority regimes are reported apart", () => {
  it("keeps them out of `regimes` so the decision cannot contradict it", () => {
    const r = resolveJurisdictions(visitor({ signals: [geo("US-CA")] }));
    expect(r.derivedRegimes).toEqual(["US-State-Model"]);
    expect(r.regimes).toEqual(["California-CCPA-CPRA"]);
  });

  it("the evaluator cites them once they are asked for", () => {
    const { decision } = resolveContext(visitor({ signals: [geo("US-CA")] }), {
      ...ACTIVITY,
      includeDerivedModels: true,
    });
    expect(decision.regimes).toContain("US-State-Model");
  });
});

describe("commencement dates are respected end to end", () => {
  /**
   * India is the live example. Most of the DPDP Act's substantive provisions
   * carry `effective_from: 2027-05-13` in the research, so an Indian visitor
   * today yields no obligation at all - which is an answer, not a gap, and one
   * a hard-coded rule engine would have got wrong in both directions.
   */
  it("yields no DPDP obligation before commencement", () => {
    const { decision } = resolveContext(
      { signals: [{ region: "IN", source: "ip_geolocation" }] },
      { actors: WEBSITE_OPERATOR_ROLES, asOf: new Date("2026-09-04") },
    );
    expect(decision.obligations).toHaveLength(0);
    expect(decision.outcome).toBe("REVIEW");
  });

  it("yields them once it has commenced", () => {
    const { decision } = resolveContext(
      { signals: [{ region: "IN", source: "ip_geolocation" }] },
      { actors: WEBSITE_OPERATOR_ROLES, asOf: new Date("2027-06-01") },
    );
    const verdicts = decision.obligations.map((o) => o.verdict);
    expect(verdicts).toContain("REQUIRE_CONSENT");
    expect(verdicts).toContain("REQUIRE_NOTICE");
    expect(
      decision.obligations.some((o) => o.citation.ruleId === "REQ-IN-DPDP-ACT-003"),
    ).toBe(true);
  });
});

// ─── Determinism and purity ──────────────────────────────────────────────────

describe("the resolver is deterministic", () => {
  it("produces the same resolution for the same input", () => {
    const v = visitor({
      signals: [geo("DE"), { region: "IN", source: "user_declared" }],
    });
    const first = JSON.stringify(resolveJurisdictions(v));
    for (let i = 0; i < 20; i++) {
      expect(JSON.stringify(resolveJurisdictions(v))).toBe(first);
    }
  });

  it("does not depend on the order signals are given in", () => {
    const a = resolveJurisdictions(
      visitor({ signals: [geo("DE"), geo("IN"), geo("BR")] }),
    );
    const b = resolveJurisdictions(
      visitor({ signals: [geo("BR"), geo("DE"), geo("IN")] }),
    );
    expect(b.jurisdictions).toEqual(a.jurisdictions);
    expect(b.regimes).toEqual(a.regimes);
    expect(b.confidenceByJurisdiction).toEqual(a.confidenceByJurisdiction);
  });

  it("returns sorted jurisdictions so a caller can compare answers", () => {
    const r = resolveJurisdictions(
      visitor({ signals: [geo("IN"), geo("BR"), geo("DE")] }),
    );
    expect(r.jurisdictions).toEqual([...r.jurisdictions].sort());
  });

  it("cannot be made to throw", () => {
    const nasty: VisitorContext[] = [
      visitor({ signals: [{ region: "", source: "ip_geolocation" }] }),
      visitor({ signals: [{ region: "   ", source: "user_declared" }] }),
      visitor({ signals: [{ region: "!!!", source: "request_context" }] }),
      visitor({ signals: [{ region: "203.0.113.1", source: "ip_geolocation" }] }),
      visitor({ assertedJurisdictions: [] }),
      visitor({
        signals: Array.from({ length: 500 }, () => geo("DE")),
      }),
    ];
    for (const v of nasty) {
      expect(() => resolveJurisdictions(v)).not.toThrow();
      expect(() => resolveContext(v, ACTIVITY)).not.toThrow();
    }
  });

  it("marks every resolution as not legal advice", () => {
    expect(resolveJurisdictions(visitor({ signals: [geo("DE")] })).legalAdvice).toBe(
      false,
    );
  });

  it("round-trips through JSON", () => {
    const r = resolveJurisdictions(
      visitor({ signals: [geo("DE"), { region: "IN", source: "user_declared" }] }),
    );
    const round = JSON.parse(JSON.stringify(r)) as typeof r;
    expect(round.jurisdictions).toEqual(r.jurisdictions);
    expect(round.reasons.length).toBe(r.reasons.length);
  });
});

// ─── Source metadata ─────────────────────────────────────────────────────────

describe("source metadata is complete", () => {
  it("gives every source a default confidence and a residence flag", () => {
    const sources = Object.keys(DEFAULT_SOURCE_CONFIDENCE);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(
        DEFAULT_SOURCE_CONFIDENCE[source as keyof typeof DEFAULT_SOURCE_CONFIDENCE],
      ).toBeDefined();
      expect(
        SOURCE_IS_RESIDENCE_CLAIM[source as keyof typeof SOURCE_IS_RESIDENCE_CLAIM],
      ).toBeDefined();
    }
  });

  it("never rates an IP-derived observation above medium by default", () => {
    expect(DEFAULT_SOURCE_CONFIDENCE.ip_geolocation).toBe("medium");
    expect(DEFAULT_SOURCE_CONFIDENCE.request_context).toBe("low");
  });

  it("lets a caller override the default confidence", () => {
    const r = resolveJurisdictions(
      visitor({
        signals: [{ region: "DE", source: "ip_geolocation", confidence: "low" }],
      }),
    );
    expect(r.confidenceByJurisdiction.EU).toBe("low");
  });

  it("treats only person-claims as residence claims", () => {
    expect(SOURCE_IS_RESIDENCE_CLAIM.user_declared).toBe(true);
    expect(SOURCE_IS_RESIDENCE_CLAIM.authenticated_profile).toBe(true);
    expect(SOURCE_IS_RESIDENCE_CLAIM.ip_geolocation).toBe(false);
    expect(SOURCE_IS_RESIDENCE_CLAIM.business_target_market).toBe(false);
  });
});
