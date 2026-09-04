# Consent Autopilot

Generating a recommended consent configuration from a scan, the jurisdictions an
operator serves, and the requirement matrix — then letting a person approve it.

Research artifact, not legal advice.

## The claim this phase must not make

The brief is explicit: *this is a recommendation engine, it must not silently
claim legal certainty*. The honest way to honour that is not a disclaimer under
a table. It is making **"we do not know" a first-class value that appears in the
data**, so a screen cannot render confidence the system does not have.

Three mechanisms carry it:

| | |
| --- | --- |
| `consent_requirement` | Four values. `conditional` and `unknown` are two of them, and nothing flattens them to a boolean |
| `recommended_action` | Includes `review`. An input the engine cannot resolve produces `review`, **never `allow`** |
| `rule_references` | On every line, so a recommendation citing nothing is visibly resting on nothing |

Absence never permits — the same rule the policy engine holds itself to, applied
again here rather than reinvented.

## `block` is advice, not behaviour

**Rift blocks nothing.** The runtime renders a banner and records decisions;
whether a tag actually loads is decided by the customer's own integration.

An action named `block` that silently did not block would be the worst kind of
reassurance, so the word means *"we suggest you do not load this until the
purpose is granted"* everywhere it appears — in the type, in the review screen,
and here.

| Action | Means |
| --- | --- |
| `allow` | No consent gate suggested |
| `require_consent` | Load only once the purpose is granted |
| `block` | Suggest not loading it until you decide otherwise |
| `ignore` | Out of scope. Only ever set by a human |
| `review` | The inputs do not support a recommendation |

## Where it lives

| Path | What it is |
| --- | --- |
| `api/lib/autopilot.ts` | The generator. Pure; the second of two files allowed to import the policy engine |
| `database/consent-policy.ts` | Approved versions and overrides |
| `api/app/api/v1/sites/{id}/consent-policy/` | `GET` generates, `POST` approves |
| `.../consent-policy/overrides/` | `GET` / `POST` / `DELETE` |
| `api/app/dashboard/policy/page.tsx` | The six-column review screen |
| `api/tests/autopilot.test.ts` | 43 tests, one describe per named scenario |

One migration, two tables.

## What is stored, and what is not

**Recommendations are not stored.** They are generated on every read from the
latest completed scan, the markets selected and the matrix. There is
deliberately no stored draft: a draft is a second artifact that looks like
configuration, and the first question anyone asks of one is whether it is live —
which is exactly the ambiguity approval exists to remove.

Two things are persisted, with opposite lifecycles:

### `consent_policy_versions` — immutable

What a human approved, at a moment. A database trigger refuses `UPDATE` on an
approved row, permitting only the single transition to `superseded` that
publishing a newer version performs.

The reason is evidentiary rather than tidy: a consent decision recorded while a
version was live cites the configuration the visitor was actually shown.
Rewriting it would destroy the only record of that.

A **partial unique index** allows one `approved` row per site. "Which
configuration is live" is a question the database should only ever have one
answer to; two approved rows would make the runtime's choice arbitrary and the
bug invisible until somebody noticed the wrong banner.

### `consent_recommendation_overrides` — mutable

What a human decided differently. Changing your mind about a vendor is the point
of it existing, so unlike a version it is freely editable. What stays immutable
is the version approved while the old preference was in force.

Keyed on the **detector**, not on a scan row — which is what makes the
disappearing-evidence case work.

## Approval sends recommendations back

`POST` takes the recommendations in its body rather than re-deriving them. The
operator must approve **what they actually reviewed**: re-deriving at approval
time would mean a scan finishing mid-review silently changed what was agreed to.

Approval also does not declare purposes. A banner cannot record a decision
against a purpose the consent domain does not hold, so the screen flags
`undeclared_purposes` and links to Configure. Declaring a purpose stays a
separate, deliberate act — the same argument the Configure screen has always
made.

## What approval changes for a visitor

The preference centre gains a **vendor list per purpose**. Before approval it
shows purposes with no vendors, because the platform has no basis to say which
vendor serves which of an operator's purposes — only the operator does, and
approving is where they say so.

Approval never adds or removes a purpose on its own.

## Scanner evidence disappearing

A vendor in one scan and not the next has usually **not been removed** — the
crawl reached fewer pages, a tag loaded on a page the budget did not get to, or
the site was slow.

So a vendor with an operator override is carried forward, marked
`observed_in_latest_scan: false`, and its evidence says so in words. Dropping the
line would discard a judgement somebody made on purpose and re-decide from
scratch when it reappears.

A vendor with **no** override and no observation is not carried forward: there
is nothing to preserve, and inventing a line for a vendor nobody has seen or
ruled on would be noise.

## Conflicting regimes

Most restrictive wins. If any regime in play raises a consent obligation the
answer is `required`, because satisfying the stricter obligation satisfies the
other and the reverse is not true. That is the policy engine's own conflict rule,
reused rather than reimplemented differently — and every regime's citation is
carried, so a reviewer can see the recommendation rested on more than one.

## Confidence is not laundered

A firm regulatory finding does **not** raise confidence in a weak observation.
That ePrivacy requires consent is certain; that this vendor is present may not
be. So a `low`-confidence detection stays `low` even when the rule behind it is
unambiguous, and the two facts are reported separately.

An override reports `high` confidence **in itself** — a human decided — not in
the detection underneath it, which is preserved unchanged so the override can be
reconsidered later.

## Limitations

- **The category map is coarse.** Eight scanner categories to eight suggested
  purposes. Anything unmatched becomes `review` with no purpose, never a guess.
- **One consent finding per policy, not per vendor.** The regulatory question
  asked is "does a consent obligation exist for these jurisdictions", which is
  the same for every vendor in a policy. Per-vendor data categories exist but do
  not yet narrow the evaluation.
- **No per-vendor jurisdiction.** A vendor's own destination country is recorded
  by the scanner but does not affect which regimes are evaluated.
- **Approval has no attribution.** There are no user accounts, so `approval_note`
  is the only record of who approved a version. Same MVP compromise as the rest
  of the dashboard.
- **Nothing is enforced by this phase.** A recommendation changes nothing on its
  own; `block` is a suggestion and the review screen says so. Phase 9B acts on
  an *approved* policy in the browser, within the limits set out in
  [enforcement.md](enforcement.md).
- **Superseding is not undo.** Publishing a new version supersedes the old one;
  there is no "revert to version 3" beyond approving its contents again.
- **Two concurrent approvals conflict rather than merge.** The loser is told to
  re-read and approve again, which is correct but is a poor experience if it ever
  happens twice.

## Verification

```bash
npm run test:unit    # 541 tests; 43 are the autopilot
npm run typecheck
npm run lint
```

Persistence — approval, the immutability trigger, one-approved-per-site,
override survival and tenant isolation — was verified against the real database
during the phase.
