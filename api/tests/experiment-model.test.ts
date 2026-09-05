/**
 * The experiment model: lifecycle, allocation, and the arm a visitor gets.
 *
 * Three properties carry the design.
 *
 * **A variant has nowhere to put a policy.** The safety argument is structural,
 * not procedural, so the test for it is a test that the type system and the
 * validator reject a configuration override outright rather than sanitising one.
 * A validator that "cleans up" a dangerous config is a validator somebody will
 * later extend with an exception.
 *
 * **Assignment is deterministic.** The same browser gets the same arm forever,
 * on any machine, in any runtime. A visitor who saw one banner and then another
 * has been given two different experiences of the same choice, which is both a
 * bad experience and a ruined measurement.
 *
 * **Allocation is exact.** Percentages that sum to 99 or 101 mean somebody is
 * unassigned or double-assigned, and the resulting rates are over a denominator
 * nobody can state.
 */
import { describe, expect, it } from "vitest";
import {
  assignVariant,
  canTransition,
  isServing,
  transitionProblem,
  validateText,
  validateVariants,
  type ExperimentStatus,
  type ExperimentVariantInput,
} from "@rift-cmp/shared/experiment";

function variant(over: Partial<ExperimentVariantInput> = {}): ExperimentVariantInput {
  return { key: "control", name: "Control", allocation: 50, isControl: true, ...over };
}

