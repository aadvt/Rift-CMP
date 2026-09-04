# The Policy Engine

The Phase 6B research produced 102 structured requirements across seven regimes,
and until now nothing read them. This is what reads them.

It answers one question:

> Given this processing activity and this context, what requirements apply?

*Which* jurisdictions to ask about is a separate question, answered by the
Phase 7B resolver in the same package — see
[jurisdiction-resolution.md](jurisdiction-resolution.md).

It is a **research artifact, not legal advice**, and it is deliberately not wired
into any route. See [Why it is not wired in](#why-it-is-not-wired-in).

## Where it lives

| Path | What it is |
| --- | --- |
| `policy/model.ts` | The generic vocabulary the evaluator reasons in |
| `policy/disposition.ts` | The one table that turns a topic into a verdict |
| `policy/rules.ts` | Matrix → `Rule[]`, and which rules a context reaches |
| `policy/evaluate.ts` | The evaluator: one pure function |
| `policy/index.ts` | The public surface |
| `api/tests/policy-rules.test.ts` | Compilation, selection, invariants (24 tests) |
| `api/tests/policy-engine.test.ts` | Evaluator behaviour (50 tests) |
| `api/tests/policy-boundary.test.ts` | Attempts to falsify the engine's claims (36 tests) |

It adds no table, no migration, no endpoint and no dependency. It reads
`docs/regulations/generated/requirements.ts` — the artifact
`docs/regulations/tools/build.mjs` already emitted "for a future engine to
import" — and holds no legal content of its own. A requirement that is wrong is
fixed in `matrix/requirements.json` and rebuilt; there is nowhere else it could
be fixed, which is the property worth protecting.

## Using it

```ts
import { evaluate, WEBSITE_OPERATOR_ROLES } from "@rift-cmp/policy";

const decision = evaluate({
  jurisdictions: ["EU"],
  // Plural: one company is both the party deciding the purposes and the
  // operator of the service, and the cookie rules bind the second.
  actors: WEBSITE_OPERATOR_ROLES,
  asOf: new Date("2026-09-04"),
  processingContexts: ["cookies"],
});

decision.outcome;        // "REVIEW"
decision.obligations;    // REQUIRE_CONSENT, REQUIRE_NOTICE, … each with its rule
decision.openQuestions;  // everything it refused to decide, and why
decision.considered;     // every rule it selected, cited in full
```

`asOf` is required rather than defaulted. A default would read the clock, and an
evaluator that reads the clock is not deterministic — the same input would stop
producing the same answer the moment some requirement's `effective_from` passed.

## The verdicts

The brief's seven, ordered most restrictive first. The order is the conflict
resolution: when several rules apply, the outcome is the most restrictive of
them, and no obligation is discarded on the way.

| Verdict | Meaning |
| --- | --- |
| `BLOCK` | A prohibition. No matrix record produces one today. |
| `REVIEW` | Something could not be decided. |
| `REQUIRE_CONSENT` | A consent gate applies. |
| `REQUIRE_OPT_OUT` | An opt-out must be offered and honoured. |
| `REQUIRE_USER_ACTION` | A rights, withdrawal or non-discrimination mechanism is owed. |
| `REQUIRE_NOTICE` | A transparency duty attaches. |
| `ALLOW` | A rule positively permits the activity. |

**`REVIEW` sits above every obligation, directly below `BLOCK`.** That is the
load-bearing choice. Satisfying a known obligation does not resolve an unknown
one, so an unresolved requirement must never be masked by a more specific
obligation that happens to be resolvable.

The `outcome` is a conservative summary. The actionable content is
`obligations`, and a caller that reads only `outcome` is using half the answer.

## What makes it generic

The brief said not to hard-code GDPR/DPDP/CCPA logic across the routes, and to
centralise evaluation. Centralising is necessary but not sufficient — one file
full of per-regime branches satisfies the letter and loses the point. So the
constraint the engine holds itself to is stronger:

> **No regime name appears in the disposition table.**

`api/tests/policy-rules.test.ts` reads `policy/disposition.ts` and fails if it
contains any of the seven regime names, or the strings `GDPR`, `DPDP`, `CCPA`,
`CPRA`, `LGPD` or `ePrivacy`. Adding an eighth regime to the matrix therefore
adds rows to the matrix and changes no engine code, because "a notice
requirement obliges you to give notice" is not a fact about the GDPR.

The table keys on the canonical topic and records, for each, whether it is a
`gate`, an `obligation`, an `organisational` duty, `scoping`, `informational` or
`conditional` — with a written rationale on every row.

The distinction that does the most work is **`organisational` versus `gate`**.
Security, retention, accountability and vendor duties are real, are cited, and
never block: an evaluator that answered `BLOCK` because a security obligation
exists would return `BLOCK` for everything and mean nothing by it.

## The four rules it will not break

**1. Absence never permits.** Silence in the matrix means the material was not
converted, never that nothing is required — the distinction
[`matrix/coverage.md`](regulations/matrix/coverage.md) insists on. So no rules
matched is `REVIEW`; a rule whose topic could not be canonicalised is `REVIEW`;
a context with no jurisdiction is `REVIEW` and not "consider everything".

**2. Narrowing happens only on recorded evidence.** A rule is dropped only when
the record positively says it does not reach this context. "This record does not
enumerate purposes" and "this record excludes your purpose" are different
statements, and only the second justifies dropping it. The asymmetry runs one
way through every filter.

**3. Conditions are never silently resolved.** The matrix records conditions as
strings it cannot evaluate — `strictly_necessary`,
`sole_purpose_communication_transmission`, `article_5_3_exceptions`. The engine
does not decide whether one holds. It asks.

**4. `consent: false` is not permission.** On a gate topic it is an exemption. On
a security or accountability record it means only that consent is not that
obligation's mechanism, and reading it as permission to process would be a
serious misreading of the data. The engine distinguishes the two by topic.

### Asserted conditions

The only way a condition resolves:

```ts
evaluate({
  jurisdictions: ["EU"],
  actors: ["service_operator"],
  asOf: new Date("2026-09-04"),
  processingContexts: ["terminal_equipment"],
  assertedConditions: ["strictly_necessary"],
});
```

The caller states that the condition holds and wears the claim. The decision then
carries `assertedConditions`, and each permission records
`satisfiedByAssertion`, so a reader can always see that the outcome rests on the
caller's claim rather than on the matrix.

## What a consumer can rely on

The next phase builds on this, so these are guarantees rather than current
behaviour, and `api/tests/policy-boundary.test.ts` attacks each one rather than
asserting it.

- **`evaluate` is pure.** No clock, no `Math.random`, no `process.env`, no
  filesystem, no network. The engine's source is scanned for all of them.
- **The rule set is deeply frozen.** `RULES` is compiled once and shared by every
  evaluation in the process, and citations hand out references straight into it.
  `readonly` in TypeScript stops a compiler and nobody at runtime, so the whole
  graph is frozen: a consumer writing `rule.applies = false` or pushing onto a
  citation's `triggers` gets a no-op or a `TypeError`, not a corruption that
  changes every later caller's answer. This was found by writing the attack —
  the first implementation froze only the outer array.
- **Every decision is a fresh object.** Two calls with the same context are
  deeply equal and never the same reference.
- **A decision is JSON-serialisable and stable**, so it can be stored, diffed or
  sent over a wire without losing anything.
- **It cannot be made to throw.** Empty jurisdictions, an `Invalid Date`,
  unknown purposes, 500 asserted conditions — each returns a decision, and none
  returns `ALLOW`.
- **The engine restates no requirement.** Every citation's text is verbatim from
  `matrix/requirements.json`; a test compares them, and another fails if matrix
  prose is ever copied into the engine's own source.
- **Nothing imports it.** A test walks `api/app` and `api/lib` and fails if any
  route, page or library module imports `@rift-cmp/policy`. When a later phase
  wires it in, that test fails and the "not wired in" claim has to be rewritten
  rather than quietly becoming false.

## Why `ApplicabilityTrigger` is not a predicate

The brief models triggers as something the engine tests. The matrix cannot
support that, and pretending otherwise would have been the easiest way to make
this phase look more finished than it is.

`applicability.triggers` holds **102 distinct values across 102 records**, drawn
from no controlled vocabulary. Alongside snake_case tokens like
`terminal_equipment_access` sit prose fragments — `"Where LGPD applies"`,
`"Notified SDFs"`, `"Qualifying incident"`, `"Specified controllers/processors"`.
Matching on those strings would produce something that reads like a legal
conclusion and is really a string comparison against unnormalised prose.

So triggers are carried onto every citation and never evaluated. Selection uses
only the fields the vocabulary actually governs — region, actor, topic, data
category, legal basis, and the effective dates, all of which are populated on
102/102 records. A caller who needs a trigger tested asserts it explicitly.

Making triggers matchable is a **matrix** change, not an engine change: it means
adding a controlled trigger vocabulary in Phase 6B's schemas and renormalising
the records against it.

## What the engine found about the matrix

Two findings came out of building this, and both are properties of the research
rather than of the code.

**`ALLOW` is unreachable.** A sweep over every single-jurisdiction context
reachable from the recorded vocabulary — 5 regions × 5 actors × 25 contexts × 8
purposes, with *every* condition in the matrix asserted, derived models included
— produces `REVIEW` and `REQUIRE_CONSENT` and never once `ALLOW`. As converted,
the matrix never describes a situation in which a regime affirmatively permits an
activity with nothing else attached. `api/tests/policy-engine.test.ts` locks this
in: if a later change makes `ALLOW` reachable, that test fails and the change
gets read rather than shipped.

**Every `US-State-Model` record states an absence.** All nine carry
`applicability.applies: false`. Asking about a US state therefore yields no
obligation at all, and the engine has to say so without implying permission — it
returns `REVIEW` with the reason `states_an_absence`, naming the records and
noting that another regime may still reach the activity.

## Two bugs the adversarial tests found

Both were found by `policy-boundary.test.ts` and by auditing branch order
against the real records — not by the tests that check the engine does what it
is supposed to. Both are recorded because each would have surfaced in Phase 7B
as a wrong answer rather than as a crash.

**The rule set was only shallow-frozen.** `RULES` is compiled once and shared by
every evaluation in the process, and citations hand out references straight into
it. `Object.freeze` on the array left every rule object and nested array
writable, so a consumer doing `rule.applies = false` — or pushing onto a
citation's `triggers` — would have silently changed the answer every later caller
got, for the life of the process. The graph is now deep-frozen.

**A children's record lost its conditions.** `contribute` read a rule's `consent`
field before its `children` field. `REQ-CA-CCPA-009` carries both:
`consent.required: true`, and children's conditions distinguishing under-13 from
13-to-15. The consent branch matched first and returned, so the decision said
`REQUIRE_CONSENT` and dropped the age conditions the requirement actually turns
on — and `subjectIsChild: false` did not take the record out of play. Children
is now checked first, as the more specific statement, and the consent obligation
it raises carries both sets of conditions.

A third, smaller one: a withdrawal-topic record that omitted the optional
`withdrawal_required` flag would have lost its withdrawal obligation entirely.
Both such records in the matrix set the flag, so nothing was wrong today; the
topic is now a backstop for the flag.

## How it is wired in (Phase 8B)

It has exactly two consumers - `api/lib/consent-config.ts` and, since Phase 9A,
`api/lib/autopilot.ts`. Both use it to
annotate a **consent proposal a human reads** with the regimes that appear to
apply and the obligations they raise, each carrying its requirement id and
sources.

That is the whole of it, and the limits are enforced rather than promised.
`policy-boundary.test.ts` holds an allowlist of those files, asserts the first
really does import the engine, and separately asserts that **no route handler
does** — so the engine can inform a person and cannot gate a request. Its output
never reaches the browser: the runtime configuration a banner renders carries no
regime, citation or jurisdiction, and a test greps the payload to prove it.

The section below is why that boundary is where it is.

## Why it does not decide anything

The engine can answer questions about consent, and the platform already enforces
a rule about consent — "the decision in force must be `GRANTED`". They are not
the same rule, and this phase does not join them.

The existing gate is a fact about a **recorded decision**. This engine is a
statement about what a **regime requires**. Wiring the second into the first
would mean the platform starts refusing live traffic on the strength of a
research artifact whose own coverage document lists `consent` as populated on 34
of 102 records. That is a product decision with a blast radius, and it belongs to
a phase that is about making it, not to the phase that built the evaluator.

What the engine changes today is that the question is now answerable, centrally,
deterministically, with a citation attached to every part of the answer.

## Limitations

Each is a thing the engine genuinely does not do.

- **Jurisdiction is region-level.** `EU`, `India`, `California`, `US`, `Brazil`.
  There is no Member State: every ePrivacy record is Directive-level, and
  `REQ-EP-020` records the obligation to track national transposition separately
  precisely because the research does not. A Member-State question cannot be
  asked, let alone answered.
- **Triggers are not matchable.** As above.
- **`purposes` and `contexts` are free text.** Seven and 24 distinct values, not
  a controlled vocabulary, matched literally. A caller who writes `"marketing"`
  where the matrix says `"direct_marketing"` silently narrows to nothing.
- **Thinly populated fields stay thin.** `consent` is on 34/102 records,
  `legal_bases` on 22, `purposes` on 10, `opt_out` on 5, `children` on 6. The
  engine treats every absence as "not recorded" and surfaces it, but it cannot
  manufacture what the research did not state.
- **`Vendor` is a shape, not a registry.** It carries a role and whether the
  transfer crosses a border. It does not model a vendor's own obligations,
  contracts or sub-processors, and nothing resolves a vendor to a real entity.
- **No `BLOCK` is reachable.** One matrix record is typed as a prohibition
  (`non_discrimination`), and it is dispositioned as an obligation on the
  response to a user action rather than a bar on processing. The verdict exists
  in the ladder and is tested; no data produces it.
- **No rule engine over the conditions.** Conditions are strings, matched by
  equality against caller assertions. There is no expression language, no
  negation and no composition.
- **It does not evaluate a consent record.** The engine says what a regime
  requires. Whether a given `ConsentRecord` satisfies that requirement — whether
  it is fresh enough, specific enough, or granular enough — is not asked here.
- **Conflicts between regimes are resolved by severity, not by law.** Where two
  regimes disagree, the engine takes the more restrictive and cites both. It does
  not apply any conflict-of-laws rule, and
  [`regulations/conflicts/conflicts.md`](regulations/conflicts/conflicts.md) is
  not read by it.

## Verification

```bash
npm run test:unit    # 541 tests; 162 are the policy package
npm run typecheck
npm run lint
node docs/regulations/tools/validate.mjs
```

The engine's tests are in the `unit` project because they touch no database —
they are pure functions over a static matrix, and all 162 run in about 300ms.
