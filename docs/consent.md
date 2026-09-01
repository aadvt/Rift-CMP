# Consent Domain

This document defines how Rift-CMP records consent: what the vocabulary means,
why current state is derived rather than stored, and which credential is allowed
to see what.

## The rule

> A consent decision is a fact about a moment in time. Recording a new decision
> must never erase the previous one.

Everything below exists to make that rule true by construction. The database, not
convention, is what enforces it.

## What this domain is not

These models encode **structure** — who decided what, about which purpose, under
which notice, when — and **no legal rules**. There are no retention periods, no
jurisdiction logic, no "analytics requires consent" policy, no notion of which
purposes are strictly necessary. Nothing in the schema, the API or the SDK knows
what any particular regulation demands.

That is deliberate. A compliance engine for any given regulation is expected to
sit *above* this vocabulary later, reading it rather than being embedded in it.
Baking one regulation's rules into the storage layer would mean re-migrating the
database the first time a second jurisdiction appeared, and would make the audit
trail an opinion rather than a record.

## Vocabulary

| Model | Means | Scoped to |
| --- | --- | --- |
| `Organisation` | The **data fiduciary** — the legal entity that decides why data is used | (is the tenant) |
| `Website` | The **site** where consent was collected | organisation |
| `Principal` | The **person** a decision belongs to | site |
| `Purpose` | Something the fiduciary uses data for, named by stable `code` | organisation |
| `Policy` | A document the fiduciary publishes | organisation |
| `PolicyVersion` | One immutable version of that document | organisation |
| `Notice` | What was actually shown: one policy version, one locale, a set of purposes | organisation |
| `NoticePurpose` | Which purposes a notice disclosed | notice + purpose |
| `ConsentRecord` | One immutable decision by one principal about one purpose | site |

Two scoping levels matter, and they are not the same:

- **Reference data is organisation-scoped.** A fiduciary declares "analytics"
  once and it is shared across every site it owns. Purposes, policies, policy
  versions and notices all live at this level, because they are statements the
  legal entity makes, not properties of a particular domain name.
- **People and decisions are site-scoped.** A principal belongs to one site,
  and so does every consent record. This is the grain the SDK authenticates at:
  a browser holds a site public key, not an organisation credential, so it can
  only ever create or read data inside that one site.

The same `external_id` presented on two different sites is two different
principals. There is no cross-site identity graph, by design.

## Ownership tree

```text
Organisation  (= Data Fiduciary; the tenant boundary)
 |
 |-- Purpose            code "analytics"        org-scoped reference data
 |-- Purpose            code "marketing"
 |
 |-- Policy  "privacy-policy"
 |     |
 |     +-- PolicyVersion "1.0.0"
 |     +-- PolicyVersion "1.1.0"                immutable once published
 |
 |-- Notice  "notice-1" (locale "en")
 |     |
 |     |--> PolicyVersion "1.0.0"               the text it showed
 |     +-- NoticePurpose --> Purpose            what it disclosed
 |
 +-- Website  (= where consent was collected)
       |
       |-- Principal  external_id "3f9c..."     the person, anonymous
       |     |
       |     +-- ConsentRecord --> Purpose      the decision
       |            |     |     --> Notice          (optional)
       |            |     +-------> PolicyVersion   (optional, usually derived)
       |            +-- ConsentRecord
       |            +-- ConsentRecord            append-only
       |
       +-- Session ---- Event                   analytics domain; see below
```

`npm run seed` (from `database/`) provisions the reference-data half of this
shape — two purposes, a versioned privacy policy, and a notice disclosing both —
and prints it, so a decision can be recorded against a real purpose immediately.

## Principals are anonymous

For the MVP a principal is anonymous. `external_id` is an opaque, high-entropy
identifier the SDK mints with `crypto.randomUUID()` and stores in `localStorage`
under `rift_cmp_principal_id`. The server never learns anything about the person
behind it; it is a handle for correlating that browser's decisions, nothing more.

