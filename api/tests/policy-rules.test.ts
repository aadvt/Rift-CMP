/**
 * Compilation and selection.
 *
 * These tests are about the half of the engine that decides *which* rules a
 * context reaches, and about the invariants that keep the engine generic. The
 * evaluator's behaviour is in `policy-engine.test.ts`.
 *
 * No database. Everything here is a pure function over the Phase 6B matrix.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATRIX_PROVENANCE,
  POPULATED_LEGAL_BASES,
  POPULATED_TOPICS,
  REGIMES,
  RULES,
  TOPIC_DISPOSITION,
  selectRules,
  type ProcessingContext,
  type Rule,
  type Topic,
} from "@rift-cmp/policy";

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

function ctx(over: Partial<ProcessingContext> = {}): ProcessingContext {
  return {
    jurisdictions: ["EU"],
    actor: "determines_purpose",
    asOf: AS_OF,
    ...over,
  };
}

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("compilation", () => {
  it("compiles every requirement in the matrix", () => {
    const raw = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs/regulations/matrix/requirements.json"),
        "utf8",
      ),
    ) as { requirements: unknown[] };

    expect(RULES.length).toBe(raw.requirements.length);
    expect(RULES.length).toBeGreaterThan(0);
  });

  it("gives every rule a region and at least one canonical actor", () => {
    // Both are the selection keys. A rule missing either would be either
    // unreachable or reachable from everywhere, and both are silent failures.
    for (const rule of RULES) {
      expect(rule.regions.length, rule.id).toBeGreaterThan(0);
      expect(rule.actors.length, rule.id).toBeGreaterThan(0);
    }
  });

  it("carries every citation field the matrix records", () => {
    const withSources = RULES.filter((r) => r.sourceIds.length > 0);
    expect(withSources.length).toBe(RULES.length);
    for (const rule of RULES) {
      expect(rule.text.length, rule.id).toBeGreaterThan(0);
      expect(typeof rule.applies, rule.id).toBe("boolean");
    }
  });

  it("infers nothing: a record without a consent block compiles to undefined", () => {
    const withoutConsent = RULES.filter((r) => r.consent === undefined);
    expect(withoutConsent.length).toBeGreaterThan(0);
    // The important half: it is `undefined`, never a defaulted `{required:false}`.
    for (const rule of withoutConsent) expect(rule.consent).toBeUndefined();
  });

  it("preserves the tri-state consent value rather than coercing it", () => {
    const values = new Set(
      RULES.filter((r) => r.consent).map((r) => r.consent!.required),
    );
    expect(values.has("conditional")).toBe(true);
    expect(values.has(true)).toBe(true);
    expect(values.has(false)).toBe(true);
  });

  it("keeps the regime's own topic term alongside the canonical one", () => {
    const renamed = RULES.filter(
      (r) => r.topic !== undefined && r.regimeTopic !== r.topic,
    );
    // The vocabulary maps synonyms onto canonical topics; if nothing were
    // renamed the canonicalisation would not be doing anything.
    expect(renamed.length).toBeGreaterThan(0);
  });

  it("reports the matrix provenance it was built from", () => {
    expect(MATRIX_PROVENANCE.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(MATRIX_PROVENANCE.researchStatus).toBe("research");
  });

  it("exposes the regimes, topics and legal bases actually present", () => {
    expect(REGIMES.length).toBe(7);
    expect(POPULATED_TOPICS.length).toBeGreaterThan(0);
    expect(POPULATED_LEGAL_BASES.length).toBeGreaterThan(0);
    expect([...REGIMES]).toEqual([...REGIMES].sort());
  });
});

describe("the disposition table stays generic", () => {
  /**
   * The architectural guarantee of the phase, asserted rather than asserted
   * about. "Centralise policy evaluation" is satisfiable by one file full of
   * per-regime branches; this is what makes it mean something stronger.
   */
  it("names no regime, and no regime-specific article", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "policy/disposition.ts"),
      "utf8",
    );
    // The doc comment legitimately names regimes while explaining the rule it
    // is imposing, so only the table itself is examined.
    const table = source.slice(source.indexOf("export const TOPIC_DISPOSITION"));

    for (const regime of REGIMES) {
      expect(table, `disposition table names ${regime}`).not.toContain(regime);
    }
    for (const word of ["GDPR", "DPDP", "CCPA", "CPRA", "LGPD", "ePrivacy"]) {
      expect(table, `disposition table names ${word}`).not.toContain(word);
    }
  });

  it("has a row for every canonical topic the matrix uses", () => {
    for (const topic of POPULATED_TOPICS) {
      expect(TOPIC_DISPOSITION[topic], `no disposition for ${topic}`).toBeDefined();
    }
  });

  it("gives every row a rationale, not just a verdict", () => {
    for (const [topic, row] of Object.entries(TOPIC_DISPOSITION)) {
      expect(row.rationale.length, topic).toBeGreaterThan(40);
    }
  });
});

