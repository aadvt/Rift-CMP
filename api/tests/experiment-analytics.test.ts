/**
 * The statistics, and the refusal to produce one.
 *
 * The failure this file is written against is a dashboard that renders every
 * difference between two arms as though it meant something. Two arms always
 * differ; most of those differences are noise; and an operator who ships on the
 * strength of forty visitors has been misled by their tooling rather than by
 * their data.
 *
 * So the tests come in two halves. One checks the z-test against hand-computable
 * cases — a real method producing real numbers. The other checks that it
 * *declines* wherever its own preconditions fail, and says why, instead of
 * emitting a p-value that looks identical and means less.
 */
import { describe, expect, it } from "vitest";
import {
  MINIMUM_SAMPLE,
  compareProportions,
  COMPARISON_CAVEATS,
  POLICY_COMPARISON_CAVEATS,
} from "@rift-cmp/shared/experiment-analytics";

describe("refusing to test what cannot be tested", () => {
  it("declines when an arm is below the minimum sample", () => {
    const result = compareProportions(
      { successes: 8, total: 10 },
      { successes: 5, total: 10 },
    );

    expect(result.reading).toBe("observed_difference");
    expect(result.p_value).toBeNull();
    expect(result.method).toBeNull();
    expect(result.note).toMatch(/at least 30/i);
  });

  it("declines when only one arm is short", () => {
    // A large control does not rescue a tiny variant.
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 6, total: 10 },
    );
    expect(result.reading).toBe("observed_difference");
    expect(result.p_value).toBeNull();
  });

  it("still reports the observed difference when it declines", () => {
    // Declining to test is not declining to describe. The numbers are real;
    // what is withheld is the claim that they mean something.
    const result = compareProportions(
      { successes: 5, total: 10 },
      { successes: 8, total: 10 },
    );
    expect(result.difference).toBeCloseTo(0.3, 5);
  });

  it("declines when both arms produced the same rate", () => {
    // Zero standard error. Dividing would produce an infinity that renders as a
    // very confident result.
    const result = compareProportions(
      { successes: 100, total: 100 },
      { successes: 100, total: 100 },
    );
    expect(result.reading).toBe("observed_difference");
    expect(result.z).toBeNull();
    expect(result.note).toMatch(/nothing to test/i);
  });

  it("declines on empty arms without dividing by zero", () => {
    const result = compareProportions({ successes: 0, total: 0 }, { successes: 0, total: 0 });
    expect(result.reading).toBe("observed_difference");
    expect(result.difference).toBeNull();
    expect(Number.isFinite(result.z ?? 0)).toBe(true);
  });

  it("reports the sample so a reader can judge for themselves", () => {
    const result = compareProportions({ successes: 3, total: 5 }, { successes: 4, total: 7 });
    expect(result.sample).toEqual({ control: 5, variant: 7 });
  });

  it("names the threshold it applies", () => {
    expect(MINIMUM_SAMPLE).toBe(30);
  });
});

describe("the test, where it applies", () => {
  it("finds a large, well-sampled difference significant", () => {
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 650, total: 1000 },
    );

    expect(result.reading).toBe("significant");
    expect(result.method).toBe("two-proportion z-test");
    expect(result.confidence_level).toBe(0.95);
    expect(result.p_value).toBeLessThan(0.05);
    expect(result.difference).toBeCloseTo(0.15, 3);
  });

  it("does not find a small difference significant at scale", () => {
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 510, total: 1000 },
    );

    expect(result.reading).toBe("not_significant");
    // A method still ran, and said so. "We tested and found nothing" is a
    // different statement from "we could not test".
    expect(result.method).toBe("two-proportion z-test");
    expect(result.p_value).toBeGreaterThan(0.05);
  });

  it("computes a z-score that matches the closed form", () => {
    // p1 = 0.5, p2 = 0.6, n = 1000 each. Pooled p = 0.55.
    // se = sqrt(0.55 * 0.45 * (2/1000)) = 0.0222486
    // z  = 0.1 / 0.0222486 = 4.4947
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 600, total: 1000 },
    );
    expect(result.z).toBeCloseTo(4.495, 2);
  });

  it("produces an interval that contains the difference", () => {
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 600, total: 1000 },
    );

    expect(result.interval).not.toBeNull();
    expect(result.interval!.lower).toBeLessThan(result.difference!);
    expect(result.interval!.upper).toBeGreaterThan(result.difference!);
  });

  it("excludes zero from the interval when the result is significant", () => {
    const result = compareProportions(
      { successes: 300, total: 1000 },
      { successes: 500, total: 1000 },
    );
    expect(result.reading).toBe("significant");
    expect(result.interval!.lower).toBeGreaterThan(0);
  });

  it("includes zero in the interval when it is not", () => {
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 505, total: 1000 },
    );
    expect(result.reading).toBe("not_significant");
    expect(result.interval!.lower).toBeLessThan(0);
    expect(result.interval!.upper).toBeGreaterThan(0);
  });

  it("is symmetric in magnitude when the arms are swapped", () => {
    const forward = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 600, total: 1000 },
    );
    const reversed = compareProportions(
      { successes: 600, total: 1000 },
      { successes: 500, total: 1000 },
    );

    expect(reversed.difference).toBeCloseTo(-forward.difference!, 5);
    expect(Math.abs(reversed.z!)).toBeCloseTo(Math.abs(forward.z!), 2);
    expect(reversed.p_value).toBeCloseTo(forward.p_value!, 4);
  });

  it("gives a p-value in range", () => {
    for (const [cs, vs] of [
      [500, 500],
      [499, 501],
      [100, 900],
      [900, 100],
    ] as Array<[number, number]>) {
      const result = compareProportions(
        { successes: cs, total: 1000 },
        { successes: vs, total: 1000 },
      );
      if (result.p_value !== null) {
        expect(result.p_value).toBeGreaterThanOrEqual(0);
        expect(result.p_value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("runs at exactly the minimum sample", () => {
    const result = compareProportions(
      { successes: 5, total: MINIMUM_SAMPLE },
      { successes: 25, total: MINIMUM_SAMPLE },
    );
    expect(result.method).toBe("two-proportion z-test");
  });

  it("never declares a winner", () => {
    // There is no field on this result that names an arm. A dashboard cannot
    // render "variant B wins" from it without inventing the claim itself.
    const result = compareProportions(
      { successes: 500, total: 1000 },
      { successes: 900, total: 1000 },
    );
    expect(Object.keys(result)).not.toContain("winner");
    expect(JSON.stringify(result)).not.toMatch(/win/i);
  });
});

describe("what the comparison says about itself", () => {
  it("warns that acceptance is not a quality measure", () => {
    // The single most likely misreading: an arm that lifts acceptance by asking
    // less clearly has not improved anything this product measures.
    expect(COMPARISON_CAVEATS.join(" ")).toMatch(/not a quality measure/i);
  });

  it("says shadow tracker and drift counts are site-wide", () => {
    expect(COMPARISON_CAVEATS.join(" ")).toMatch(/site-wide/i);
  });

  it("says rates count people rather than decisions", () => {
    expect(COMPARISON_CAVEATS.join(" ")).toMatch(/count people, not decisions/i);
  });

  it("admits a browser can see both arms", () => {
    expect(COMPARISON_CAVEATS.join(" ")).toMatch(/two browsers|clearing site data/i);
  });

  it("refuses to claim a policy version caused anything", () => {
    expect(POLICY_COMPARISON_CAVEATS.join(" ")).toMatch(/observed changes, not effects/i);
  });
});