`Principal.kind` defaults to `"anonymous"` and is an open string rather than an
enum, so a later phase can promote a principal to `"identified"` — once the
platform has any notion of a logged-in user — without a schema change or a
migration of existing rows.

The principal identifier deliberately outlives the analytics session id. A
session ends after 30 minutes of inactivity and lives in `sessionStorage`; a
consent decision is meant to stand across visits until the principal changes it,
so its identifier lives in `localStorage`. Conflating the two would silently
expire consent.

## History is never overwritten

`consent_records` is append-only. Changing your mind does not update a row — it
appends a new one. "Current consent" is **derived** as the newest record per
`(principal, purpose)`; it is never stored as a mutable flag.

That choice is the whole design:

- A mutable "is granted" column can drift away from the log that is supposed to
  justify it. A derived value cannot, because there is nothing else to drift
  from.
- The question an auditor actually asks is not "is this granted now" but "what
  was granted at 14:00 on the 3rd, and under which notice". Only a log answers
  that.
- Reconstructing state from history is a pure function, so it can be tested
  without a database and executed in a browser.

`resolveEffectiveConsent` in [`../shared/consent.ts`](../shared/consent.ts) is
the single definition of "effective consent" in the codebase. The API and the SDK
both call it, so the two can never disagree about what "current" means.

Ordering is by `decided_at`, then `recorded_at`, then `consent_record_id`. The
tiebreakers exist so that two decisions sharing a timestamp still resolve
deterministically rather than depending on row order.

Only `GRANTED` means processing is permitted. **Absence of a decision is not
permission**: `isPurposeGranted` returns `false` for a purpose no one has decided
on, so a first-time visitor is not accidentally treated as consenting.

`getEffectiveConsent` is also what the orchestration layer reads when something
downstream asks whether an action is permitted, so there is one gate rather than
a second opinion. See [lifecycle.md](lifecycle.md).

### `WITHDRAWN` is not `DENIED`

Both currently resolve to "not permitted", so they behave identically at the
gate. They are still separate statuses, because refusing up front and revoking a
consent previously given are different events, and an audit trail that cannot
tell them apart has lost information that no later query can recover.

The distinction is carried through rather than dropped at the boundary: the
orchestration layer refuses with `consent_denied` or `consent_withdrawn`, not one
generic reason. See [lifecycle.md](lifecycle.md).

Status is a `String` column, not a database enum, so a new decision type needs no
type migration — the API validates against `CONSENT_STATUSES` from the shared
package. This follows the convention already set by `events.event_type`.

### The database enforces it

A PostgreSQL trigger, `consent_records_append_only`, fires `BEFORE UPDATE` on
`consent_records` and raises with `ERRCODE = 'restrict_violation'` (SQLSTATE
`23001`). There is no API route that updates a consent record, but the guarantee
does not depend on that: `api/tests/consent-decisions.test.ts` reaches past the
API entirely and issues the `UPDATE` through Prisma, and PostgreSQL refuses it.

**`DELETE` is deliberately not blocked.** Two reasons:

1. Tenant offboarding cascades from `organisations`. Deleting an organisation
   must remove its sites, principals and consent records; a trigger that blocked
   `DELETE` would make offboarding impossible without first disabling the
   trigger, which is worse than not having it.
2. Retention and erasure are a separate concern from immutability. When a
   retention policy exists it will need to remove rows, and it should not have to
   fight the schema to do so.

The guarantee this trigger makes is precise: a recorded decision is never
*rewritten*. It does not claim rows live forever.

## The two credential planes

Phase 1's two planes are preserved unchanged, and consent is split across them
along the same line.

| | Site public key `pk_` | Organisation secret key `sk_` |
| --- | --- | --- |
| Record a decision | `POST /api/v1/consent` | — |
| Read **one** principal's state | `GET /api/v1/consent` | — |
| Read the audit trail | — | `GET /api/v1/consent/history` |
| Manage purposes | — | `GET\|POST /api/v1/purposes` |
| Manage policies and versions | — | `GET\|POST /api/v1/policies`, `POST /api/v1/policies/{policyId}/versions` |
| Manage notices | — | `GET\|POST /api/v1/notices` |
| CORS | enabled, with `OPTIONS` preflight | none |

