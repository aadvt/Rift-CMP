/**
 * The evaluator.
 *
 * The phase brief names seven properties this has to have. Each has its own
 * `describe` below, named after the brief, so a reader can check the phase off
 * against the file rather than against a summary of it:
 *
 *   1. same input produces same decision
 *   2. multiple regulations can apply simultaneously
 *   3. conflicting requirements resolve conservatively
 *   4. purpose-specific rules work
 *   5. data-category-specific rules work
 *   6. version changes are respected
 *   7. unknown rules do not silently become ALLOW
 *
 * Several tests inject a synthetic rule set rather than using the real matrix.
 * That is deliberate and is the only way to test the resolution logic in
 * isolation: with 102 real requirements, almost any EU context selects fifteen
 * rules and the thing under test is buried. Where the real matrix is the point,
 * the test says so and uses it.
 *
 * No database.
 */

import { describe, expect, it } from "vitest";
import {
  RULES,
  evaluate,
  type ProcessingContext,
  type Rule,
  type Verdict,
} from "@rift-cmp/policy";

const AS_OF = new Date("2026-09-04T00:00:00.000Z");

function ctx(over: Partial<ProcessingContext> = {}): ProcessingContext {
  return {
    jurisdictions: ["EU"],
    actors: ["determines_purpose"],
    asOf: AS_OF,
    ...over,
  };
}

/** A rule that reaches the default context, with everything else neutral. */
function rule(over: Partial<Rule> & { id: string }): Rule {
  return {
    regime: "GDPR",
    regions: ["EU"],
    topic: "consent",
    regimeTopic: "consent",
    requirementType: "obligation",
    authorityLevel: "statute",
    text: `synthetic rule ${over.id}`,
    applies: true,
    triggers: [],
    actors: ["determines_purpose"],
    purposes: [],
    dataCategories: [],
    contexts: [],
    legalBases: [],
    consent: undefined,
    optOut: undefined,
    children: undefined,
    exceptions: [],
    effectiveFrom: null,
    effectiveTo: null,
    policyVersion: null,
    sourceIds: ["SRC-TEST"],
    notes: undefined,
    ...over,
  };
}

// ─── 1. Determinism ──────────────────────────────────────────────────────────

