/**
 * The generic policy model.
 *
 * This is the vocabulary the evaluator reasons in. It is deliberately not
 * DPDP-shaped, GDPR-shaped or CCPA-shaped: every type here names a concept that
 * exists in more than one regime, and no field is a regime's own term. Where a
 * regime term has to survive - because collapsing it would assert an equivalence
 * no source states - it is carried verbatim alongside the canonical value, in
 * exactly the way `docs/regulations/schemas/vocabulary.json` already does.
 *
 * The types the phase brief asked for map onto this file as follows. Three of
 * them are thinner than the name suggests, and saying so here is cheaper than
 * letting a caller discover it:
 *
 * | Brief             | Here                          | Honest state |
 * | ----------------- | ----------------------------- | ------------ |
 * | Jurisdiction      | `Jurisdiction`                | Region-level only. No Member State, no US state beyond California. |
 * | Regulation        | `Regime`                      | The seven the matrix carries. |
 * | RegulationVersion | `Rule.policyVersion`          | A per-requirement string; there is no version *object* because the research records versions per requirement, not per regime. |
 * | Rule              | `Rule`                        | One compiled requirement. |
 * | ApplicabilityTrigger | `Rule.triggers`            | **Free text, not matchable.** See the note below. |
 * | Purpose           | `Purpose`                     | Free text; 7 distinct values in the matrix. |
 * | DataCategory      | `CanonicalDataCategory`       | Controlled. |
 * | ProcessingContext | `ProcessingContext`           | The evaluator's input. |
 * | Vendor            | `Vendor`                      | Role + border crossing. Not an entity registry. |
 * | LegalBasis        | `LegalBasis`                  | Controlled. |
 * | ConsentRequirement| `ConsentRequirement`          | Tri-state, never a boolean. |
 * | UserRight         | `Obligation` of kind `REQUIRE_USER_ACTION` | The matrix records rights as requirements, not as a right registry. |
 * | EnforcementAction | `Rule` with topic `enforcement`| Informational; never gates an activity. |
 * | PolicyVersion     | `Rule.policyVersion`          | As RegulationVersion. |
 *
 * ## Why `ApplicabilityTrigger` is not a matchable predicate
 *
 * The brief models triggers as something the engine tests. The matrix cannot
 * support that. `applicability.triggers` holds 102 distinct values across 102
 * records, and they are not drawn from a controlled vocabulary: alongside
 * snake_case tokens like `terminal_equipment_access` sit prose fragments like
 * `"Where LGPD applies"`, `"Notified SDFs"` and `"Qualifying incident"`.
 *
 * Matching on those strings would produce a number that looks like a legal
 * conclusion and is really a string comparison against unnormalised prose. So
 * triggers are carried onto every citation and never evaluated. Selection uses
 * only the fields the vocabulary actually governs - region, actor, topic, data
 * category, legal basis and the effective dates - and a caller who needs a
 * trigger tested says so explicitly through {@link ProcessingContext.assertedConditions}.
 *
 * Research artifact, not legal advice. See docs/regulations/README.md.
 */

import type {
  AuthorityLevel,
  CanonicalDataCategory,
  LegalBasis,
  Regime,
  Region,
  RequirementType,
  Topic,
} from "../docs/regulations/generated/vocabulary";

export type {
  AuthorityLevel,
  CanonicalDataCategory,
  LegalBasis,
  Regime,
  Region,
  RequirementType,
  Topic,
};

/**
 * The roles a company running its own website holds.
 *
 * Offered as a named constant because getting it wrong is silent: a site that
 * asks only as `determines_purpose` is told nothing about cookies, since every
 * terminal-equipment requirement binds the operator of the service rather than
 * the party deciding the purposes. Both are true of the same company.
 */
export const WEBSITE_OPERATOR_ROLES: readonly ActorRole[] = [
  "determines_purpose",
  "service_operator",
];

/**
 * A place whose law may apply.
 *
 * Region-level, because that is the grain the matrix carries. There is no
 * Member State here: every ePrivacy record is Directive-level, and
 * `REQ-EP-020` records the obligation to track national transposition
 * separately precisely because the research does not.
 */
export type Jurisdiction = Region;

/** A purpose, as the regime states it. Free text; not a controlled vocabulary. */
export type Purpose = string;

/** The role the acting party plays. Controlled by the vocabulary. */
export type ActorRole =
  | "determines_purpose"
  | "acts_on_instruction"
  | "third_party"
  | "service_operator"
  | "intermediary";