The split is not arbitrary. A public key is visible to anyone who views the page
source, so anything it can do, a stranger can do. It may therefore:

- append a decision for a principal id it supplies, and
- read the state of **one** principal whose high-entropy id it already knows.

It may **not** enumerate principals, list decisions across principals, or read
history. Those are operator capabilities and require the organisation secret,
which never leaves a server. Reference data is management-only for the same
reason plus one more: purposes and notices are statements the fiduciary makes,
and a browser must not be able to invent new ones.

A principal that has never been seen returns an empty `purposes` list from
`GET /api/v1/consent`, not `404`. "No decision recorded" is the normal state for
a first-time visitor, and the empty list already reads as "not granted"
everywhere it matters. Returning `404` would also turn the endpoint into an
oracle for whether a given principal id exists.

## Worked example

One principal, `p_3f9c`, on `site_demo`, deciding about the `analytics` purpose.

**09:00** — the banner is accepted.

```http
POST /api/v1/consent
Authorization: Bearer pk_demo_12345

{ "principal_external_id": "p_3f9c", "purpose_code": "analytics",
  "status": "GRANTED", "notice_id": "3a1e...", "decided_at": "2026-08-31T09:00:00Z" }
```

`201`, with the recomputed state alongside the record so no read-after-write is
needed:

```json
{
  "record": { "consent_record_id": "rec_1", "purpose_code": "analytics",
              "status": "GRANTED", "decided_at": "2026-08-31T09:00:00.000Z", "...": "..." },
  "effective": [ { "purpose_code": "analytics", "status": "GRANTED",
                   "decided_at": "2026-08-31T09:00:00.000Z", "consent_record_id": "rec_1",
                   "notice_id": "3a1e...", "policy_version_id": "9c04..." } ]
}
```

**11:30** — the same visitor opens the preference centre and revokes.

```http
POST /api/v1/consent
{ "principal_external_id": "p_3f9c", "purpose_code": "analytics",
  "status": "WITHDRAWN", "decided_at": "2026-08-31T11:30:00Z" }
```

Nothing is updated. A second row is appended.

**Effective state** — `GET /api/v1/consent?principal_external_id=p_3f9c` with the
public key:

```json
{
  "site_id": "site_demo",
  "principal_external_id": "p_3f9c",
  "purposes": [ { "purpose_code": "analytics", "status": "WITHDRAWN",
                  "decided_at": "2026-08-31T11:30:00.000Z",
                  "consent_record_id": "rec_2", "notice_id": null,
                  "policy_version_id": null } ]
}
```

One entry, because effective consent is one decision per purpose. `isGranted("analytics")`
is now `false`.

**History** — `GET /api/v1/consent/history?principal_external_id=p_3f9c` with the
secret key:

```json
{
  "records": [
    { "consent_record_id": "rec_2", "status": "WITHDRAWN", "decided_at": "2026-08-31T11:30:00.000Z", "...": "..." },
    { "consent_record_id": "rec_1", "status": "GRANTED",   "decided_at": "2026-08-31T09:00:00.000Z", "...": "..." }
  ]
}
```

Both rows, newest first. `rec_1` still points at the notice and policy version
that were in force at 09:00 — which is exactly what makes it evidence rather than
a log line. Publishing policy version `1.1.0` tomorrow does not touch it.

Recording `GRANTED` twice in a row also produces two rows. Repeated identical
decisions are not deduplicated: "they re-confirmed at 14:00" is a fact worth
keeping.

## Notices are checked, not just stored

A notice records which purposes it disclosed, in `notice_purposes`. That link is
what lets a consent record cite the notice as cover — and it is checked:
`recordConsentDecision` rejects a decision naming a notice that never disclosed
the purpose being consented to, with `unknown_purpose`.

