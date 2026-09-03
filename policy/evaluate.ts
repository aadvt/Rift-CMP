/**
 * The evaluator.
 *
 * One pure function. Given a processing context it selects the rules that reach
 * it, turns each into an obligation, a permission or an open question, and
 * resolves the set conservatively.
 *
 * Three properties hold, and each is tested:
 *
 * 1. **Deterministic.** No clock, no randomness, no I/O, no mutable state
 *    between calls. `asOf` is an input for exactly this reason.
 * 2. **Absence never permits.** No rule matched, a rule the engine cannot
 *    classify, a condition it cannot evaluate - each yields `REVIEW`. `ALLOW`
 *    requires a rule that positively says so.
 * 3. **Nothing is resolved silently.** Every condition the engine did not
 *    evaluate is on the decision, attached to the rule that imposed it.
 *
 * Research artifact, not legal advice.
 */

import { TOPIC_DISPOSITION } from "./disposition";
import { MATRIX_PROVENANCE, RULES, selectRules } from "./rules";
import {
  VERDICT_SEVERITY,
  type Citation,
  type Obligation,
  type OpenQuestion,
  type Permission,
  type PolicyDecision,
  type ProcessingContext,
  type Regime,
  type Rule,
  type Verdict,
} from "./model";

function cite(rule: Rule): Citation {
  return {
    ruleId: rule.id,
    regime: rule.regime,
    topic: rule.topic,
    authorityLevel: rule.authorityLevel,
    text: rule.text,
    triggers: rule.triggers,
    sourceIds: rule.sourceIds,
    policyVersion: rule.policyVersion,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  };
}

/** Most restrictive of two verdicts, by {@link VERDICT_SEVERITY}. */
function moreRestrictive(a: Verdict, b: Verdict): Verdict {
  return VERDICT_SEVERITY.indexOf(a) <= VERDICT_SEVERITY.indexOf(b) ? a : b;
}

interface Working {
  obligations: Obligation[];
  permissions: Permission[];
  openQuestions: OpenQuestion[];
  /** Rules that record an absence rather than a requirement. */
  absences: Citation[];
}

/**
 * Conditions the caller has asserted, as a set.
 *
 * Assertion is the only mechanism that resolves a condition. The engine never
 * decides that `strictly_necessary` is true - it is not in a position to know -
 * so a caller who needs the exemption says so and wears the claim, which the
 * decision then records against them.
 */
function unmet(
  conditions: readonly string[] | undefined,
  asserted: ReadonlySet<string>,
): string[] {
  return (conditions ?? []).filter((c) => !asserted.has(c));
}

/**
 * Turn one rule into its contribution.
 *
 * The order of the branches is the substance. A rule's *own* recorded fields -
 * `consent`, `opt_out`, `children` - are consulted before the topic table,
 * because a record that positively states "consent is not required here" must
 * beat the topic's default of "this topic requires consent". That is what makes
 * the Article 5(3) exceptions expressible rather than being overridden by the
 * general rule they are exceptions to.
 */
