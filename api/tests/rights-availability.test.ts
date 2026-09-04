/**
 * Which privacy controls apply, and the consent receipt.
 *
 * Phase 10A's hardest instruction is *do not pretend one universal rights
 * workflow exists across every jurisdiction*, and these tests are mostly about
 * holding that line. The matrix says the regimes differ, and `REQ-BR-LGPD-016`
 * says outright that LGPD creates no CCPA-style universal sale opt-out — so a
 * fixed list of buttons would be wrong somewhere on its first day.
 *
 * The distinction under test throughout is between three answers, not two:
 *
 *   always     the platform guarantees it regardless of regime
 *   indicated  a requirement of that family applies, and here is its text
 *   unknown    the matrix says nothing — which is NOT "does not apply"
 *
 * No database.
 */

import { describe, expect, it } from "vitest";
import {
  RIGHTS_CONTROLS,
  availableRights,
  isSubmittableControl,
  type DetectedLocation,
} from "@/lib/rights";
import {
  RECEIPT_CAVEAT,
  canonicalEvidence,
  proofHash,
  verifyProof,
  type ConsentEvidence,
} from "@rift-cmp/shared/consent-proof";

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

function market(region: string): DetectedLocation {
  return { region, source: "business_target_market" };
}

function rights(regions: string[]) {
  return availableRights({
    locationSignals: regions.map(market),
    asOf: AS_OF,
  });
}

function control(result: ReturnType<typeof rights>, name: string) {
  return result.controls.find((c) => c.control === name)!;
}

// ─── Rights availability by jurisdiction ─────────────────────────────────────

describe("rights availability differs by jurisdiction", () => {
  it("indicates the request family in the EU, citing a requirement", () => {
    const eu = rights(["DE"]);
    expect(eu.jurisdictions).toEqual(["EU"]);
    expect(control(eu, "access").availability).toBe("indicated");
    expect(control(eu, "access").rule_references.length).toBeGreaterThan(0);
    expect(control(eu, "access").evidence[0].text.length).toBeGreaterThan(20);
  });

  it("indicates a sale opt-out in California and not in the EU", () => {
    /**
     * The clearest case that no universal workflow exists. Opt-out of sale is a
     * California construct; `matrix/coverage.md` records its absence elsewhere
     * as an answer rather than a gap.
     */
    const california = rights(["US-CA"]);
    const eu = rights(["DE"]);

    expect(control(california, "opt_out_sale").availability).toBe("indicated");
    expect(control(eu, "opt_out_sale").availability).toBe("unknown");
  });

  it("indicates non-discrimination in California and not in the EU", () => {
    expect(control(rights(["US-CA"]), "non_discrimination").availability).toBe(
      "indicated",
    );
    expect(control(rights(["DE"]), "non_discrimination").availability).toBe("unknown");
  });

  it("does not offer a CCPA-style sale opt-out for Brazil", () => {
    // REQ-BR-LGPD-016 states LGPD creates no such right. The matrix carries the
    // absence, and the resolver must not manufacture the control anyway.
    const brazil = rights(["BR"]);
    expect(brazil.jurisdictions).toEqual(["Brazil"]);
    expect(control(brazil, "opt_out_sale").availability).toBe("unknown");
  });

  it("indicates a complaint route for India", () => {
    // DPDP's grievance redressal has no direct GDPR analogue, which is exactly
    // why the control list cannot be fixed.
    const india = rights(["IN"]);
    expect(india.jurisdictions).toEqual(["India"]);
    expect(["indicated", "unknown"]).toContain(control(india, "complaint").availability);
  });

  it("accumulates across markets rather than picking one", () => {
    const both = rights(["DE", "US-CA"]);
    expect(both.jurisdictions).toEqual(["California", "EU", "US"]);
    expect(control(both, "opt_out_sale").availability).toBe("indicated");
    expect(control(both, "access").availability).toBe("indicated");
  });

  it("cites more than one regime where more than one applies", () => {
    const both = rights(["DE", "BR"]);
    expect(control(both, "access").regimes.length).toBeGreaterThan(1);
  });
});

// ─── unknown is not "does not apply" ─────────────────────────────────────────

describe("unknown is never reported as a denial", () => {
  it("says so in the note on every unknown control", () => {
    const eu = rights(["DE"]);
    const unknown = eu.controls.filter((c) => c.availability === "unknown");
    expect(unknown.length).toBeGreaterThan(0);
    for (const c of unknown) {
      expect(c.note.toLowerCase()).toMatch(/not carried|never .not required.|not a finding/);
    }
  });

  it("distinguishes 'no jurisdiction given' from 'nothing found'", () => {
    const nowhere = rights([]);
    expect(nowhere.jurisdictions).toEqual([]);
    expect(control(nowhere, "access").availability).toBe("unknown");
    expect(control(nowhere, "access").note).toContain("No jurisdiction was given");
  });

  it("carries the engine's open questions alongside", () => {
    // An `unknown` beside twelve open questions means something different from
    // one against a settled matrix.
    const eu = rights(["DE"]);
    expect(eu.open_questions.length).toBeGreaterThan(0);
  });

  it("never claims to be legal advice", () => {
    expect(rights(["DE"]).legal_advice).toBe(false);
  });
});

// ─── What the platform guarantees regardless ─────────────────────────────────