Without that check, a notice id would be decorative: any decision could claim any
notice, and the audit trail would assert something the notice text never said.

When a notice is supplied and no `policy_version_id` is given, the policy version
is **derived from the notice**. An explicitly supplied `policy_version_id` wins.
The version is snapshotted onto the record so it stands alone even if the notice
is later superseded.

## Tenant isolation

Phase 1's isolation is preserved and extended. Every reference in the consent
domain is tied into a single tenant by a **composite foreign key**, the same
technique that ties an event's session to its site.

| Constraint | What it prevents |
| --- | --- |
| `principals.site_id` FK -> `websites.id` (cascade) | A principal with no site |
| `purposes.organisation_id` FK -> `organisations.id` (cascade) | A purpose with no fiduciary |
| `policies.organisation_id` FK -> `organisations.id` (cascade) | A policy with no fiduciary |
| **`policy_versions (policy_id, organisation_id)` FK -> `policies (id, organisation_id)`** (cascade) | A version attached to another tenant's policy |
| **`notices (policy_version_id, organisation_id)` FK -> `policy_versions (id, organisation_id)`** (no action) | A notice citing another tenant's policy text |
| **`consent_records (site_id, organisation_id)` FK -> `websites (id, organisation_id)`** (cascade) | A decision recorded against a site the tenant does not own |
| **`consent_records (principal_id, site_id)` FK -> `principals (id, site_id)`** (cascade) | A decision attached to another site's principal |
| **`consent_records (purpose_id, organisation_id)` FK -> `purposes (id, organisation_id)`** (no action) | A decision against another tenant's purpose |
| **`consent_records (notice_id, organisation_id)` FK -> `notices (id, organisation_id)`** (no action) | Citing another tenant's notice |
| **`consent_records (policy_version_id, organisation_id)` FK -> `policy_versions (id, organisation_id)`** (no action) | Citing another tenant's policy version |
| `principals @@unique([site_id, external_id])` | The same person recorded twice on one site |
| `purposes @@unique([organisation_id, code])` | Two purposes sharing a code within a fiduciary |
| `policies @@unique([organisation_id, code])` | Two policies sharing a code within a fiduciary |
| `policy_versions @@unique([policy_id, version])` | Republishing a version number in place |
| `notices @@unique([organisation_id, version, locale])` | Two notices sharing an identity |

Note the split between `ON DELETE CASCADE` and `ON DELETE NO ACTION`.

Ownership edges cascade: deleting an organisation removes its purposes, policies,
notices, sites, principals and consent records, and nothing else. Offboarding a
tenant stays a single delete.

Edges that point at *reference data* use `NO ACTION` rather than `RESTRICT`. Both
refuse to orphan a row, but `NO ACTION` is checked at the **end of the
statement**, whereas `RESTRICT` is checked immediately. That difference is the
whole point: when a cascading tenant delete removes a purpose and its consent
records in the same statement, `NO ACTION` sees the consistent end state and
allows it, while `RESTRICT` would abort on the intermediate state and make
offboarding fail. Deleting a purpose that still has consent history on its own
still fails, which is the behaviour we want.

### The credential still decides the tenant

Unchanged from [tenancy.md](tenancy.md), and applied throughout:

- The decision body is **strict** and contains no `site_id` or `organisation_id`.
  Sending one is a `400`, not a silently ignored field. The site comes from the
  public key.
- Every function in `database/consent.ts` takes its tenant as an explicit
  argument and scopes its queries to it. There is no way to ask it to "look up a
  purpose by id" without saying whose it is.
- A purpose code that exists in two organisations resolves to the caller's own
  purpose, never the other's.
- A purpose, notice or policy version belonging to another organisation is
  reported exactly like one that does not exist.
- `GET /api/v1/consent/history?site_id=...` for a site the caller does not own
  returns `404`, matching every other site-addressed endpoint, rather than
  silently returning an empty list.

## `decided_at` may not be in the future