/**
 * Whether consent is required.
 *
 * Tri-state on purpose, mirroring the matrix. `"conditional"` is a real answer -
 * the requirement turns on facts the matrix does not hold - and flattening it to
 * a boolean would assert something no source says.
 */
export interface ConsentRequirement {
  required: boolean | "conditional";
  conditions?: readonly string[];
  withdrawalRequired?: boolean;
}

/** An opt-out the regime makes available. */
export interface OptOutRequirement {
  available: boolean;
  conditions?: readonly string[];
  signals?: readonly string[];
}

/** A children's-data condition. */
export interface ChildrenRequirement {
  applies: boolean;
  conditions?: readonly string[];
}

/**
 * One compiled requirement.
 *
 * A projection of a matrix record into the fields the evaluator can act on,
 * plus every field it needs to cite itself. Nothing is inferred during
 * compilation: a field absent from the record is absent here, and the evaluator
 * treats absence as "not recorded" rather than "not required".
 */
export interface Rule {
  readonly id: string;
  readonly regime: Regime;
  readonly regions: readonly Region[];
  /** Canonical topic. Absent on a record the build could not classify. */
  readonly topic: Topic | undefined;
  /** The regime's own term for the topic, preserved. */
  readonly regimeTopic: string;
  readonly requirementType: RequirementType | undefined;
  readonly authorityLevel: AuthorityLevel | undefined;
  readonly text: string;

  /** False where the record states an absence - see `REQ-EP-023`. */
  readonly applies: boolean;
  /** Free text. Carried for citation, never matched. */
  readonly triggers: readonly string[];
  readonly actors: readonly ActorRole[];

  readonly purposes: readonly Purpose[];
  readonly dataCategories: readonly CanonicalDataCategory[];
  readonly contexts: readonly string[];
  readonly legalBases: readonly LegalBasis[];

  readonly consent: ConsentRequirement | undefined;
  readonly optOut: OptOutRequirement | undefined;
  readonly children: ChildrenRequirement | undefined;

  readonly exceptions: readonly string[];
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly policyVersion: string | null;
  readonly sourceIds: readonly string[];
  readonly notes: string | undefined;
}

/** A vendor the activity involves. Not an entity registry - a shape. */
export interface Vendor {
  /** Caller's own identifier, echoed into citations. Never matched. */
  readonly id?: string;
  readonly role: ActorRole;
  /** True where the vendor receives data outside the acting jurisdiction. */
  readonly crossesBorder?: boolean;
}

/**
 * The question put to the evaluator.
 *
 * `asOf` is required rather than defaulted. A default would read the clock, and
 * an evaluator that reads the clock is not deterministic - the same input would
 * stop producing the same decision the moment a requirement's `effective_from`
 * passed. Callers pass the instant they mean.
 */
export interface ProcessingContext {
  /** Which regimes' laws to consider. Empty is an error, not "all". */
  readonly jurisdictions: readonly Jurisdiction[];
  /**
   * Every role the caller plays. Requirements binding none of them are excluded.
   *
   * Plural because one legal person routinely holds several at once, and
   * treating the roles as exclusive silently loses requirements. A company
   * running its own website is the ordinary case: it decides the purposes of the
   * processing *and* operates the service, so it is both `determines_purpose`
   * and `service_operator`. Asking only as the first returns no terminal-equipment
   * requirements at all - those bind the operator - while the jurisdiction
   * resolver is still, correctly, reporting that ePrivacy is in scope. The
   * engine would be disagreeing with itself.
   *
   * An empty list matches only rules that bind no role in particular.
   */
  readonly actors: readonly ActorRole[];
  readonly asOf: Date;

  readonly purpose?: Purpose;
  readonly dataCategories?: readonly CanonicalDataCategory[];
  /** Narrows against a record's `contexts`. Free text; matched literally. */
  readonly processingContexts?: readonly string[];
  readonly vendors?: readonly Vendor[];

  /** The legal basis the caller intends to rely on, where it has one. */
  readonly claimedLegalBasis?: LegalBasis;

  /** Whether the data subject is a child, where the caller knows. */
  readonly subjectIsChild?: boolean;
  /** Whether data leaves the jurisdiction. */
  readonly involvesInternationalTransfer?: boolean;