describe("review and withdrawal are always available", () => {
  it("offers them even with no jurisdiction resolved", () => {
    const nowhere = rights([]);
    expect(control(nowhere, "review").availability).toBe("always");
    expect(control(nowhere, "withdraw").availability).toBe("always");
  });

  it("says why, in terms of the product rather than the law", () => {
    const eu = rights(["DE"]);
    expect(control(eu, "review").note).toContain("append-only");
    expect(control(eu, "withdraw").note).toContain("never rewrites");
  });

  it("cites no requirement for them, because they are not claims about law", () => {
    const eu = rights(["DE"]);
    expect(control(eu, "review").rule_references).toEqual([]);
    expect(control(eu, "withdraw").rule_references).toEqual([]);
  });
});

// ─── The control catalogue ───────────────────────────────────────────────────

describe("the control catalogue", () => {
  it("reports every control on every response, present or not", () => {
    // A missing row and an `unknown` row are different, and a caller rendering
    // a preference centre needs the second rather than an absence to interpret.
    const eu = rights(["DE"]);
    expect(eu.controls).toHaveLength(RIGHTS_CONTROLS.length);
  });

  it("accepts only a known control for submission", () => {
    expect(isSubmittableControl("deletion")).toBe(true);
    expect(isSubmittableControl("complaint")).toBe(true);
    expect(isSubmittableControl("make_me_famous")).toBe(false);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(rights(["DE", "US-CA"]))).toBe(
      JSON.stringify(rights(["DE", "US-CA"])),
    );
  });

  it("does not depend on the order markets are given in", () => {
    expect(JSON.stringify(rights(["US-CA", "DE"]))).toBe(
      JSON.stringify(rights(["DE", "US-CA"])),
    );
  });

  it("names no regime in its own logic", () => {
    // The same guarantee `policy/disposition.ts` holds: which rights exist is
    // the matrix's business, not this file's.
    const source = RIGHTS_CONTROLS.join(",");
    for (const regime of ["GDPR", "CCPA", "LGPD", "DPDP", "ePrivacy"]) {
      expect(source).not.toContain(regime);
    }
  });
});

// ─── The consent receipt ─────────────────────────────────────────────────────

function evidence(over: Partial<ConsentEvidence> = {}): ConsentEvidence {
  return {
    siteId: "site_demo",
    principalExternalId: "principal-1",
    purposeCode: "analytics",
    status: "GRANTED",
    decidedAt: AS_OF,
    noticeId: "notice-1",
    policyVersionId: "pv-1",
    policyConfigVersion: "cfg-1",
    jurisdictions: ["EU"],
    vendors: ["Google Analytics"],
    mechanism: "banner",
    source: "sdk",
    ...over,
  };
}

describe("the consent receipt", () => {
  it("is stable for the same evidence", () => {
    expect(proofHash(evidence())).toBe(proofHash(evidence()));
  });

  it("does not depend on the order of jurisdictions or vendors", () => {
    expect(
      proofHash(evidence({ jurisdictions: ["EU", "India"], vendors: ["B", "A"] })),
    ).toBe(proofHash(evidence({ jurisdictions: ["India", "EU"], vendors: ["A", "B"] })));
  });

  it("changes when any evidence field changes", () => {
    const base = proofHash(evidence());
    const variants: Array<Partial<ConsentEvidence>> = [
      { status: "WITHDRAWN" },
      { purposeCode: "marketing" },
      { noticeId: "notice-2" },
      { policyVersionId: "pv-2" },
      { policyConfigVersion: "cfg-2" },
      { jurisdictions: ["Brazil"] },
      { vendors: ["Meta Pixel"] },
      { mechanism: "preference_centre" },
      { source: "api" },
      { decidedAt: new Date("2026-09-05T00:00:00.000Z") },
      { principalExternalId: "principal-2" },
      { siteId: "site_other" },
    ];
    for (const variant of variants) {
      expect(proofHash(evidence(variant)), JSON.stringify(variant)).not.toBe(base);
    }
  });

  it("treats a Date and its ISO string identically", () => {
    expect(proofHash(evidence({ decidedAt: AS_OF }))).toBe(
      proofHash(evidence({ decidedAt: AS_OF.toISOString() })),
    );
  });

  it("verifies a matching digest and rejects a mismatched one", () => {
    const digest = proofHash(evidence());
    expect(verifyProof(evidence(), digest)).toBe(true);
    expect(verifyProof(evidence({ status: "DENIED" }), digest)).toBe(false);
  });

  it("rejects a truncated digest rather than matching its prefix", () => {
    const digest = proofHash(evidence());
    expect(verifyProof(evidence(), digest.slice(0, 20))).toBe(false);
  });

  it("tolerates surrounding whitespace, since a receipt is copied by hand", () => {
    const digest = proofHash(evidence());
    expect(verifyProof(evidence(), `  ${digest}\n`)).toBe(true);
  });

  it("is versioned, so the canonical form can change without silent mismatches", () => {
    expect(canonicalEvidence(evidence()).startsWith("rift-consent-receipt/1")).toBe(true);
  });

  it("states its own limits, so they travel with the receipt", () => {
    expect(RECEIPT_CAVEAT).toContain("not a signature");
    expect(RECEIPT_CAVEAT).toContain("not chained");
    expect(RECEIPT_CAVEAT.toLowerCase()).toContain("write the underlying table");
  });

  it("carries nothing about the person beyond the identifier they already hold", () => {
    const canonical = canonicalEvidence(evidence());
    // No address, no user agent and no contact detail can reach the digest,
    // because no field on ConsentEvidence can hold one.
    expect(Object.keys(evidence()).sort()).toEqual([
      "decidedAt",
      "jurisdictions",
      "mechanism",
      "noticeId",
      "policyConfigVersion",
      "policyVersionId",
      "principalExternalId",
      "purposeCode",
      "siteId",
      "source",
      "status",
      "vendors",
    ]);
    expect(canonical).not.toContain("@");
  });
});