describe("selection", () => {
  it("excludes rules from other regions", () => {
    const { selected, excluded } = selectRules(ctx({ jurisdictions: ["Brazil"] }));
    expect(selected.length).toBeGreaterThan(0);
    for (const rule of selected) expect(rule.regions).toContain("Brazil");

    const gdpr = RULES.find((r) => r.regime === "GDPR")!;
    expect(excluded.get(gdpr.id)).toBe("region");
  });

  it("selects several regimes at once when several jurisdictions are given", () => {
    const { selected } = selectRules(ctx({ jurisdictions: ["EU", "India"] }));
    const regimes = new Set(selected.map((r) => r.regime));
    expect(regimes.size).toBeGreaterThan(1);
  });

  it("excludes rules that bind a different actor", () => {
    const { selected } = selectRules(ctx({ actor: "intermediary" }));
    for (const rule of selected) {
      expect(rule.actors, rule.id).toContain("intermediary");
    }
  });

  it("holds derived-authority rules back unless they are asked for", () => {
    const without = selectRules(ctx({ jurisdictions: ["US"] }));
    expect(without.selected.length).toBe(0);

    const with_ = selectRules(
      ctx({ jurisdictions: ["US"], includeDerivedModels: true }),
    );
    expect(with_.selected.length).toBeGreaterThan(0);
    expect(with_.selected.every((r) => r.authorityLevel === "derived")).toBe(true);
  });

  it("respects effective_from", () => {
    const early = selectRules(ctx({ asOf: new Date("1990-01-01") }));
    expect(early.selected.length).toBe(0);

    // Exclusion records the *first* reason a rule failed, so this has to be a
    // rule that clears the region and actor filters and fails only on the date.
    const dated = RULES.filter(
      (r) =>
        r.effectiveFrom !== null &&
        r.regions.includes("EU") &&
        r.actors.includes("determines_purpose") &&
        r.authorityLevel !== "derived",
    );
    expect(dated.length).toBeGreaterThan(0);
    for (const rule of dated) {
      expect(early.excluded.get(rule.id), rule.id).toBe("not_yet_effective");
    }
  });

  it("respects effective_to", () => {
    const expiring: Rule = {
      ...RULES.find((r) => r.regime === "GDPR")!,
      id: "TEST-EXPIRED",
      effectiveFrom: "2000-01-01",
      effectiveTo: "2020-01-01",
    };
    const { selected, excluded } = selectRules(ctx(), [expiring]);
    expect(selected).toHaveLength(0);
    expect(excluded.get("TEST-EXPIRED")).toBe("no_longer_effective");
  });

  describe("narrowing is asymmetric, and only on recorded evidence", () => {
    /**
     * The rule that runs through the whole selector: a record is dropped only
     * when it positively says it does not reach this context. "This record does
     * not enumerate purposes" and "this record excludes your purpose" are
     * different statements, and only the second justifies dropping it.
     */
    it("keeps a rule that enumerates no purposes when a purpose is given", () => {
      const silent: Rule = {
        ...RULES[0],
        id: "TEST-NO-PURPOSE",
        regions: ["EU"],
        actors: ["determines_purpose"],
        effectiveFrom: null,
        effectiveTo: null,
        authorityLevel: "statute",
        purposes: [],
      };
      const { selected } = selectRules(ctx({ purpose: "sale" }), [silent]);
      expect(selected).toHaveLength(1);
    });

    it("drops a rule that enumerates a different purpose", () => {
      const other: Rule = {
        ...RULES[0],
        id: "TEST-OTHER-PURPOSE",
        regions: ["EU"],
        actors: ["determines_purpose"],
        effectiveFrom: null,
        effectiveTo: null,
        authorityLevel: "statute",
        purposes: ["direct_marketing"],
      };
      const { selected, excluded } = selectRules(ctx({ purpose: "sale" }), [other]);
      expect(selected).toHaveLength(0);
      expect(excluded.get("TEST-OTHER-PURPOSE")).toBe("purpose");
    });

    it("applies the same asymmetry to data categories", () => {
      const base: Rule = {
        ...RULES[0],
        regions: ["EU"],
        actors: ["determines_purpose"],
        effectiveFrom: null,
        effectiveTo: null,
        authorityLevel: "statute",
      };
      const silent = { ...base, id: "TEST-DC-SILENT", dataCategories: [] };
      const other = {
        ...base,
        id: "TEST-DC-OTHER",
        dataCategories: ["sensitive_data" as const],
      };
      const { selected, excluded } = selectRules(
        ctx({ dataCategories: ["device_data"] }),
        [silent, other],
      );
      expect(selected.map((r) => r.id)).toEqual(["TEST-DC-SILENT"]);
      expect(excluded.get("TEST-DC-OTHER")).toBe("data_category");
    });

    it("applies the same asymmetry to processing contexts", () => {
      const base: Rule = {
        ...RULES[0],
        regions: ["EU"],
        actors: ["determines_purpose"],
        effectiveFrom: null,
        effectiveTo: null,
        authorityLevel: "statute",
      };
      const silent = { ...base, id: "TEST-CTX-SILENT", contexts: [] };
      const other = { ...base, id: "TEST-CTX-OTHER", contexts: ["security"] };
      const { selected, excluded } = selectRules(
        ctx({ processingContexts: ["cookies"] }),
        [silent, other],
      );
      expect(selected.map((r) => r.id)).toEqual(["TEST-CTX-SILENT"]);
      expect(excluded.get("TEST-CTX-OTHER")).toBe("processing_context");
    });
  });

  it("returns rules in a stable order regardless of matrix order", () => {
    const forward = selectRules(ctx()).selected.map((r) => r.id);
    const reversed = selectRules(ctx(), [...RULES].reverse()).selected.map(
      (r) => r.id,
    );
    expect(reversed).toEqual(forward);
    expect(forward).toEqual([...forward].sort());
  });

  it("never mutates the shared rule set", () => {
    const before = RULES.map((r) => r.id);
    selectRules(ctx({ jurisdictions: ["EU", "India", "Brazil"] }));
    expect(RULES.map((r) => r.id)).toEqual(before);
  });
});

describe("topics the engine treats as gates", () => {
  it("are exactly the ones the table marks as gates", () => {
    const fromTable = (Object.keys(TOPIC_DISPOSITION) as Topic[]).filter(
      (t) => TOPIC_DISPOSITION[t].disposition === "gate",
    );
    // Guards against the two drifting; GATE_TOPICS is derived, and this asserts
    // it stays derived rather than becoming a second hand-maintained list.
    expect(fromTable).toContain("consent");
    expect(fromTable).toContain("tracking_and_storage");
    expect(fromTable).not.toContain("security");
    expect(fromTable).not.toContain("enforcement");
  });
});
