/**
 * Compiling the Phase 6B matrix into rules, and selecting the ones a context
 * reaches.
 *
 * The matrix is the single source of truth and stays that way: this module
 * reads `docs/regulations/generated/requirements.ts` - the artifact
 * `tools/build.mjs` emits for exactly this purpose - and copies no legal content
 * into the engine. If a requirement is wrong, it is fixed in
 * `matrix/requirements.json` and rebuilt; there is nowhere else it could be
 * fixed, which is the property worth protecting.
 *
 * Compilation infers nothing. A field the record does not carry is `undefined`
 * here, and the evaluator is required to treat that as "not recorded" rather
 * than "not required" - the distinction `matrix/coverage.md` insists on.
 *
 * Research artifact, not legal advice.
 */

import {
  REQUIREMENT_MATRIX,
  type Requirement,
} from "../docs/regulations/generated/requirements";
import type {
  ActorRole,
  CanonicalDataCategory,
  Jurisdiction,
  LegalBasis,
  ProcessingContext,
  Regime,
  Rule,
  Topic,
} from "./model";

const ACTOR_ROLES: ReadonlySet<string> = new Set<ActorRole>([
  "determines_purpose",
  "acts_on_instruction",
  "third_party",
  "service_operator",
  "intermediary",
]);

function compile(r: Requirement): Rule {
  const actors = (r.applicability.covered_actors_canonical ?? []).filter(
    (a): a is ActorRole => ACTOR_ROLES.has(a),
  );

  return {
    id: r.requirement_id,
    regime: r.regime,
    regions: r.regions,
    topic: r.topic_canonical,
    regimeTopic: r.topic,
    requirementType: r.requirement_type,
    authorityLevel: r.authority_level,
    text: r.requirement,

    applies: r.applicability.applies,
    triggers: r.applicability.triggers ?? [],
    actors,

    purposes: r.purposes ?? [],
    dataCategories: r.data_categories_canonical ?? [],
    contexts: r.contexts ?? [],
    legalBases: r.legal_bases_canonical ?? [],

    consent: r.consent
      ? {
          required: r.consent.required,
          conditions: r.consent.conditions ?? [],
          withdrawalRequired: r.consent.withdrawal_required,
        }
      : undefined,
    optOut: isOptOut(r.opt_out)
      ? {
          available: r.opt_out.available,
          conditions: r.opt_out.conditions ?? [],
          signals: r.opt_out.signals ?? [],
        }
      : undefined,
    children: isChildren(r.children)
      ? { applies: r.children.applies, conditions: r.children.conditions ?? [] }
      : undefined,

    exceptions: r.exceptions ?? [],
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    policyVersion: r.policy_version,
    sourceIds: r.source_ids ?? [],
    notes: r.notes,
  };
}

/**
 * `opt_out` and `children` are `Record<string, unknown>` in the generated
 * types, because the schema does not pin their shape. Narrowing them here -
 * rather than casting - means a matrix record that grows a differently shaped
 * `opt_out` is ignored instead of crashing the evaluator or, worse, being read
 * as an opt-out that is not there.
 */
function isOptOut(
  v: Record<string, unknown> | undefined,
): v is { available: boolean; conditions?: string[]; signals?: string[] } {
  return !!v && typeof v.available === "boolean";
}

function isChildren(
  v: Record<string, unknown> | undefined,
): v is { applies: boolean; conditions?: string[] } {
  return !!v && typeof v.applies === "boolean";
}

/**
 * Freeze a rule and everything reachable from it.
 *
 * `Rule`'s fields are `readonly`, which stops a *TypeScript* caller writing to
 * them and stops nobody at runtime. The rule set is compiled once and shared by
 * every evaluation in the process, and citations hand out references straight
 * into it - so a single consumer doing `rule.applies = false`, or pushing onto
 * a citation's `triggers`, would silently change the answer every later caller
 * gets. Freezing makes that attempt a no-op in sloppy mode and a `TypeError`
 * under strict mode, instead of a corruption nobody notices.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Every requirement in the matrix, compiled once and shared. */
export const RULES: readonly Rule[] = deepFreeze(
  REQUIREMENT_MATRIX.requirements.map(compile),
);

export const MATRIX_PROVENANCE = Object.freeze({
  schemaVersion: REQUIREMENT_MATRIX.schema_version,
  vocabularyVersion: REQUIREMENT_MATRIX.vocabulary_version as string | undefined,
  researchStatus: REQUIREMENT_MATRIX.research_status,
});