function contribute(
  rule: Rule,
  context: ProcessingContext,
  asserted: ReadonlySet<string>,
  out: Working,
): void {
  const citation = cite(rule);

  // A record that states an absence - "this regime has no standalone children's
  // regime" - is evidence, and is cited, but imposes nothing. It is counted so
  // the decision can say *why* it found nothing, which is a different fact from
  // having found only organisational duties.
  if (!rule.applies) {
    out.absences.push(citation);
    return;
  }

  if (rule.topic === undefined) {
    out.openQuestions.push({
      reason: "unclassified_topic",
      detail: `${rule.id} carries no canonical topic (regime term "${rule.regimeTopic}"), so its effect cannot be determined.`,
      citation,
    });
    return;
  }

  const disposition = TOPIC_DISPOSITION[rule.topic];

  if (rule.authorityLevel === "derived") {
    out.openQuestions.push({
      reason: "derived_authority",
      detail: `${rule.id} rests on a research model rather than a published instrument, and must be confirmed against the governing state law.`,
      citation,
    });
  }

  // ── Children ──────────────────────────────────────────────────────────────
  //
  // Checked before consent, because a children's record is the more specific
  // statement and carries conditions the consent block would otherwise discard.
  // `REQ-CA-CCPA-009` is the case that forced this: it records
  // `consent.required: true` *and* children's conditions distinguishing under-13
  // from 13-to-15. Reading the consent field first produced a bare
  // REQUIRE_CONSENT and silently dropped the age conditions it depends on.
  if (rule.children?.applies) {
    // The engine will not assume adulthood. An unknown age is an open question;
    // only an explicit `subjectIsChild: false` takes the rule out of play.
    if (context.subjectIsChild === false) return;

    const childConditions = unmet(rule.children.conditions, asserted);
    const consentConditions = unmet(rule.consent?.conditions, asserted);

    // Where the record also requires consent, the obligation is real and is
    // raised - but it is raised carrying *both* sets of conditions, so a caller
    // can see the whole of what it turns on.
    if (rule.consent?.required === true) {
      out.obligations.push({
        verdict: "REQUIRE_CONSENT",
        citation,
        unevaluatedConditions: [...consentConditions, ...childConditions],
      });
      if (rule.consent.withdrawalRequired) {
        out.obligations.push({
          verdict: "REQUIRE_USER_ACTION",
          citation,
          unevaluatedConditions: [],
        });
      }
    }

    out.openQuestions.push({
      reason: "children",
      detail:
        `${rule.id} imposes children's-data conditions` +
        (childConditions.length ? ` (${childConditions.join(", ")})` : "") +
        (context.subjectIsChild === undefined
          ? ". The subject's age was not stated, so this cannot be resolved."
          : "."),
      citation,
    });
    return;
  }

  // ── The rule's own consent field ──────────────────────────────────────────
  if (rule.consent) {
    const conditions = unmet(rule.consent.conditions, asserted);

    if (rule.consent.required === true) {
      out.obligations.push({
        verdict: "REQUIRE_CONSENT",
        citation,
        unevaluatedConditions: conditions,
      });
      // The record's own `withdrawal_required` is the primary signal. The topic
      // is the backstop: a withdrawal-topic record that omits the flag still
      // obliges a withdrawal mechanism, and dropping it because one field was
      // not filled in would lose the requirement the record exists to state.
      if (
        rule.consent.withdrawalRequired ||
        disposition.verdict === "REQUIRE_USER_ACTION"
      ) {
        out.obligations.push({
          verdict: "REQUIRE_USER_ACTION",
          citation,
          unevaluatedConditions: [],
        });
      }
      return;
    }

    if (rule.consent.required === "conditional") {
      out.openQuestions.push({
        reason: "conditional_consent",
        detail:
          `${rule.id} records consent as conditional` +
          (conditions.length
            ? ` on ${conditions.join(", ")}, which the matrix does not evaluate.`
            : `, with no conditions enumerated. Whether consent is required cannot be determined from the record.`),
        citation,
      });
      return;
    }

    // `required: false`. On a gate topic this is an exemption - a positive
    // statement that the gate does not bite. Anywhere else it means only that
    // consent is not the mechanism for this obligation, which permits nothing:
    // a security duty recording `consent: false` is not permission to process.
    if (disposition.disposition === "gate") {
      if (conditions.length === 0) {
        out.permissions.push({
          citation,
          satisfiedByAssertion: (rule.consent.conditions ?? []).filter((c) =>
            asserted.has(c),
          ),
        });
      } else {
        out.openQuestions.push({
          reason: "conditional_exemption",
          detail: `${rule.id} exempts this activity from consent only if ${conditions.join(", ")} holds. Assert the condition to rely on it.`,
          citation,
        });
      }
      return;
    }
  }

  // ── The rule's own opt-out field ──────────────────────────────────────────
  if (rule.optOut?.available) {
    const conditions = unmet(rule.optOut.conditions, asserted);
    out.obligations.push({
      verdict: "REQUIRE_OPT_OUT",
      citation,
      unevaluatedConditions: conditions,
    });
    return;
  }

  // ── Otherwise the topic table decides ─────────────────────────────────────
  switch (disposition.disposition) {
    case "gate":
    case "obligation": {
      if (disposition.verdict && disposition.verdict !== "ALLOW" && disposition.verdict !== "REVIEW") {
        out.obligations.push({
          verdict: disposition.verdict,
          citation,
          unevaluatedConditions: [],
        });
      }
      return;
    }
    case "conditional": {
      out.openQuestions.push({
        reason: "unevaluated_conditions",
        detail: `${rule.id} (${rule.topic}) turns on facts the matrix does not hold: ${disposition.rationale}`,
        citation,
      });
      return;
    }
    case "organisational":
    case "scoping":
    case "informational":
      // Cited through `considered`, never acted on.
      return;
  }
}

