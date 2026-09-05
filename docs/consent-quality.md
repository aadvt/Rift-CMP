# Consent Quality Score

A number between 0 and 100 describing how well a site is set up to handle
consent, with the reasoning attached.

`GET /api/v1/sites/{siteId}/quality`

## What it is not

It is not a compliance certification and does not claim to be one. No number
can tell an operator whether they comply with a law: compliance turns on facts
about their business the platform does not hold, and on judgement it is not
entitled to make. Every response carries `legal_advice: false` for the same
reason the policy engine's output does.

What it can say is whether the operational scaffolding is in place — whether a
configuration is approved, whether the scan behind it is recent enough to trust,
whether observed technologies are accounted for, whether anything enforces the
decision, whether decisions can be proved later. Those are facts about a
deployment, and they are worth a number.

## Why acceptance rate is not a component

A site that shows no banner and records nothing accepts 100% of the time. A site
with a well-built preference centre and an honest reject button accepts less.
Any score containing acceptance would rank the first above the second, and an
operator optimising for the score would end up with a worse consent experience
than they started with.

Acceptance is reported in analytics, where it describes visitor behaviour. It is
kept out of here, where it would describe nothing useful.

## The components

| Component | Weight | Measures |
| --- | ---: | --- |
| Consent coverage | 15 | Observed technologies covered by an approved configuration |
| Policy completeness | 15 | Purposes the configuration references that are actually declared |
| Tracker resolution | 15 | Technologies with a decision rather than awaiting review |
| Shadow trackers | 15 | Things running that the configuration does not account for |
| Enforcement coverage | 12 | Whether the runtime acts on the decision, and over how many hosts |
| Scanner freshness | 10 | How recently the site was actually looked at |
| Drift risk | 8 | Differences between the site and what was approved |
| Jurisdiction coverage | 5 | Whether markets were declared, so regulations could resolve |
| Proof completeness | 5 | Decisions carrying a receipt |

Weights sum to 100 and are asserted by a test, so a component cannot be added
without deciding what it costs.

## Severity, not count

Shadow trackers and drift are scored by severity, not by how many there are:
`critical` 4, `high` 3, `medium` 2, `low` 1, `info` 0. One vendor running
against an explicit block costs more than four unclassified hosts nobody has got
to yet — which is the right order, because the first is a decision being ignored
and the second is a task.

Past a ceiling (12 severity points for shadow trackers, 10 for drift) the
component is already zero and further findings change nothing. The score has
said what it can; the list is where the detail lives.

## Absent input is set aside, not failed

A site nobody has scanned has no tracker resolution to measure. Scoring that as
zero would report "you have unresolved trackers" when the truth is "nobody has
looked" — a different problem with a different fix.

Those components are marked `applicable: false`, excluded from the denominator,
and named in `not_applicable`. The score is taken over the weight that applied,
which is reported as `weight_considered`, so a high score on a thin deployment
cannot hide behind the components it skipped.

## Observe mode earns partial credit

Enforcement scores `off` at zero, `observe` at half, `enforce` at full. Scoring
`observe` as zero would push operators to switch straight to enforcing, which is
the single change most likely to break a customer's checkout. Observe is the
correct first step and the score says so.

## Bands

`strong` at 85 and above, `fair` at 65, `weak` below. Bands, not verdicts —
they exist so a list of sites can be scanned quickly, not to certify anything.

## Explainability

Every component carries what was measured (`detail`) and what would raise it
(`remedy`, null when already full marks). A score nobody can argue with is a
score nobody can act on, so "78/100" is never the whole answer and never has to
be taken on trust.