`POST /api/v1/consent` rejects a `decided_at` more than five minutes ahead of
server time. The allowance absorbs ordinary client clock skew.

This is an **integrity guard, not a legal rule**. Effective consent is "newest
decision wins", so a client able to date a `GRANTED` into the future would pin it
permanently: every later withdrawal would sort behind it and become a no-op. The
guard exists to keep the derivation honest, not because any regulation says so.

## Consent is not attached to analytics events

The two domains stay separate. Nothing in the consent schema references `Session`
or `Event`; no consent flag is copied onto analytics rows; the queries in
`database/consent.ts` never touch either table. The link, when one is needed, is
made through `Principal`.

The SDK follows the same line. `analytics.consent` does **not** auto-wire itself
into the event gate — `setConsentCheck` keeps its permissive default until an
integrator opts in explicitly:

```js
analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
```

The SDK does not decide that analytics requires consent; a regulation and an
integrator do. Denormalising a consent flag onto every event would also bake one
reading of the rules into immutable rows, and would be wrong the moment a
decision changed — the event log would then disagree with the consent log about
the same instant.

## Status codes

| Situation | Status | `code` |
| --- | --- | --- |
| No credential, malformed, wrong plane, or unknown key | `401` | `unauthorized` |
| Valid site key, site is inactive | `403` | `forbidden` |
| Body is not valid JSON | `400` | `invalid_json` |
| Body fails schema validation, or names its own tenant | `400` | `invalid_request` |
| Purpose code not found in the caller's organisation | `400` | `unknown_purpose` |
| Notice supplied but never disclosed that purpose | `400` | `unknown_purpose` |
| Notice id not found in the caller's organisation | `400` | `unknown_notice` |
| Policy version not found in the caller's organisation | `400` | `unknown_policy` |
| Purpose, policy or version code already exists | `409` | `conflict` |
| Policy id not owned by the caller | `404` | `not_found` |
| `site_id` filter names a site the caller does not own | `404` | `not_found` |

Full request and response shapes are in [api-spec.md](api-spec.md).

## Deliberate scope limits

These are known and accepted for this phase:

- **There is no compliance engine.** Nothing decides whether a purpose *requires*
  consent, whether a decision is still valid after N months, or what a given
  jurisdiction demands. This layer records; something above it will judge.
- **There is no consent UI.** The SDK's consent client is headless by design: it
  owns identity, transport and caching and renders nothing. A banner subscribes
  with `onChange()` and calls `grant()`/`deny()`. Building the banner is the
  other side's work, per [integration-contract.md](integration-contract.md).
- **Principals are anonymous only.** `kind` exists so an identified principal can
  be added later, but nothing produces one today, and there is no way to link two
  principals or to merge an anonymous principal into an identified one.
- **There is no per-user identity or role model.** An organisation secret is
  all-or-nothing over that organisation's consent data, exactly as it is over its
  sites.
- **There is no retention or erasure policy.** The trigger guarantees decisions
  are not rewritten; it says nothing about how long they are kept. A deletion
  path for a principal's history does not exist yet, and designing one is a
  separate piece of work from immutability.
- **Inactive sites cannot record decisions.** An inactive site's own public key
  gets `403 forbidden`, the same as on ingestion. Existing records stay readable
  through the management plane.
- **Reference data has no update or delete routes.** Purposes, policies, versions
  and notices can be created and listed, not edited or removed over HTTP. Editing
  a published version in place would silently rewrite what a principal agreed to.
  A purpose can be deactivated via `is_active`, but nothing in the API sets it
  today.
- **Consent is enforced only on the paths that go through our API.** Phase 4 made
  it the gate for one action: a transfer authorisation is refused unless the
  decision in force is `GRANTED`, via the orchestration layer in
  [lifecycle.md](lifecycle.md). Everything else is unchanged — a downstream
  consumer that reads the database directly is outside our authorisation layer,
  so whether it respects a `WITHDRAWN` decision remains that consumer's
  responsibility.