/**
 * Answer: given this activity and this context, what applies?
 *
 * Pure. Same input, same output, forever.
 */
export function evaluate(
  context: ProcessingContext,
  rules: readonly Rule[] = RULES,
): PolicyDecision {
  const asserted = new Set(context.assertedConditions ?? []);
  const assertedConditions = [...asserted].sort();

  const base = {
    permissions: [] as readonly Permission[],
    considered: [] as readonly Citation[],
    regimes: [] as readonly Regime[],
    assertedConditions,
    matrix: MATRIX_PROVENANCE,
    legalAdvice: false as const,
  };

  // No jurisdiction is not "everywhere". It is a question the caller has not
  // asked properly, and answering it would mean choosing whose law to apply.
  if (context.jurisdictions.length === 0) {
    return {
      ...base,
      outcome: "REVIEW",
      obligations: [],
      openQuestions: [
        {
          reason: "no_jurisdiction_given",
          detail:
            "No jurisdiction was given. The engine will not guess which law applies, and an empty jurisdiction list is not a request to consider all of them.",
        },
      ],
    };
  }

  const { selected } = selectRules(context, rules);

  if (selected.length === 0) {
    return {
      ...base,
      outcome: "REVIEW",
      obligations: [],
      openQuestions: [
        {
          reason: "no_requirements_for_context",
          detail:
            "The matrix carries no requirement reaching this context. Silence in the matrix means the material was not converted, never that nothing is required.",
        },
      ],
    };
  }

  const out: Working = {
    obligations: [],
    permissions: [],
    openQuestions: [],
    absences: [],
  };
  for (const rule of selected) contribute(rule, context, asserted, out);

  const considered = selected.map(cite);
  const regimes = [...new Set(selected.map((r) => r.regime))].sort();

  // ── Conservative resolution ───────────────────────────────────────────────
  //
  // Start at the most permissive and let every contribution pull it back. An
  // open question is `REVIEW`, which outranks every obligation: knowing you owe
  // a notice does not resolve not knowing whether consent is required.
  let outcome: Verdict = "ALLOW";

  for (const o of out.obligations) {
    outcome = moreRestrictive(outcome, o.verdict);
    // A rule that obliges *and* carries conditions nobody evaluated is only
    // half-answered, so it also raises a question.
    if (o.unevaluatedConditions.length > 0) {
      out.openQuestions.push({
        reason: "unevaluated_conditions",
        detail: `${o.citation.ruleId} attaches conditions the engine did not evaluate: ${o.unevaluatedConditions.join(", ")}.`,
        citation: o.citation,
      });
    }
  }

  if (out.openQuestions.length > 0) outcome = moreRestrictive(outcome, "REVIEW");

  // `ALLOW` survives only if a rule positively permitted the activity and
  // nothing else pulled the outcome back. Reaching the end with no obligation,
  // no question and no permission means every selected rule was organisational
  // or informational - which is not a finding that the activity is permitted.
  if (outcome === "ALLOW" && out.permissions.length === 0) {
    outcome = "REVIEW";
    out.openQuestions.push(
      out.absences.length === selected.length
        ? {
            reason: "states_an_absence",
            detail:
              `Every rule reaching this context (${out.absences.map((a) => a.ruleId).join(", ")}) records that the regime has no such requirement. ` +
              "That is an answer about those rules, not a finding that the activity is permitted - another regime may still reach it.",
          }
        : {
            reason: "no_requirements_for_context",
            detail:
              "Every rule reaching this context was organisational, informational, or recorded an absence" +
              (out.absences.length > 0
                ? ` (${out.absences.map((a) => a.ruleId).join(", ")} record absences)`
                : "") +
              ", so nothing addressed whether the activity itself may proceed.",
          },
    );
  }

  return {
    ...base,
    outcome,
    obligations: sortObligations(out.obligations),
    permissions: out.permissions,
    openQuestions: out.openQuestions,
    considered,
    regimes,
  };
}

/** Stable order: most restrictive first, then by rule id. */
function sortObligations(obligations: Obligation[]): Obligation[] {
  return [...obligations].sort((a, b) => {
    const s = VERDICT_SEVERITY.indexOf(a.verdict) - VERDICT_SEVERITY.indexOf(b.verdict);
    if (s !== 0) return s;
    return a.citation.ruleId < b.citation.ruleId
      ? -1
      : a.citation.ruleId > b.citation.ruleId
        ? 1
        : 0;
  });
}