/** Why a rule was excluded. Returned so selection can be explained, not guessed at. */
export type ExclusionReason =
  | "region"
  | "actor"
  | "not_yet_effective"
  | "no_longer_effective"
  | "derived_authority"
  | "purpose"
  | "data_category"
  | "processing_context";

export interface Selection {
  readonly selected: readonly Rule[];
  readonly excluded: ReadonlyMap<string, ExclusionReason>;
}

function inForce(rule: Rule, asOf: Date): ExclusionReason | undefined {
  const t = asOf.getTime();
  if (rule.effectiveFrom !== null) {
    const from = Date.parse(rule.effectiveFrom);
    // An unparseable date is not evidence the rule is out of force. Keeping the
    // rule and letting it be cited is the conservative reading; dropping it
    // would silently narrow the answer.
    if (!Number.isNaN(from) && t < from) return "not_yet_effective";
  }
  if (rule.effectiveTo !== null) {
    const to = Date.parse(rule.effectiveTo);
    if (!Number.isNaN(to) && t > to) return "no_longer_effective";
  }
  return undefined;
}

/**
 * Which rules a context reaches.
 *
 * Every filter here is *narrowing on recorded evidence*: a rule is dropped only
 * when the record positively says it does not reach this context. The asymmetry
 * matters and runs one way throughout - a rule that records no purposes is not
 * excluded by a context that names one, because "this record does not enumerate
 * purposes" and "this record excludes your purpose" are different statements and
 * only the second justifies dropping it.
 */
export function selectRules(
  context: ProcessingContext,
  rules: readonly Rule[] = RULES,
): Selection {
  const excluded = new Map<string, ExclusionReason>();
  const regions = new Set<Jurisdiction>(context.jurisdictions);
  const selected: Rule[] = [];

  for (const rule of rules) {
    if (!rule.regions.some((r) => regions.has(r))) {
      excluded.set(rule.id, "region");
      continue;
    }

    // A record that binds no canonical actor binds everyone; one that names
    // actors binds only those. The caller matches if it holds *any* of them,
    // because the roles are not exclusive and a party wearing two hats is
    // bound by the requirements attaching to both.
    if (
      rule.actors.length > 0 &&
      !rule.actors.some((a) => context.actors.includes(a))
    ) {
      excluded.set(rule.id, "actor");
      continue;
    }

    if (rule.authorityLevel === "derived" && !context.includeDerivedModels) {
      excluded.set(rule.id, "derived_authority");
      continue;
    }

    const dated = inForce(rule, context.asOf);
    if (dated) {
      excluded.set(rule.id, dated);
      continue;
    }

    if (
      context.purpose !== undefined &&
      rule.purposes.length > 0 &&
      !rule.purposes.includes(context.purpose)
    ) {
      excluded.set(rule.id, "purpose");
      continue;
    }

    if (
      context.dataCategories !== undefined &&
      context.dataCategories.length > 0 &&
      rule.dataCategories.length > 0 &&
      !rule.dataCategories.some((c) =>
        (context.dataCategories as readonly CanonicalDataCategory[]).includes(c),
      )
    ) {
      excluded.set(rule.id, "data_category");
      continue;
    }

    if (
      context.processingContexts !== undefined &&
      context.processingContexts.length > 0 &&
      rule.contexts.length > 0 &&
      !rule.contexts.some((c) =>
        (context.processingContexts as readonly string[]).includes(c),
      )
    ) {
      excluded.set(rule.id, "processing_context");
      continue;
    }

    selected.push(rule);
  }

  // Deterministic order, independent of the matrix's own ordering, so a
  // rebuild that reorders records cannot reorder a decision.
  selected.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { selected, excluded };
}

/** Regimes present in the matrix, for callers that need to enumerate them. */
export const REGIMES: readonly Regime[] = Object.freeze(
  [...new Set(RULES.map((r) => r.regime))].sort(),
);

/** Canonical topics actually carried by at least one rule. */
export const POPULATED_TOPICS: readonly Topic[] = Object.freeze(
  [...new Set(RULES.map((r) => r.topic).filter((t): t is Topic => !!t))].sort(),
);

/** Legal bases named by at least one rule. */
export const POPULATED_LEGAL_BASES: readonly LegalBasis[] = Object.freeze(
  [...new Set(RULES.flatMap((r) => r.legalBases))].sort(),
);
