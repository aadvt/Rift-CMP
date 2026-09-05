# Consent experiments

**Experiments optimise consent UX. They do not redefine consent requirements.**

That sentence is the whole design, and it is enforced by the shape of the data
rather than by a rule applied on top of it.

## What a variant can change

Six strings:

```
title · body · accept_all · reject_all · manage · save
```

That is the entire surface. `ExperimentVariant.text` has no field for a purpose,
a rule, a jurisdiction, an action or a policy version, so a variant cannot
express one. The alternative — letting a variant carry a configuration override
and checking it for safety on the way in — was rejected, because it puts the
guarantee in a validator, and validators get extended by somebody who needs one
more field.

The path is always:

```
experiment → copy variation → deterministic policy evaluation → enforcement
```

and never

```
experiment → custom policy → bypass
```

### The guardrails on top

A second line, for copy that is technically within the schema and still unsafe:

* `reject_all` and `manage` cannot be blanked. An experiment may reword refusal;
  it may not remove it.
* Any key outside the six is **rejected**, not stripped. A silently dropped
  override leaves an operator believing their experiment varies something it does
  not, and reading a null result as evidence.
* A named `policy_version_id` must be the one this site actually approved.
* Copy is capped at 400 characters per field.

This is not a content classifier and does not pretend to be one — it cannot tell
whether "Continue" is an honest reject label. It catches the mechanical failures;
a reviewer approves the wording.

## Lifecycle

```
DRAFT ──→ SCHEDULED ──→ RUNNING ──→ PAUSED ──→ COMPLETED ──→ ARCHIVED
  │           │            │           │            ↑           ↑
  └───────────┴────────────┴───────────┴────────────┘           │
                                       └──────────────────────────┘
```

* `COMPLETED` cannot return to `RUNNING`. Appending new data to a result somebody
  may already have acted on pools two periods with whatever changed in between,
  and nothing in the numbers shows it happened. Run a new experiment.
* `ARCHIVED` is terminal.
* Editing is allowed only in `DRAFT` and `SCHEDULED`. Changing an allocation
  mid-run moves visitors between arms — a browser bucketed at 55 shifts when
  50/50 becomes 70/30 — so a decision taken under one banner would be counted
  against an arm that person was never shown. There is no correct merge.
* **One serving experiment per site.** Two experiments varying the same banner
  interact, and the two results cannot be separated afterwards from anything that
  was kept.

An experiment can be `RUNNING` and not serving — scheduled ahead, or past its end
date. The dashboard shows status and *assigning* separately for that reason.

## Allocation

Whole percentages, summing to exactly 100, with exactly one control.

Fractional allocations are refused: the bucket arithmetic would depend on
floating point, and two runtimes could then disagree about a visitor's arm.
Allocations that sum to 99 or 101 mean somebody is unassigned or double-assigned,
and every rate is then over a denominator nobody can state.

50/50, 70/30, 90/10 and 50/25/25 are all fine. An arm at 0% is valid and is never
assigned.

## Assignment

Computed **in the browser**, deterministically:

```
variant = bucket( FNV1a( experimentId + ":" + browserKey ) % 100 )
```

`browserKey` is a random 128-bit value generated on first need and held in that
browser's `localStorage`. It is **never transmitted**. What reaches the server is
the *arm* — `"control"` or `"b"` — attached to a consent decision that was going
to be recorded anyway.

### Why there is no assignments table

A server-side assignment record would be a per-visitor account of what somebody
was shown: a new category of personal data created so a dashboard could compare
two headlines. The server learns which arm a decision belongs to, and never which
browser is in which arm.

**The trade-off, stated plainly:** somebody editing their own storage can choose
their own arm. That is accepted. The threat model for a copy experiment is an
operator drawing a wrong conclusion, not a visitor gaming a banner they are
already free to ignore, and the volume needed to move a rate is far beyond what
hand-editing achieves.

Server-side assignment was also impractical: the consent config endpoint is
public, cacheable and identical for every visitor, and per-visitor assignment
would destroy that.

### Why not the principal id

`consent.getPrincipalId()` is the obvious shortcut and is deliberately not used.

It is null until a decision is recorded, so it cannot assign the banner that asks
for that decision — the exact moment an experiment is about. And it is the
identifier the consent log is keyed on: deriving a behavioural bucket from it
would tie "what this person was shown" to "what this person decided" through a
value the server holds.

### Stickiness

The same browser gets the same arm on every page and every reload, for as long as
the allocation is unchanged. Variants are sorted by key before bucketing, so the
order rows arrive from the database cannot reassign everybody.

Clearing site data mints a new key and reassigns that browser. This is correct: a
browser that has forgotten everything is a new browser. A visitor using two
browsers may see both arms.

Assignment returns **null** — meaning "show the site's ordinary banner" — when
there is no experiment, no storage, allocations that do not sum to 100, or an arm
that has vanished from the config. That is the only safe reading of a broken
experiment, and it leaves no attribution behind to be miscounted later.

## Attribution

A consent decision carries `experiment_id` and `variant_key`, both nullable.

The browser's claim is **checked, not trusted**: the pair is validated against the
experiment actually serving on that site and dropped otherwise. The public key is
in every page's source, so recording it unchecked would make experiment analytics
a surface any script could write fiction into.

Impressions live in `experiment_events` and carry no principal. They exist because
a banner shown and ignored leaves no consent record — without them, an acceptance
rate is a percentage of the people who already chose something, which is
systematically flattering: the visitors a confusing variant produces more of are
exactly the ones who close it without answering.

## Analytics

