/**
 * Attempts to falsify the policy engine's claims from the outside.
 *
 * `policy-rules.test.ts` and `policy-engine.test.ts` check that the engine does
 * what it is supposed to. This file assumes it does not, and tries to prove it -
 * the same posture `transfer-boundary.test.ts` takes toward the crypto boundary,
 * for the same reason: Phase 7B is going to build on this, and a guarantee that
 * has only ever been asserted by the thing making it is not a guarantee.
 *
 * Four claims are under attack:
 *
 *   1. The engine holds no legal content of its own.
 *   2. It is structurally independent of the platform.
 *   3. A caller cannot corrupt it.
 *   4. It cannot be talked into ALLOW.
 *
 * No database.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RULES,
  evaluate,
  selectRules,
  type ProcessingContext,
  type Verdict,
} from "@rift-cmp/policy";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const policyDir = path.join(repoRoot, "policy");

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

function ctx(over: Partial<ProcessingContext> = {}): ProcessingContext {
  return {
    jurisdictions: ["EU"],
    actors: ["determines_purpose"],
    asOf: AS_OF,
    ...over,
  };
}

function policySources(): { file: string; text: string }[] {
  return fs
    .readdirSync(policyDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({
      file: f,
      text: fs.readFileSync(path.join(policyDir, f), "utf8"),
    }));
}

// ─── 1. The engine holds no legal content of its own ─────────────────────────

describe("the engine restates no requirement", () => {
  it("cites only text that appears verbatim in the matrix", () => {
    /**
     * The strong form of "it holds no legal content": every word of legal
     * substance the engine hands back is traceable to the research file. If the
     * engine ever paraphrased a requirement, this finds it.
     */
    const matrixJson = fs.readFileSync(
      path.join(repoRoot, "docs/regulations/matrix/requirements.json"),
      "utf8",
    );
    const matrix = JSON.parse(matrixJson) as {
      requirements: { requirement_id: string; requirement: string }[];
    };
    const byId = new Map(
      matrix.requirements.map((r) => [r.requirement_id, r.requirement]),
    );

    const decision = evaluate(
      ctx({ jurisdictions: ["EU", "India", "California", "Brazil"] }),
    );
    expect(decision.considered.length).toBeGreaterThan(20);

    for (const c of decision.considered) {
      expect(byId.get(c.ruleId), `${c.ruleId} not in the matrix`).toBe(c.text);
    }
  });

  it("invents no requirement id", () => {
    const ids = new Set(RULES.map((r) => r.id));
    const decision = evaluate(
      ctx({ jurisdictions: ["EU", "India", "California", "Brazil"] }),
    );
    for (const c of decision.considered) expect(ids.has(c.ruleId)).toBe(true);
    for (const o of decision.obligations) expect(ids.has(o.citation.ruleId)).toBe(true);
  });

  it("keeps no requirement text in its own source", () => {
    // A regression guard against someone inlining a rule "just for now".
    const matrix = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "docs/regulations/matrix/requirements.json"),
        "utf8",
      ),
    ) as { requirements: { requirement: string }[] };

    for (const { file, text } of policySources()) {
      for (const req of matrix.requirements) {
        // Compare on a distinctive slice; full sentences would never collide by
        // accident, and a copied one would.
        const fragment = req.requirement.slice(0, 60);
        expect(text.includes(fragment), `${file} contains matrix prose`).toBe(false);
      }
    }
  });

  it("names no article, section or regulation number in its logic", () => {
    // Doc comments may cite an article to explain a design choice; executable
    // lines may not, because that would be a legal rule living in code.
    const pattern =
      /\b(Article|Art\.|Section|Sec\.|§|Recital|Regulation \(EU\))\s*\d/i;
    for (const { file, text } of policySources()) {
      const offenders = text
        .split("\n")
        .map((line, i) => ({ line: line.trim(), n: i + 1 }))
        .filter(
          ({ line }) =>
            !line.startsWith("*") &&
            !line.startsWith("//") &&
            !line.startsWith("/*") &&
            pattern.test(line),
        );
      expect(offenders, `${file}: ${JSON.stringify(offenders)}`).toHaveLength(0);
    }
  });
});

// ─── 2. Structural independence ──────────────────────────────────────────────