  /**
   * Conditions the caller asserts are satisfied.
   *
   * This is the only way a conditional requirement resolves. The matrix records
   * conditions as strings it cannot evaluate (`strictly_necessary`,
   * `sole_purpose_communication_transmission`), so the engine will not decide
   * whether one holds - it asks. An assertion made here is recorded on the
   * decision as an assertion, so a reader can always see that the outcome rests
   * on the caller's claim rather than on the matrix.
   */
  readonly assertedConditions?: readonly string[];

  /**
   * Include requirements whose `authority_level` is `derived`.
   *
   * Off by default. `US-State-Model` is a model assembled during research, not
   * a published instrument; returning it beside a statute without being asked
   * would present research as law.
   */
  readonly includeDerivedModels?: boolean;
}

/** The verdicts, exactly as the phase brief names them. */
export type Verdict =
  | "BLOCK"
  | "REVIEW"
  | "REQUIRE_CONSENT"
  | "REQUIRE_OPT_OUT"
  | "REQUIRE_USER_ACTION"
  | "REQUIRE_NOTICE"
  | "ALLOW";

/**
 * Conservative ordering, most restrictive first.
 *
 * `REVIEW` sits directly below `BLOCK` and above every obligation. That is the
 * load-bearing choice in this file: satisfying a known obligation does not
 * resolve an unknown one, so an unresolved requirement must not be masked by a
 * `REQUIRE_NOTICE` that happens to be more specific. `ALLOW` is last, and is
 * reachable only on positive grounds - never by absence of evidence.
 */
export const VERDICT_SEVERITY: readonly Verdict[] = [
  "BLOCK",
  "REVIEW",
  "REQUIRE_CONSENT",
  "REQUIRE_OPT_OUT",
  "REQUIRE_USER_ACTION",
  "REQUIRE_NOTICE",
  "ALLOW",
];

/** Where a citation's requirement came from, and what it says. */
export interface Citation {
  readonly ruleId: string;
  readonly regime: Regime;
  readonly topic: Topic | undefined;
  /**
   * False where the record states an *absence* - "this regime creates no such
   * right" - rather than a requirement.
   *
   * Carried on the citation because a consumer reading `considered` cannot
   * otherwise tell the two apart, and they mean opposite things. A rights
   * screen that treated `REQ-BR-LGPD-016` ("LGPD does not create a CCPA-style
   * sale opt-out") as indicating a sale opt-out would offer a Brazilian visitor
   * a control that regime does not confer.
   */
  readonly applies: boolean;
  readonly authorityLevel: AuthorityLevel | undefined;
  readonly text: string;
  readonly triggers: readonly string[];
  readonly sourceIds: readonly string[];
  readonly policyVersion: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

/** One thing the caller must do, and the rule that says so. */
export interface Obligation {
  readonly verdict: Exclude<Verdict, "ALLOW" | "REVIEW">;
  readonly citation: Citation;
  /** Conditions the rule attaches that the engine did not evaluate. */
  readonly unevaluatedConditions: readonly string[];
}

/** Why something could not be decided. */
export interface OpenQuestion {
  readonly reason:
    | "no_jurisdiction_given"
    | "no_requirements_for_context"
    | "conditional_consent"
    | "conditional_exemption"
    | "children"
    | "unevaluated_conditions"
    | "unclassified_topic"
    | "derived_authority"
    | "states_an_absence";
  readonly detail: string;
  readonly citation?: Citation;
}

/** A statement that some rule positively permits the activity. */
export interface Permission {
  readonly citation: Citation;
  /** The asserted conditions that made this exemption available. */
  readonly satisfiedByAssertion: readonly string[];
}

/** The evaluator's answer. */
export interface PolicyDecision {
  readonly outcome: Verdict;
  readonly obligations: readonly Obligation[];
  readonly permissions: readonly Permission[];
  readonly openQuestions: readonly OpenQuestion[];
  /** Every rule the evaluator selected, whether or not it changed the outcome. */
  readonly considered: readonly Citation[];
  /** Regimes that contributed at least one selected rule. */
  readonly regimes: readonly Regime[];
  /** Conditions the caller asserted, echoed so the decision stands alone. */
  readonly assertedConditions: readonly string[];
  /** Provenance of the data the decision was made from. */
  readonly matrix: {
    readonly schemaVersion: string;
    readonly vocabularyVersion: string | undefined;
    readonly researchStatus: string;
  };
  /** Always false. The decision is a product artifact, not legal advice. */
  readonly legalAdvice: false;
}