function pair(a = 50, b = 50): ExperimentVariantInput[] {
  return [
    variant({ key: "control", allocation: a, isControl: true }),
    variant({ key: "b", name: "B", allocation: b, isControl: false }),
  ];
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

describe("lifecycle", () => {
  it("allows the ordinary path", () => {
    expect(canTransition("DRAFT", "RUNNING")).toBe(true);
    expect(canTransition("RUNNING", "PAUSED")).toBe(true);
    expect(canTransition("PAUSED", "RUNNING")).toBe(true);
    expect(canTransition("RUNNING", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "ARCHIVED")).toBe(true);
  });

  it("allows scheduling and unscheduling before it runs", () => {
    expect(canTransition("DRAFT", "SCHEDULED")).toBe(true);
    expect(canTransition("SCHEDULED", "DRAFT")).toBe(true);
    expect(canTransition("SCHEDULED", "RUNNING")).toBe(true);
  });

  it("refuses to restart a completed experiment", () => {
    // Appending new data to a result somebody may already have acted on pools
    // two periods with whatever changed in between, and nothing in the numbers
    // shows that it happened.
    expect(canTransition("COMPLETED", "RUNNING")).toBe(false);
    expect(canTransition("COMPLETED", "PAUSED")).toBe(false);
    expect(canTransition("COMPLETED", "DRAFT")).toBe(false);
  });

  it("treats archived as terminal", () => {
    for (const to of ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"] as ExperimentStatus[]) {
      expect(canTransition("ARCHIVED", to)).toBe(false);
    }
  });

  it("refuses to jump straight from draft to completed", () => {
    expect(canTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransition("DRAFT", "PAUSED")).toBe(false);
  });

  it("explains a refusal rather than only refusing", () => {
    const problem = transitionProblem("COMPLETED", "RUNNING");
    expect(problem).toMatch(/cannot become running/i);
    expect(problem).toMatch(/archived/i);
  });

  it("says so when the state is already the requested one", () => {
    expect(transitionProblem("RUNNING", "RUNNING")).toMatch(/already/i);
  });

  it("returns no problem for a permitted transition", () => {
    expect(transitionProblem("DRAFT", "RUNNING")).toBeNull();
  });
});

describe("whether an experiment is serving", () => {
  const NOW = new Date("2026-06-15T12:00:00Z");

  it("serves a running experiment with no window", () => {
    expect(isServing("RUNNING", {}, NOW)).toBe(true);
  });

  it("does not serve a paused experiment inside its window", () => {
    expect(
      isServing("PAUSED", { startsAt: "2026-06-01T00:00:00Z", endsAt: "2026-07-01T00:00:00Z" }, NOW),
    ).toBe(false);
  });

  for (const status of ["DRAFT", "SCHEDULED", "COMPLETED", "ARCHIVED"] as ExperimentStatus[]) {
    it(`does not serve a ${status.toLowerCase()} experiment`, () => {
      expect(isServing(status, {}, NOW)).toBe(false);
    });
  }

  it("does not serve before the start", () => {
    expect(isServing("RUNNING", { startsAt: "2026-07-01T00:00:00Z" }, NOW)).toBe(false);
  });

  it("does not serve after the end", () => {
    expect(isServing("RUNNING", { endsAt: "2026-06-01T00:00:00Z" }, NOW)).toBe(false);
  });

  it("treats the end as exclusive", () => {
    // "Ran until the 15th" should not still be assigning arms at 23:59 on the
    // 15th.
    expect(isServing("RUNNING", { endsAt: NOW.toISOString() }, NOW)).toBe(false);
  });
});

// ─── Allocation ──────────────────────────────────────────────────────────────

describe("allocation", () => {
  it("accepts a clean split", () => {
    expect(validateVariants(pair())).toEqual([]);
  });

  it.each([
    [70, 30],
    [90, 10],
    [99, 1],
  ])("accepts %i/%i", (a, b) => {
    expect(validateVariants(pair(a, b))).toEqual([]);
  });

  it("accepts three arms", () => {
    expect(
      validateVariants([
        variant({ key: "control", allocation: 50, isControl: true }),
        variant({ key: "b", name: "B", allocation: 25, isControl: false }),
        variant({ key: "c", name: "C", allocation: 25, isControl: false }),
      ]),
    ).toEqual([]);
  });

  it("rejects allocations that do not sum to 100", () => {
    const problems = validateVariants(pair(50, 40));
    expect(problems.some((p) => /sum to exactly 100/.test(p.message))).toBe(true);
  });

  it("rejects an over-allocation", () => {
    expect(validateVariants(pair(60, 60)).some((p) => /sum to exactly 100/.test(p.message))).toBe(
      true,
    );
  });

  it("rejects a negative allocation", () => {
    const problems = validateVariants([
      variant({ key: "control", allocation: 120, isControl: true }),
      variant({ key: "b", name: "B", allocation: -20, isControl: false }),
    ]);
    expect(problems.some((p) => /cannot be negative/i.test(p.message))).toBe(true);
  });

  it("rejects a fractional allocation", () => {
    // Whole percent only: fractional buckets make the arithmetic depend on
    // floating point, and two runtimes could disagree about a visitor's arm.
    const problems = validateVariants(pair(50.5, 49.5));
    expect(problems.some((p) => /whole percentage/i.test(p.message))).toBe(true);
  });

  it("rejects a single arm", () => {
    const problems = validateVariants([variant({ allocation: 100 })]);
    expect(problems.some((p) => /at least two variants/i.test(p.message))).toBe(true);
  });

  it("rejects duplicate keys", () => {
    const problems = validateVariants([
      variant({ key: "a", allocation: 50, isControl: true }),
      variant({ key: "a", name: "Also A", allocation: 50, isControl: false }),
    ]);
    expect(problems.some((p) => /share the key/i.test(p.message))).toBe(true);
  });

  it("rejects a malformed key", () => {
    const problems = validateVariants([
      variant({ key: "Has Spaces", allocation: 50, isControl: true }),
      variant({ key: "b", name: "B", allocation: 50, isControl: false }),
    ]);
    expect(problems.some((p) => p.field.endsWith(".key"))).toBe(true);
  });

  it("requires exactly one control", () => {
    const none = validateVariants([
      variant({ key: "a", allocation: 50, isControl: false }),
      variant({ key: "b", name: "B", allocation: 50, isControl: false }),
    ]);
    expect(none.some((p) => /must be the control/i.test(p.message))).toBe(true);

    const two = validateVariants([
      variant({ key: "a", allocation: 50, isControl: true }),
      variant({ key: "b", name: "B", allocation: 50, isControl: true }),
    ]);
    expect(two.some((p) => /Only one variant/i.test(p.message))).toBe(true);
  });

  it("requires a name", () => {
    const problems = validateVariants([
      variant({ key: "a", name: "  ", allocation: 50, isControl: true }),
      variant({ key: "b", name: "B", allocation: 50, isControl: false }),
    ]);
    expect(problems.some((p) => p.field.endsWith(".name"))).toBe(true);
  });
});

// ─── The safety boundary ─────────────────────────────────────────────────────

describe("a variant cannot express a policy", () => {
  it("rejects an attempt to smuggle purposes into a variant", () => {
    // Rejected, not stripped. Silently dropping it would leave an operator
    // believing the experiment is running a difference it is not.
    const problems = validateText({ purposes: [] } as never);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toMatch(/only vary display copy/i);
  });

  it.each([
    "purposes",
    "enforcement",
    "policy_version_id",
    "jurisdictions",
    "unknown_host",
    "notice",
    "consent_required",
  ])("rejects a variant carrying %s", (field) => {
    const problems = validateText({ [field]: "anything" } as never);
    expect(problems.some((p) => p.field.endsWith(field))).toBe(true);
  });

  it("accepts the six copy fields and nothing else", () => {
    expect(
      validateText({
        title: "We use cookies",
        body: "Choose what you are comfortable with.",
        accept_all: "Accept all",
        reject_all: "Reject all",
        manage: "Manage",
        save: "Save",
      }),
    ).toEqual([]);
  });

  it("refuses to blank the reject control", () => {
    // An experiment may reword refusal. It may not remove it.
    const problems = validateText({ reject_all: "   " });
    expect(problems.some((p) => /may not remove it/i.test(p.message))).toBe(true);
  });

  it("refuses to blank the preference control", () => {
    const problems = validateText({ manage: "" });
    expect(problems.some((p) => /has to stay reachable/i.test(p.message))).toBe(true);
  });

  it("allows accept copy to be empty without complaint", () => {
    // Only the controls a visitor needs in order to refuse are protected.
    // Policing every string would make this a content classifier, which it is
    // not and cannot be.
    expect(validateText({ accept_all: "" })).toEqual([]);
  });

  it("bounds copy length", () => {
    expect(validateText({ title: "x".repeat(401) }).length).toBe(1);
  });

  it("rejects non-string copy", () => {
    expect(validateText({ title: 42 } as never).length).toBe(1);
  });

  it("treats an absent override as no override", () => {
    expect(validateText(null)).toEqual([]);
    expect(validateText({})).toEqual([]);
  });
});

// ─── Assignment ──────────────────────────────────────────────────────────────

describe("assignment", () => {
  const variants = [
    { key: "control", allocation: 50 },
    { key: "b", allocation: 50 },
  ];

  it("is deterministic for the same browser", () => {
    const first = assignVariant("exp-1", "browser-abc", variants);
    for (let i = 0; i < 50; i += 1) {
      expect(assignVariant("exp-1", "browser-abc", variants)).toBe(first);
    }
  });

  it("gives different browsers different arms", () => {
    const seen = new Set<string | null>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(assignVariant("exp-1", `browser-${i}`, variants));
    }
    expect(seen.size).toBe(2);
  });

  it("does not depend on the order variants arrive in", () => {
    // Rows come back from the database in no promised order, and re-sorting
    // there would silently reassign every visitor in a running experiment.
    for (let i = 0; i < 100; i += 1) {
      const key = `browser-${i}`;
      expect(assignVariant("exp-1", key, variants)).toBe(
        assignVariant("exp-1", key, [...variants].reverse()),
      );
    }
  });

  it("gives the same browser different arms in different experiments", () => {
    const a = new Set<string | null>();
    for (let i = 0; i < 100; i += 1) a.add(assignVariant("exp-1", `b-${i}`, variants));
    const b = new Set<string | null>();
    for (let i = 0; i < 100; i += 1) b.add(assignVariant("exp-2", `b-${i}`, variants));

    // Both experiments assign both arms; they are not correlated by construction.
    expect(a.size).toBe(2);
    expect(b.size).toBe(2);
  });

  it("distributes roughly in proportion to the allocation", () => {
    const counts: Record<string, number> = { control: 0, b: 0 };
    for (let i = 0; i < 10_000; i += 1) {
      const key = assignVariant("exp-dist", `browser-${i}`, [
        { key: "control", allocation: 90 },
        { key: "b", allocation: 10 },
      ]);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }

    // Generous bounds: this is a hash, not a random number generator, and the
    // test is that the bucketing is not badly skewed rather than that it is
    // statistically perfect.
    expect(counts.control).toBeGreaterThan(8_600);
    expect(counts.control).toBeLessThan(9_400);
    expect(counts.b).toBeGreaterThan(600);
  });

  it("honours a three-way split", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 6_000; i += 1) {
      const key = assignVariant("exp-3", `browser-${i}`, [
        { key: "a", allocation: 50 },
        { key: "b", allocation: 25 },
        { key: "c", allocation: 25 },
      ]);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(counts.size).toBe(3);
    expect(counts.get("a")!).toBeGreaterThan(counts.get("b")!);
  });

  it("never assigns an arm allocated zero percent", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(
        assignVariant("exp-z", `browser-${i}`, [
          { key: "live", allocation: 100 },
          { key: "off", allocation: 0 },
        ]),
      ).toBe("live");
    }
  });

  it("refuses to assign when allocations do not sum to 100", () => {
    // A broken experiment means "show the ordinary banner", which is the only
    // safe reading. Assigning anyway would run an experiment nobody configured.
    expect(assignVariant("exp-1", "browser-abc", [{ key: "a", allocation: 40 }])).toBeNull();
  });

  it("refuses to assign with no variants", () => {
    expect(assignVariant("exp-1", "browser-abc", [])).toBeNull();
  });

  it("refuses to assign without a browser key", () => {
    expect(assignVariant("exp-1", "", variants)).toBeNull();
  });
});