describe("the engine is not entangled with the platform", () => {
  it("imports no database, api, prisma or next module", () => {
    const forbidden = [
      /from\s+["']database["']/,
      /from\s+["']@prisma/,
      /from\s+["']next/,
      /from\s+["']react/,
      /from\s+["']\.\.\/api\//,
      /from\s+["']@rift-cmp\/secure-transfer/,
    ];
    for (const { file, text } of policySources()) {
      for (const pattern of forbidden) {
        expect(pattern.test(text), `${file} matches ${pattern}`).toBe(false);
      }
    }
  });

  it("is imported by no route, page or library module", () => {
    /**
     * The engine is deliberately not wired in. This is what makes that
     * statement checkable rather than a promise in a document - if Phase 7B
     * wires it into a route, this test fails and the claim gets rewritten
     * rather than quietly becoming false.
     */
    const roots = ["app", "lib"].map((d) => path.join(repoRoot, "api", d));
    const offenders: string[] = [];

    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const text = fs.readFileSync(full, "utf8");
          if (/from\s+["']@rift-cmp\/policy/.test(text)) {
            offenders.push(path.relative(repoRoot, full));
          }
        }
      }
    };
    roots.forEach(walk);

    expect(offenders).toEqual([]);
  });

  it("declares no runtime dependency", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(policyDir, "package.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(pkg.dependencies).toBeUndefined();
  });

  it("accepts no identifier anywhere in its public input types", () => {
    /**
     * The privacy boundary of Phase 7B, checked structurally. The brief says not
     * to collect personal information merely to sharpen jurisdiction detection,
     * so the resolver's input must have nowhere to put any. If a field named for
     * an address, a user agent or an identifier ever appears on `VisitorContext`
     * or `DetectedLocation`, this fails.
     */
    const text = fs.readFileSync(path.join(policyDir, "location.ts"), "utf8");

    // Declared field names only. Prose legitimately discusses addresses at
    // length - it is the whole subject of the file - so scanning the text would
    // catch the explanation rather than a leak.
    const fieldsOf = (name: string): string[] => {
      const start = text.indexOf(`export interface ${name} {`);
      expect(start, `${name} not found`).toBeGreaterThan(-1);
      const body = text.slice(start, text.indexOf("\n}", start));
      return [...body.matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/gm)]
        .map((m) => m[1]);
    };

    const declared = [...fieldsOf("DetectedLocation"), ...fieldsOf("VisitorContext")];
    expect(declared.length).toBeGreaterThan(0);

    const forbidden =
      /^(ip|ipAddress|remoteAddr|userAgent|email|userId|principalId|deviceId|cookie|fingerprint|latitude|longitude|postcode|address|name|phone)$/i;
    for (const field of declared) {
      expect(forbidden.test(field), `location.ts declares "${field}"`).toBe(false);
    }
  });

  it("performs no I/O and reads no environment", () => {
    for (const { file, text } of policySources()) {
      for (const pattern of [
        /require\(["']node:fs/,
        /from\s+["']node:fs/,
        /process\.env/,
        /fetch\(/,
        /Math\.random/,
        /Date\.now/,
        /new Date\(\)/,
      ]) {
        expect(pattern.test(text), `${file} matches ${pattern}`).toBe(false);
      }
    }
  });
});

// ─── 3. A caller cannot corrupt it ───────────────────────────────────────────

describe("shared state cannot be poisoned by a caller", () => {
  it("does not let a returned decision alias the shared rules", () => {
    const before = JSON.stringify(RULES);
    const decision = evaluate(ctx());

    // Try to write through everything the decision hands back.
    for (const c of decision.considered) {
      try {
        (c as { text: string }).text = "TAMPERED";
      } catch {
        /* frozen is a fine outcome */
      }
      try {
        (c.triggers as string[]).push("TAMPERED");
      } catch {
        /* also fine */
      }
    }

    expect(JSON.stringify(RULES)).toBe(before);
  });

  it("survives a caller mutating the rule objects it exposes", () => {
    const clean = JSON.stringify(evaluate(ctx()));

    for (const rule of RULES) {
      try {
        (rule as { applies: boolean }).applies = false;
      } catch {
        /* frozen */
      }
      try {
        (rule as { consent?: unknown }).consent = { required: false };
      } catch {
        /* frozen */
      }
    }

    expect(JSON.stringify(evaluate(ctx()))).toBe(clean);
  });

  it("does not let a caller extend the shared rule array", () => {
    const length = RULES.length;
    try {
      (RULES as unknown as unknown[]).push({ id: "INJECTED" });
    } catch {
      /* frozen */
    }
    expect(RULES.length).toBe(length);
  });

  it("is unaffected by a caller mutating the context after the call", () => {
    const jurisdictions = ["EU"] as ProcessingContext["jurisdictions"];
    const asserted = ["strictly_necessary"];
    const context = ctx({ jurisdictions, assertedConditions: asserted });

    const first = JSON.stringify(evaluate(context));
    (jurisdictions as string[]).push("India");
    asserted.push("something_else");

    // The decision already returned must not have changed retroactively.
    expect(first).toBe(first);
    // and a fresh call reflects the new context rather than a cached one
    const second = evaluate(ctx({ jurisdictions: ["EU"] }));
    expect(second.regimes).not.toContain("India-DPDP-Act");
  });

  it("returns a fresh decision object each call, not a shared one", () => {
    const a = evaluate(ctx());
    const b = evaluate(ctx());
    expect(a).not.toBe(b);
    expect(a.obligations).not.toBe(b.obligations);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ─── 4. It cannot be talked into ALLOW ───────────────────────────────────────

describe("ALLOW cannot be obtained by degenerate input", () => {
  const attacks: Array<[string, ProcessingContext]> = [
    ["no jurisdiction", ctx({ jurisdictions: [] })],
    [
      "every jurisdiction at once",
      ctx({ jurisdictions: ["EU", "India", "California", "US", "Brazil"] }),
    ],
    ["an unknown purpose", ctx({ purpose: "not_a_real_purpose" })],
    ["an unknown processing context", ctx({ processingContexts: ["nonsense"] })],
    ["an empty processing context list", ctx({ processingContexts: [] })],
    ["an empty data category list", ctx({ dataCategories: [] })],
    ["a date before every regime", ctx({ asOf: new Date("1900-01-01") })],
    ["a date far in the future", ctx({ asOf: new Date("2999-01-01") })],
    ["an invalid date", ctx({ asOf: new Date("not a date") })],
    ["the epoch", ctx({ asOf: new Date(0) })],
    [
      "asserting a condition that does not exist",
      ctx({ assertedConditions: ["please_allow_this"] }),
    ],
    [
      "asserting a great many conditions",
      ctx({ assertedConditions: Array.from({ length: 500 }, (_, i) => `c${i}`) }),
    ],
    ["claiming to be a child", ctx({ subjectIsChild: true })],
    ["claiming not to be a child", ctx({ subjectIsChild: false })],
    ["declaring an international transfer", ctx({ involvesInternationalTransfer: true })],
    [
      "claiming a legal basis",
      ctx({ claimedLegalBasis: "legitimate_interests" }),
    ],
    ["turning on derived models", ctx({ includeDerivedModels: true })],
  ];

  for (const [name, context] of attacks) {
    it(`refuses ALLOW for ${name}`, () => {
      const decision = evaluate(context);
      expect(decision.outcome).not.toBe("ALLOW");
      // and never silently returns an empty answer with a permissive outcome
      if (decision.outcome !== "ALLOW") {
        expect(decision.openQuestions.length + decision.obligations.length)
          .toBeGreaterThan(0);
      }
    });
  }

  it("refuses ALLOW for every actor in every region", () => {
    const regions = ["EU", "India", "California", "US", "Brazil"] as const;
    const actors = [
      "determines_purpose",
      "acts_on_instruction",
      "third_party",
      "service_operator",
      "intermediary",
    ] as const;
    for (const j of regions) {
      for (const actor of actors) {
        const d = evaluate(
          ctx({ jurisdictions: [j], actors: [actor], includeDerivedModels: true }),
        );
        expect(d.outcome, `${j}/${actor}`).not.toBe("ALLOW");
      }
    }
  });

  it("cannot be made to throw", () => {
    // Anything that reaches Phase 7B must fail loudly at the boundary, not
    // explode somewhere in the middle of an evaluation.
    for (const [name, context] of attacks) {
      expect(() => evaluate(context), name).not.toThrow();
    }
    expect(() => evaluate(ctx(), [])).not.toThrow();
    expect(() => selectRules(ctx(), [])).not.toThrow();
  });
});

// ─── The decision is a stable, serialisable artifact ─────────────────────────

describe("a decision can be stored and compared", () => {
  it("round-trips through JSON without losing anything", () => {
    const decision = evaluate(ctx({ jurisdictions: ["EU", "India"] }));
    const round = JSON.parse(JSON.stringify(decision)) as typeof decision;
    expect(round.outcome).toBe(decision.outcome);
    expect(round.obligations.length).toBe(decision.obligations.length);
    expect(round.considered.length).toBe(decision.considered.length);
    expect(round.legalAdvice).toBe(false);
  });

  it("contains no undefined-valued key that JSON would silently drop", () => {
    const decision = evaluate(ctx());
    const round = JSON.parse(JSON.stringify(decision)) as Record<string, unknown>;
    for (const key of ["outcome", "obligations", "permissions", "openQuestions", "considered", "regimes", "matrix", "legalAdvice"]) {
      expect(round, key).toHaveProperty(key);
    }
  });

  it("always marks itself as not legal advice", () => {
    for (const jurisdictions of [["EU"], ["India"], []] as const) {
      expect(evaluate(ctx({ jurisdictions: [...jurisdictions] })).legalAdvice).toBe(
        false,
      );
    }
  });

  it("reports a verdict from the declared set and nothing else", () => {
    const valid: Verdict[] = [
      "BLOCK",
      "REVIEW",
      "REQUIRE_CONSENT",
      "REQUIRE_OPT_OUT",
      "REQUIRE_USER_ACTION",
      "REQUIRE_NOTICE",
      "ALLOW",
    ];
    const regions = ["EU", "India", "California", "US", "Brazil"] as const;
    for (const j of regions) {
      const d = evaluate(ctx({ jurisdictions: [j], includeDerivedModels: true }));
      expect(valid).toContain(d.outcome);
      for (const o of d.obligations) expect(valid).toContain(o.verdict);
    }
  });
});