Rates count **people**, not decisions, exactly as `consent-analytics.ts` does.
"Partial" is a property of a person's whole set of decisions — granted one
purpose, refused another — which is why it cannot be a `GROUP BY`.

Every rate is `null` rather than `0` when nobody has decided. "Nobody accepted"
and "nobody has been asked" are different findings.

### Statistics

A **two-proportion z-test** at 95% confidence, where the sample supports one.

The result carries its method, its sample size, its z-score, its p-value and a
confidence interval on the difference. Where the test's preconditions fail — fewer
than 30 decisions in either arm, or both arms at an identical rate — it **declines
and says why** rather than producing a number that looks the same and means less.

There is **no winner field**. A significance result names a method and stops
there; deciding what to ship is a judgement about the site, not an output of a
z-test. Nothing in the response or the UI says "variant B wins".

### Acceptance is not the score

The comparison puts acceptance beside completion rate and site posture on
purpose. An arm can lift acceptance by asking less clearly, and an arm that lifts
acceptance while leaving more trackers unaccounted for has made the site worse by
the only measure this product holds.

**The Consent Quality Score does not take acceptance as an input**, and this
surface does not smuggle it back in.

## Policy-version analytics

`GET /api/v1/sites/{siteId}/policy-analytics` compares consent behaviour across
approved configurations.

Every difference is labelled an **observed change**. Never "the policy caused". A
version ships alongside everything else that happened that week — a campaign, a
season, a redesign — and nothing in this data separates them. An experiment can
support a causal claim because it randomises; a before-and-after cannot.

Decisions are matched to the configuration snapshot on the record rather than to
when they happened: a decision taken a minute after approval was still served the
old banner.

## Relationship with the rest of the platform

### Policy evaluation

Unaffected. The engine never sees an experiment. Both arms are evaluated against
the same approved configuration, because there is only one.

### Enforcement

Unaffected. `FirewallSubject` has no field for an experiment, so an arm cannot
influence a decision. `BLOCK` stays `BLOCK`, `REQUIRE_CONSENT` stays
`REQUIRE_CONSENT`, `REDACT` stays `REDACT`. Both arms receive identical
enforcement rules, because enforcement is served once for the site, outside the
experiment block.

### Drift detection

Unaffected, and **not suppressed**. Drift compares scans against the approved
configuration; copy does not appear in a scan. There is no whitelist and no
suppression mechanism, because there is nothing for an experiment to suppress.

This is stronger than "the drift engine understands experiments". A design where
an experiment *could* suppress a finding, with a rule to stop it, would be one
rule away from suppressing one.

### Shadow tracker detection

Unaffected, for the same reason. A variant cannot introduce a tracker: it can
change six strings. If a tracker appears during an experiment it is reported,
because it did not come from the experiment.

Verified directly: the intelligence response is compared byte for byte before and
after an experiment starts, and the response contains no experiment field at all.

### Cryptographic proof

The proof scheme moved from `rift-consent-proof/1` to `/2`, adding
`experimentId` and `variantKey` to the canonical document.

**Historical proofs remain verifiable.** `proof_version` is stored on every
record, and a `/1` document is rebuilt and checked under the `/1` canonical form —
appending fields to an old document would change bytes that were already signed,
and every March proof would fail in a way indistinguishable from tampering.

Only two identifiers are bound. The variant's copy is not: it is large, already
versioned on the experiment record, and would make every proof carry a paragraph
of marketing text.

Moving a decision from the losing arm to the winning one is the obvious way to
fake a result. It is bound, so it is caught.

## Retention

`experiment_events` carries no principal, no session and no address. A row says an
arm was shown, never who saw it, so it is not personal data and creates no new
deletion obligation — counting how many people saw a banner does not require
knowing which people.

Rows are removed with the experiment and with the site (`ON DELETE CASCADE`).
There is no independent expiry. Volume is bounded by page views on sites with a
running experiment rather than by all traffic.

The browser key is `localStorage` on the visitor's own device, never transmitted,
and cleared with their site data.

## API

| Method | Path | Plane |
| --- | --- | --- |
| `GET` | `/api/v1/experiments` | management — list, `site_id` and `status` filters |
| `POST` | `/api/v1/experiments` | management — create, always `DRAFT` |
| `GET` | `/api/v1/experiments/{id}` | management |
| `PATCH` | `/api/v1/experiments/{id}` | management — `DRAFT`/`SCHEDULED` only |
| `POST` | `/api/v1/experiments/{id}/status` | management — start, pause, complete, archive |
| `GET` | `/api/v1/experiments/{id}/analytics` | management — variant comparison |
| `GET` | `/api/v1/sites/{siteId}/policy-analytics` | management — version comparison |
| `POST` | `/api/v1/experiments/events` | ingest — the SDK reports an impression |

Every management endpoint is organisation-scoped. An experiment in another tenant
returns 404 — the same answer as one that does not exist, so ids cannot be
enumerated by watching the status code.

## Known limitations

* **A visitor can choose their own arm** by editing their own browser storage.
* **A visitor using two browsers may see both arms**, and counts as two.
* **Impressions are browser-reported** and therefore claims, bounded by the
  site-scoped key, the origin check and the rate limit.
* **Shadow tracker and drift counts are site-wide.** They are shown beside an
  experiment for context and are explicitly marked
  `attributable_to_variant: false`.
* **One experiment per site at a time.**
* **No sequential testing correction.** Repeatedly checking a running experiment
  and stopping when it looks significant inflates the false-positive rate; the
  p-value shown does not account for that, and this is not currently corrected.