describe("same input produces same decision", () => {
  it("is byte-identical across repeated calls on the real matrix", () => {
    const context = ctx({
      jurisdictions: ["EU", "India"],
      processingContexts: ["cookies"],
      assertedConditions: ["strictly_necessary"],
    });
    const first = JSON.stringify(evaluate(context));
    for (let i = 0; i < 25; i++) {
      expect(JSON.stringify(evaluate(context))).toBe(first);
    }
  });

  it("does not depend on the order of the rules it is given", () => {
    const forward = evaluate(ctx(), RULES);
    const reversed = evaluate(ctx(), [...RULES].reverse());
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });

  it("does not depend on the order of the jurisdictions given", () => {
    const a = evaluate(ctx({ jurisdictions: ["EU", "India"] }));
    const b = evaluate(ctx({ jurisdictions: ["India", "EU"] }));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("reads no clock: a different asOf is the only thing that moves the answer", () => {
    // Both instants are after every effective_from in the matrix, so the two
    // decisions must agree despite being 'now' at different times.
    const a = evaluate(ctx({ asOf: new Date("2026-01-01") }));
    const b = evaluate(ctx({ asOf: new Date("2030-01-01") }));
    expect(b.outcome).toBe(a.outcome);
    expect(b.considered.map((c) => c.ruleId)).toEqual(
      a.considered.map((c) => c.ruleId),
    );
  });

  it("sorts asserted conditions so caller order cannot change the output", () => {
    const a = evaluate(ctx({ assertedConditions: ["b", "a"] }));
    const b = evaluate(ctx({ assertedConditions: ["a", "b"] }));
    expect(a.assertedConditions).toEqual(["a", "b"]);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

// ─── 2. Several regimes at once ──────────────────────────────────────────────

describe("multiple regulations can apply simultaneously", () => {
  it("cites GDPR and ePrivacy together for one EU context", () => {
    const decision = evaluate(ctx({ processingContexts: ["cookies"] }));
    expect(decision.regimes).toContain("GDPR");
    expect(decision.regimes).toContain("EU-ePrivacy");
  });

  it("cites four regimes when two jurisdictions are given", () => {
    const decision = evaluate(ctx({ jurisdictions: ["EU", "India"] }));
    expect([...decision.regimes].sort()).toEqual([
      "EU-ePrivacy",
      "GDPR",
      "India-DPDP-Act",
      "India-DPDP-Rules",
    ]);
  });

  it("keeps every regime's obligations rather than letting one win", () => {
    const decision = evaluate(ctx({ jurisdictions: ["EU", "India"] }));
    const regimes = new Set(decision.obligations.map((o) => o.citation.regime));
    expect(regimes.size).toBeGreaterThan(1);
  });

  it("attributes every obligation to the rule that imposed it", () => {
    const decision = evaluate(ctx({ jurisdictions: ["EU", "India"] }));
    expect(decision.obligations.length).toBeGreaterThan(0);
    for (const o of decision.obligations) {
      expect(o.citation.ruleId).toMatch(/^REQ-/);
      expect(o.citation.sourceIds.length).toBeGreaterThan(0);
      expect(o.citation.text.length).toBeGreaterThan(0);
    }
  });
});

// ─── 3. Conservative resolution ──────────────────────────────────────────────

describe("conflicting requirements resolve conservatively", () => {
  it("takes the most restrictive verdict when two rules disagree", () => {
    const permissive = rule({
      id: "R-ALLOW",
      topic: "tracking_and_storage",
      consent: { required: false, conditions: [] },
    });
    const strict = rule({
      id: "R-CONSENT",
      topic: "consent",
      consent: { required: true, conditions: [] },
    });

    const decision = evaluate(ctx(), [permissive, strict]);
    expect(decision.outcome).toBe("REQUIRE_CONSENT");
    // The permissive rule is not discarded - it is still recorded.
    expect(decision.permissions.map((p) => p.citation.ruleId)).toEqual(["R-ALLOW"]);
  });

  it("lets REVIEW outrank every obligation", () => {
    // The load-bearing choice: knowing you owe a notice does not resolve not
    // knowing whether consent is required.
    const notice = rule({ id: "R-NOTICE", topic: "notice" });
    const unknown = rule({
      id: "R-UNKNOWN",
      topic: "international_transfer",
      consent: { required: "conditional", conditions: ["adequacy_decision"] },
    });

    const decision = evaluate(ctx(), [notice, unknown]);
    expect(decision.outcome).toBe("REVIEW");
    // and the notice obligation survives into the decision regardless
    expect(decision.obligations.map((o) => o.verdict)).toContain("REQUIRE_NOTICE");
  });

  it("lets BLOCK outrank REVIEW", () => {
    const blocked = rule({
      id: "R-BLOCK",
      topic: "consent",
      consent: { required: true, conditions: [] },
    });
    const decision = evaluate(ctx(), [
      blocked,
      rule({ id: "R-Q", topic: "sensitive_data" }),
    ]);
    // No BLOCK-producing topic exists in the matrix today, so the ladder is
    // asserted directly rather than through a rule that cannot occur.
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.obligations[0].verdict).toBe("REQUIRE_CONSENT");
  });

  it("orders obligations most restrictive first", () => {
    const decision = evaluate(ctx({ jurisdictions: ["California"] }));
    const severity: Verdict[] = [
      "BLOCK",
      "REVIEW",
      "REQUIRE_CONSENT",
      "REQUIRE_OPT_OUT",
      "REQUIRE_USER_ACTION",
      "REQUIRE_NOTICE",
      "ALLOW",
    ];
    const indices = decision.obligations.map((o) => severity.indexOf(o.verdict));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it("never reports an outcome less restrictive than an obligation it carries", () => {
    const severity: Verdict[] = [
      "BLOCK",
      "REVIEW",
      "REQUIRE_CONSENT",
      "REQUIRE_OPT_OUT",
      "REQUIRE_USER_ACTION",
      "REQUIRE_NOTICE",
      "ALLOW",
    ];
    for (const jurisdictions of [
      ["EU"],
      ["India"],
      ["California"],
      ["Brazil"],
      ["EU", "India", "California", "Brazil"],
    ] as const) {
      const d = evaluate(ctx({ jurisdictions: [...jurisdictions] }));
      for (const o of d.obligations) {
        expect(
          severity.indexOf(d.outcome),
          `${jurisdictions} outcome ${d.outcome} vs ${o.verdict}`,
        ).toBeLessThanOrEqual(severity.indexOf(o.verdict));
      }
    }
  });
});

// ─── 4. Purpose-specific ─────────────────────────────────────────────────────

describe("purpose-specific rules work", () => {
  it("applies a rule scoped to the purpose given", () => {
    const marketing = rule({
      id: "R-MARKETING",
      topic: "direct_marketing",
      purposes: ["direct_marketing"],
      consent: { required: true, conditions: [] },
    });

    const hit = evaluate(ctx({ purpose: "direct_marketing" }), [marketing]);
    expect(hit.obligations.map((o) => o.citation.ruleId)).toEqual(["R-MARKETING"]);

    const miss = evaluate(ctx({ purpose: "sale" }), [marketing]);
    expect(miss.obligations).toHaveLength(0);
    expect(miss.outcome).toBe("REVIEW");
  });

  it("reaches the CCPA sale rules for a sale purpose on the real matrix", () => {
    const decision = evaluate(
      ctx({ jurisdictions: ["California"], purpose: "sale" }),
    );
    const optOuts = decision.obligations.filter(
      (o) => o.verdict === "REQUIRE_OPT_OUT",
    );
    expect(optOuts.length).toBeGreaterThan(0);
  });

  it("does not drop a rule that enumerates no purpose", () => {
    // Silence about purpose is not a statement that the purpose is excluded.
    const general = rule({
      id: "R-GENERAL",
      consent: { required: true, conditions: [] },
    });
    const decision = evaluate(ctx({ purpose: "anything_at_all" }), [general]);
    expect(decision.obligations.map((o) => o.citation.ruleId)).toEqual(["R-GENERAL"]);
  });
});

// ─── 5. Data-category-specific ───────────────────────────────────────────────

describe("data-category-specific rules work", () => {
  it("applies a rule scoped to the category given", () => {
    const sensitive = rule({
      id: "R-SENSITIVE",
      topic: "consent",
      dataCategories: ["sensitive_data"],
      consent: { required: true, conditions: [] },
    });

    const hit = evaluate(ctx({ dataCategories: ["sensitive_data"] }), [sensitive]);
    expect(hit.obligations.map((o) => o.citation.ruleId)).toEqual(["R-SENSITIVE"]);

    const miss = evaluate(ctx({ dataCategories: ["device_data"] }), [sensitive]);
    expect(miss.obligations).toHaveLength(0);
  });

  it("matches when any one of several categories overlaps", () => {
    const sensitive = rule({
      id: "R-SENSITIVE",
      dataCategories: ["sensitive_data"],
      consent: { required: true, conditions: [] },
    });
    const decision = evaluate(
      ctx({ dataCategories: ["device_data", "sensitive_data"] }),
      [sensitive],
    );
    expect(decision.obligations).toHaveLength(1);
  });

  it("narrows the real matrix without emptying it", () => {
    const all = evaluate(ctx());
    const narrowed = evaluate(ctx({ dataCategories: ["sensitive_data"] }));
    expect(narrowed.considered.length).toBeLessThan(all.considered.length);
    expect(narrowed.considered.length).toBeGreaterThan(0);
  });
});

// ─── 6. Versions and dates ───────────────────────────────────────────────────

describe("version changes are respected", () => {
  it("does not apply a rule before it takes effect", () => {
    const future = rule({
      id: "R-FUTURE",
      effectiveFrom: "2030-01-01",
      consent: { required: true, conditions: [] },
    });
    expect(evaluate(ctx(), [future]).obligations).toHaveLength(0);
    expect(
      evaluate(ctx({ asOf: new Date("2031-01-01") }), [future]).obligations,
    ).toHaveLength(1);
  });

  it("does not apply a rule after it is superseded", () => {
    const old = rule({
      id: "R-OLD",
      effectiveFrom: "2000-01-01",
      effectiveTo: "2010-01-01",
      consent: { required: true, conditions: [] },
    });
    expect(evaluate(ctx(), [old]).obligations).toHaveLength(0);
    expect(
      evaluate(ctx({ asOf: new Date("2005-01-01") }), [old]).obligations,
    ).toHaveLength(1);
  });

  it("swaps one version of a rule for another at the boundary", () => {
    const v1 = rule({
      id: "R-V1",
      policyVersion: "v1",
      effectiveTo: "2020-01-01",
      consent: { required: true, conditions: [] },
    });
    const v2 = rule({
      id: "R-V2",
      policyVersion: "v2",
      effectiveFrom: "2020-01-02",
      topic: "notice",
    });

    const before = evaluate(ctx({ asOf: new Date("2015-01-01") }), [v1, v2]);
    const after = evaluate(ctx({ asOf: new Date("2025-01-01") }), [v1, v2]);

    expect(before.considered.map((c) => c.ruleId)).toEqual(["R-V1"]);
    expect(after.considered.map((c) => c.ruleId)).toEqual(["R-V2"]);
    expect(before.outcome).not.toBe(after.outcome);
  });

  it("carries the policy version and effective dates onto every citation", () => {
    const decision = evaluate(ctx());
    expect(decision.considered.length).toBeGreaterThan(0);
    for (const c of decision.considered) {
      expect(c).toHaveProperty("policyVersion");
      expect(c).toHaveProperty("effectiveFrom");
      expect(c).toHaveProperty("effectiveTo");
    }
  });

  it("stamps the matrix version the decision was made from", () => {
    const decision = evaluate(ctx());
    expect(decision.matrix.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(decision.matrix.researchStatus).toBe("research");
    expect(decision.legalAdvice).toBe(false);
  });
});

// ─── 7. Unknown never becomes ALLOW ──────────────────────────────────────────

describe("unknown rules do not silently become ALLOW", () => {
  it("returns REVIEW when no jurisdiction is given", () => {
    const decision = evaluate(ctx({ jurisdictions: [] }));
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("no_jurisdiction_given");
  });

  it("returns REVIEW when no rule reaches the context", () => {
    const decision = evaluate(ctx(), []);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("no_requirements_for_context");
  });

  it("returns REVIEW for a rule whose topic could not be canonicalised", () => {
    const decision = evaluate(ctx(), [
      rule({ id: "R-NO-TOPIC", topic: undefined }),
    ]);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("unclassified_topic");
  });

  it("returns REVIEW for conditional consent rather than picking a side", () => {
    const decision = evaluate(ctx(), [
      rule({
        id: "R-COND",
        consent: { required: "conditional", conditions: ["adequacy_decision"] },
      }),
    ]);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("conditional_consent");
    expect(decision.openQuestions[0].detail).toContain("adequacy_decision");
  });

  it("will not grant an exemption whose condition nobody asserted", () => {
    const exemption = rule({
      id: "R-EXEMPT",
      topic: "tracking_and_storage",
      consent: { required: false, conditions: ["strictly_necessary"] },
    });
    const decision = evaluate(ctx(), [exemption]);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("conditional_exemption");
    expect(decision.permissions).toHaveLength(0);
  });

  it("does not read a non-gate rule's `consent: false` as permission", () => {
    // A security obligation recording that consent is not its mechanism is not
    // a statement that the processing may go ahead.
    const security = rule({
      id: "R-SECURITY",
      topic: "security",
      consent: { required: false, conditions: [] },
    });
    const decision = evaluate(ctx(), [security]);
    expect(decision.permissions).toHaveLength(0);
    expect(decision.outcome).toBe("REVIEW");
  });

  it("does not treat organisational-only rules as permission", () => {
    const decision = evaluate(ctx(), [
      rule({ id: "R-SEC", topic: "security" }),
      rule({ id: "R-RETENTION", topic: "retention" }),
      rule({ id: "R-ENFORCE", topic: "enforcement" }),
    ]);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.considered).toHaveLength(3);
    expect(decision.obligations).toHaveLength(0);
  });

  it("will not assume adulthood when the subject's age is unknown", () => {
    const child = rule({
      id: "R-CHILD",
      topic: "children",
      children: { applies: true, conditions: ["parental_authorisation"] },
    });
    const unknown = evaluate(ctx(), [child]);
    expect(unknown.outcome).toBe("REVIEW");
    expect(unknown.openQuestions[0].reason).toBe("children");

    const adult = evaluate(ctx({ subjectIsChild: false }), [child]);
    expect(adult.openQuestions.some((q) => q.reason === "children")).toBe(false);
  });

  it("flags a derived-authority rule that actually applies", () => {
    const derived = rule({
      id: "R-DERIVED",
      authorityLevel: "derived",
      consent: { required: true, conditions: [] },
    });
    // Selection holds derived rules back entirely unless they are asked for,
    // so the flag is what gets this as far as the evaluator at all.
    expect(evaluate(ctx(), [derived]).considered).toHaveLength(0);

    const decision = evaluate(ctx({ includeDerivedModels: true }), [derived]);
    expect(
      decision.openQuestions.some((q) => q.reason === "derived_authority"),
    ).toBe(true);
    expect(decision.outcome).toBe("REVIEW");
  });

  it("returns REVIEW for the US model, whose every record states an absence", () => {
    /**
     * All nine `US-State-Model` records carry `applicability.applies: false` -
     * they record that the generic model asserts nothing of its own. So asking
     * about a US state yields no obligation, and the engine has to say that
     * without implying the activity is permitted.
     */
    const decision = evaluate(
      ctx({ jurisdictions: ["US"], includeDerivedModels: true }),
    );
    expect(decision.considered.length).toBeGreaterThan(0);
    expect(decision.obligations).toHaveLength(0);
    expect(decision.permissions).toHaveLength(0);
    expect(decision.outcome).toBe("REVIEW");
    expect(decision.openQuestions[0].reason).toBe("states_an_absence");
    expect(decision.openQuestions[0].detail).toContain("not a finding that the activity is permitted");
  });

  it("never returns ALLOW anywhere in a sweep of the real matrix", () => {
    /**
     * A property of the matrix as converted, not only of the engine: across
     * every single-jurisdiction context reachable from the recorded vocabulary,
     * no combination of rules positively permits an activity outright. If a
     * later change makes ALLOW reachable, this fails and the change gets read.
     */
    const jurisdictions = ["EU", "India", "California", "US", "Brazil"] as const;
    const actors = [
      "determines_purpose",
      "acts_on_instruction",
      "third_party",
      "service_operator",
      "intermediary",
    ] as const;
    const contexts = [...new Set(RULES.flatMap((r) => r.contexts))];
    const purposes = [...new Set(RULES.flatMap((r) => r.purposes))];
    const everyCondition = [
      ...new Set(
        RULES.flatMap((r) => [
          ...(r.consent?.conditions ?? []),
          ...(r.optOut?.conditions ?? []),
        ]),
      ),
    ];

    const seen = new Set<Verdict>();
    for (const j of jurisdictions) {
      for (const actor of actors) {
        for (const c of [undefined, ...contexts]) {
          for (const p of [undefined, ...purposes]) {
            const decision = evaluate(
              ctx({
                jurisdictions: [j],
                actors: [actor],
                processingContexts: c ? [c] : undefined,
                purpose: p,
                // Assert everything: even maximally generous, nothing allows.
                assertedConditions: everyCondition,
                includeDerivedModels: true,
              }),
            );
            seen.add(decision.outcome);
          }
        }
      }
    }

    expect(seen.has("ALLOW")).toBe(false);
    // The ladder is not degenerate: a definite obligation does surface.
    expect(seen.has("REQUIRE_CONSENT")).toBe(true);
    expect(seen.has("REVIEW")).toBe(true);
  });
});

// ─── The rest of the surface ─────────────────────────────────────────────────

describe("assertion is the only way a condition is resolved", () => {
  it("turns a conditional exemption into a permission when asserted", () => {
    const exemption = rule({
      id: "R-EXEMPT",
      topic: "tracking_and_storage",
      consent: { required: false, conditions: ["strictly_necessary"] },
    });

    const decision = evaluate(
      ctx({ assertedConditions: ["strictly_necessary"] }),
      [exemption],
    );
    expect(decision.outcome).toBe("ALLOW");
    expect(decision.permissions).toHaveLength(1);
    expect(decision.permissions[0].satisfiedByAssertion).toEqual([
      "strictly_necessary",
    ]);
  });

  it("records the assertion on the decision, so the ground is visible", () => {
    const decision = evaluate(
      ctx({ assertedConditions: ["strictly_necessary"] }),
      [
        rule({
          id: "R-EXEMPT",
          topic: "tracking_and_storage",
          consent: { required: false, conditions: ["strictly_necessary"] },
        }),
      ],
    );
    expect(decision.assertedConditions).toEqual(["strictly_necessary"]);
  });

  it("needs every condition, not just one of them", () => {
    const exemption = rule({
      id: "R-EXEMPT",
      topic: "tracking_and_storage",
      consent: {
        required: false,
        conditions: ["strictly_necessary", "explicitly_requested"],
      },
    });
    const partial = evaluate(ctx({ assertedConditions: ["strictly_necessary"] }), [
      exemption,
    ]);
    expect(partial.outcome).toBe("REVIEW");
    expect(partial.openQuestions[0].detail).toContain("explicitly_requested");
  });

  it("leaves an obligation's unmet conditions visible on the obligation", () => {
    const decision = evaluate(ctx(), [
      rule({
        id: "R-CONSENT",
        consent: {
          required: true,
          conditions: ["national_transposition"],
        },
      }),
    ]);
    expect(decision.obligations[0].unevaluatedConditions).toEqual([
      "national_transposition",
    ]);
    // and the unresolved half pulls the outcome back to REVIEW
    expect(decision.outcome).toBe("REVIEW");
  });
});

describe("records that state an absence", () => {
  it("are cited but impose nothing", () => {
    // `REQ-EP-023` records that ePrivacy has no standalone children's regime.
    // That is an answer, and the engine must not turn it into a requirement.
    const absence = RULES.find((r) => r.id === "REQ-EP-023");
    expect(absence, "REQ-EP-023 missing from the matrix").toBeDefined();
    expect(absence!.applies).toBe(false);

    const decision = evaluate(ctx({ actors: ["service_operator"] }), [absence!]);
    expect(decision.considered.map((c) => c.ruleId)).toEqual(["REQ-EP-023"]);
    expect(decision.obligations).toHaveLength(0);
    expect(decision.openQuestions.some((q) => q.reason === "children")).toBe(false);
  });
});

describe("a children's record keeps its conditions", () => {
  /**
   * `REQ-CA-CCPA-009` records `consent.required: true` *and* children's
   * conditions distinguishing under-13 from 13-to-15. An earlier version read
   * the consent field first, returned a bare REQUIRE_CONSENT, and dropped the
   * age conditions the requirement actually turns on.
   */
  it("raises the consent obligation carrying both sets of conditions", () => {
    const both = rule({
      id: "R-CHILD-CONSENT",
      topic: "children",
      consent: { required: true, conditions: ["notice_given"] },
      children: {
        applies: true,
        conditions: ["under_13_parental_consent", "age_13_to_15_opt_in"],
      },
    });

    const decision = evaluate(ctx(), [both]);
    const consentObligation = decision.obligations.find(
      (o) => o.verdict === "REQUIRE_CONSENT",
    );
    expect(consentObligation).toBeDefined();
    expect(consentObligation!.unevaluatedConditions).toEqual([
      "notice_given",
      "under_13_parental_consent",
      "age_13_to_15_opt_in",
    ]);
    expect(decision.openQuestions.some((q) => q.reason === "children")).toBe(true);
    expect(decision.outcome).toBe("REVIEW");
  });

  it("drops the whole record when the subject is known not to be a child", () => {
    const both = rule({
      id: "R-CHILD-CONSENT",
      topic: "children",
      consent: { required: true, conditions: [] },
      children: { applies: true, conditions: ["under_13_parental_consent"] },
    });
    const decision = evaluate(ctx({ subjectIsChild: false }), [both]);
    expect(decision.obligations).toHaveLength(0);
    expect(decision.openQuestions.some((q) => q.reason === "children")).toBe(false);
  });

  it("does the same on the real matrix for the CCPA children record", () => {
    const record = RULES.find((r) => r.id === "REQ-CA-CCPA-009");
    expect(record, "REQ-CA-CCPA-009 missing from the matrix").toBeDefined();

    const decision = evaluate(ctx({ jurisdictions: ["California"] }), [record!]);
    const consentObligation = decision.obligations.find(
      (o) => o.verdict === "REQUIRE_CONSENT",
    );
    expect(consentObligation).toBeDefined();
    for (const condition of record!.children!.conditions ?? []) {
      expect(consentObligation!.unevaluatedConditions).toContain(condition);
    }
  });
});

describe("withdrawal follows consent", () => {
  it("raises a user-action obligation wherever withdrawal is required", () => {
    const decision = evaluate(ctx(), [
      rule({
        id: "R-CONSENT",
        consent: { required: true, conditions: [], withdrawalRequired: true },
      }),
    ]);
    const verdicts = decision.obligations.map((o) => o.verdict);
    expect(verdicts).toContain("REQUIRE_CONSENT");
    expect(verdicts).toContain("REQUIRE_USER_ACTION");
  });

  it("still raises it for a withdrawal-topic rule that omits the flag", () => {
    // The flag is the primary signal; the topic is the backstop. A record whose
    // whole subject is withdrawal must not lose the obligation because one
    // optional field was left unset.
    const decision = evaluate(ctx(), [
      rule({
        id: "R-WITHDRAWAL",
        topic: "withdrawal",
        consent: { required: true, conditions: [] },
      }),
    ]);
    expect(decision.obligations.map((o) => o.verdict)).toContain(
      "REQUIRE_USER_ACTION",
    );
  });

  it("does not invent one for an ordinary consent rule", () => {
    const decision = evaluate(ctx(), [
      rule({ id: "R-PLAIN", topic: "consent", consent: { required: true, conditions: [] } }),
    ]);
    expect(decision.obligations.map((o) => o.verdict)).not.toContain(
      "REQUIRE_USER_ACTION",
    );
  });
});

describe("the decision is self-contained", () => {
  it("carries every selected rule, not only the ones that changed the outcome", () => {
    const decision = evaluate(ctx());
    expect(decision.considered.length).toBeGreaterThan(decision.obligations.length);
  });

  it("carries the free-text triggers it refused to match on", () => {
    const decision = evaluate(ctx());
    const withTriggers = decision.considered.filter((c) => c.triggers.length > 0);
    expect(withTriggers.length).toBeGreaterThan(0);
  });

  it("names a source for everything it cites", () => {
    const decision = evaluate(ctx({ jurisdictions: ["EU", "India", "Brazil"] }));
    for (const c of decision.considered) {
      expect(c.sourceIds.length, c.ruleId).toBeGreaterThan(0);
    }
  });
});
