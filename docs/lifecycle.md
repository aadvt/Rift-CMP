# Lifecycle: Consent to Transfer to Audit

This document defines how the consent domain ([consent.md](consent.md)) and the
secure routing prototype ([secure-transfer.md](secure-transfer.md)) are joined
into one product flow: where the decision is made, why asking is a separate act
from committing, and how the whole story is read back afterwards.

## The rule

> A recorded consent decision is what permits an action. Nothing may act on a
> Data Principal's data without one, and the record of what happened must always
> name the exact decision it relied upon.

Everything below exists to make that sentence true end to end, rather than true
in each domain separately and unchecked at the seam between them.

## What this layer is not

It adds **no** legal rules. It does not decide which purposes require consent,
how long a decision stays valid, or what any jurisdiction demands. The only rule
it applies is "the decision currently in force must be `GRANTED`". A compliance
engine still sits above this, reading the vocabulary rather than being embedded
in it — exactly as set out in [consent.md](consent.md).

It also adds **no** cryptography. The trust boundary, and every honest limit on
it, is unchanged and still described in [secure-transfer.md](secure-transfer.md).
That surface remains a proof of concept with no cryptographic review.

## The end-to-end flow

```text
   Data Principal        Source Fiduciary          Rift (this repo)         Target Fiduciary
   (a browser)           (a server)                                         (holds the key)
        |                      |                          |                        |
   1. decides           |      |                          |                        |
        |  -- POST /api/v1/consent (pk_) ---------------> |                        |
        |                      |                    appends one immutable          |
        |                      |                    consent record                 |
        |                      |                          |                        |
        |               2. asks (optional)                 |                       |
        |                      |  -- POST /authorisations/decision (sk_) --> |     |
        |                      |  <---- 200 permitted true|false ----------- |     |
        |                      |                   evaluateAuthorisation:          |
        |                      |                   reads only, creates nothing     |
        |                      |                          |                        |
        |               3. requests permission             |                       |
        |                      |  -- POST /api/v1/authorisations (sk_) ----> |     |
        |                      |                   same evaluation, then a         |
        |                      |                   single-use authorisation        |
        |                      |  <---- 201 + public key + binding --------- |     |
        |                      |                          |                        |
        |               4. seals locally                   |                       |
        |                      |     ECDH -> HKDF -> AES-GCM, AAD = binding        |
        |                      |                          |                        |
        |                      |  -- POST /api/v1/transfers (sk_) ---------> |     |
        |                      |                   consumes the authorisation,     |
        |                      |                   stores ciphertext + digest      |
        |                      |                          |                        |
        |                      |                          | <-- GET .../envelope (rk_)
        |                      |                          | --- envelope + binding ->
        |                      |                          |               5. opens it
        |                      |                          |                        |
        |               6. reads the whole story           |                       |
        |                      |  -- GET /api/v1/audit (sk_) --------------> |     |
        |                      |  <---- one timeline, newest first --------- |     |
```

Steps 2 and 3 ask the same question. Only step 3 writes anything. Steps 3 and 4
are separate requests on purpose: the ciphertext does not exist when the decision
is made, so it cannot influence it.

## The orchestration layer

`evaluateAuthorisation` in [`../database/authorisation.ts`](../database/authorisation.ts)
answers exactly one question:

> Is this requested action currently authorised for this Data Principal, this
> Fiduciary and this purpose?

It is **side-effect free**. It creates no rows, mints no nonce, stamps no
timestamp, and contains no cryptography. Asking is not the same as being granted
permission, and the separation is what carries the design:

- **It keeps the domains decoupled.** Consent knows nothing about transfers;
  transfers know nothing about how consent is evaluated. This module is the only
  place they meet. `authoriseTransfer` in `database/transfers.ts` no longer makes
  the decision itself — it delegates and then does the one thing that *is*
  transfer-specific: minting a single-use permission to move a payload.
- **It makes the question answerable cheaply.** A fiduciary often needs to know
  the answer before committing: to decide whether to collect the data at all, to
  explain to a user why something is unavailable, or to check a batch before
  starting. Creating an authorisation to find out would write a row and burn a
  permission for a question.
- **There is one definition of "current consent".** Step 4 below calls
  `getEffectiveConsent`, the same derivation the consent API and the SDK use. The
  gate cannot drift away from the log that justifies it, because there is no
  second implementation to drift.

It also cannot be used to probe across tenants. Every lookup is scoped to the
`organisationId` the caller's credential resolved to, so another tenant's site,
principal or purpose is indistinguishable from one that does not exist.

### The eight steps

| # | Step | On failure |
| --- | --- | --- |
| 1 | Resolve the site within the caller's organisation | `site_not_found` |
| 2 | Resolve the principal, scoped to that site | `principal_not_found` |
| 3 | Resolve the purpose, scoped to the organisation | `purpose_not_found` |
| 4 | Derive effective consent for that principal via `getEffectiveConsent` | — |
| 5 | Select the decision in force for that purpose | — |
| 6 | Refuse if there is no decision at all | `no_consent_decision` |
| 7 | Refuse if the decision is not `GRANTED` | `consent_denied` / `consent_withdrawn` |
| 8 | Return the resolved context: site, principal, purpose, `consent_record_id`, status, `decided_at` | — |

The order matters and is deliberate. The principal is resolved before the
purpose, so a request naming both an unknown principal and an unknown purpose
reports `principal_not_found` — the first thing that did not resolve, not a
guess at which one the caller meant.

Step 8 is why a permitted answer is useful rather than merely reassuring: it
names the **exact** append-only consent record relied upon, so the caller can
cite it and an auditor can verify it against the log.

## Refusal reasons

Refusals are distinct rather than one generic failure. "Never decided",
"refused" and "granted then withdrew" are materially different — to a caller
deciding what to do next, and to an auditor reconstructing what happened. A
single `not_permitted` would destroy information no later query could recover.

| `reason` | Means | What a caller should conclude |
| --- | --- | --- |
| `site_not_found` | No such site in the caller's organisation | The site id is wrong, or belongs to another tenant |
| `principal_not_found` | The site exists; no principal on it with that external id | This person has never interacted with this site — consent does not travel between sites |
| `purpose_not_found` | No purpose with that code in the organisation | The purpose was never declared; declare it before asking |
| `no_consent_decision` | Principal and purpose both exist; nothing was ever decided | Ask for consent. **Absence of a decision is not permission** |
| `consent_denied` | The decision in force is `DENIED` | The principal refused up front |
| `consent_withdrawn` | The decision in force is `WITHDRAWN` | The principal granted, then revoked |

`consent_denied` and `consent_withdrawn` both mean "not permitted" today and
behave identically at the gate. They stay separate for the same reason
`DENIED` and `WITHDRAWN` are separate statuses in the consent record: an audit
trail that cannot tell a refusal from a revocation has lost a fact.

The reasons above are the vocabulary of the orchestration layer, typed in
[`../shared/authorisation.ts`](../shared/authorisation.ts). The management API
maps them onto its own error codes when a request is refused rather than
answered — see [Status codes](#status-codes).

## Four API boundaries

| Concern | Endpoint(s) | Plane |
| --- | --- | --- |
| Consent — record a decision, read one principal's state | `POST\|GET /api/v1/consent` | ingestion, `pk_` |
| Authorisation — ask, or ask and be granted | `POST\|GET /api/v1/authorisations`, `POST /api/v1/authorisations/decision` | management, `sk_` |
| Transfer — submit a sealed envelope, read routing metadata | `POST\|GET /api/v1/transfers` | management, `sk_` |
| Audit — the whole story, one timeline | `GET /api/v1/audit` | management, `sk_` |

### Why authorisation is not nested under transfers

`POST /api/v1/transfers/authorisations` **moved** to `POST /api/v1/authorisations`.
This is a breaking change, and it is a deliberate one.

A transfer is one action that needs permission. The permission itself is the
thing being modelled — not a sub-resource of the first action that happened to
need it. Nesting it said the opposite: that authorisation exists because
transfers do. Under the flat boundary a second kind of action can be gated by the
same decision without reshaping this API, and neither the consent domain nor the
routing prototype has to grow a dependency on the other to make that work.

The move also makes `POST /api/v1/authorisations/decision` a natural sibling
rather than an awkward third level under a resource it has nothing to do with.
Answering "is this permitted?" is not part of transferring anything.

Full request and response shapes for all four are in [api-spec.md](api-spec.md).

### The decision endpoint refuses with `200`

`POST /api/v1/authorisations/decision` returns `200` with `permitted: false` when
consent does not allow the action. It is **not** an HTTP error.

"Consent was withdrawn" is a successful answer to a well-formed question.
Conflating it with a malformed request, a bad credential or a missing resource
would make both harder to handle: a caller would have to parse an error body to
learn a routine fact, and a genuine `400` would look like ordinary business
logic. The HTTP status describes whether the question was answered; `permitted`
describes the answer.

The response body always carries the same fields, so a caller can read it
without branching first:

```json
{
  "permitted": false,
  "reason": "consent_withdrawn",
  "message": "Consent for \"analytics\" is currently WITHDRAWN.",
  "site_id": "site_demo",
  "principal_external_id": "p_3f9c",
  "purpose_code": "analytics",
  "consent_record_id": null,
  "consent_status": null,
  "decided_at": null
}
```

`consent_record_id`, `consent_status` and `decided_at` are populated **only**
when `permitted` is `true`. There is no partial evidence: a refusal cites no
record, because no record permitted anything.

`site_id`, `principal_external_id` and `purpose_code` echo the request. They make
a stored response self-describing, and they are the caller's own values — the
endpoint never resolves them into internal ids.

`POST /api/v1/authorisations`, by contrast, does commit. It runs the same
evaluation, then resolves the recipient and mints a single-use, time-bounded
authorisation. Consent refusing there is a `409 consent_not_granted`, because the
caller asked for something and did not get it; anything the caller does not own
is `404`, so ids cannot be probed across tenants.

## The audit read model

`GET /api/v1/audit` interleaves consent decisions, authorisations and transfers
for one tenant into a single timeline, newest first.

```text
  consent_records        transfer_authorisations       transfer_records
        |                          |                          |
        +--------------------------+--------------------------+
                                   |
                        getAuditTrail (database/audit.ts)
                        three queries, merged in memory
                                   |
                             GET /api/v1/audit
```

The three domains are **not joined in the database**, and this is the point.
Consent has no foreign key to transfers. Adding one to make this query tidier
would couple domains that Phase 2 and Phase 3 kept apart on purpose, and would
put that coupling somewhere a migration is needed to undo it. The join happens
here, in a read model, where it costs nothing structurally and can be changed or
dropped without touching either domain.

Every entry has the same flat shape:

| Field | Notes |
| --- | --- |
| `kind` | `consent`, `authorisation` or `transfer` |
| `at` | When it happened — the sort key across all three kinds |
| `site_id`, `principal_external_id`, `purpose_code` | The common grain |
| `status` | Domain-specific: `GRANTED`, `AUTHORISED`, `RECORDED`, and so on |
| `summary` | One line a human can read without cross-referencing anything |
| `consent_record_id`, `authorisation_id`, `transfer_id` | Cross-references; `null` where the kind does not have one |

It is a projection, not a window onto the database: no table shape is exposed,
and the ids that do appear are the same public identifiers the other APIs already
return. The envelope is never in it — the audit trail is metadata about a
transfer, never its contents.

### Ordering

Newest first by `at`. Ties break by kind — transfer, then authorisation, then
consent — so that a consent decision, the authorisation it justified and the
resulting transfer read in causal order even when they land in the same
millisecond. Without the tiebreaker a fast flow would sometimes render in an
order that implies the transfer preceded its own permission.

### Filters

| Parameter | Notes |
| --- | --- |
| `site_id` | Must be a site the caller owns, else `404` |
| `principal_external_id` | Exact match |
| `purpose_code` | Exact match |
| `limit` | Integer 1–1000, default 200 |

All of them **narrow within** the tenant and can never widen beyond one. An
out-of-range `limit` is rejected rather than silently clamped, matching
`GET /api/v1/consent/history`.

## Worked example

One principal, `p_3f9c`, on `site_demo`, for the `analytics` purpose, sending to
the `partner-bank` recipient.

**09:00** — the banner is accepted. `POST /api/v1/consent` with the site public
key appends `rec_1` (`GRANTED`). See [consent.md](consent.md) for the full shape.

**09:04** — the fiduciary's server checks before collecting anything.

```http
POST /api/v1/authorisations/decision
Authorization: Bearer sk_2f8c...

{ "site_id": "site_demo", "principal_external_id": "p_3f9c",
  "purpose_code": "analytics" }
```

`200 OK`:

```json
{
  "permitted": true,
  "reason": null,
  "message": "Consent for \"analytics\" is currently GRANTED.",
  "site_id": "site_demo",
  "principal_external_id": "p_3f9c",
  "purpose_code": "analytics",
  "consent_record_id": "rec_1",
  "consent_status": "GRANTED",
  "decided_at": "2026-09-01T09:00:00.000Z"
}
```

Nothing was created. Asking again returns the same answer.

**09:05** — it commits.

```http
POST /api/v1/authorisations
Authorization: Bearer sk_2f8c...

{ "site_id": "site_demo", "principal_external_id": "p_3f9c",
  "purpose_code": "analytics", "recipient_code": "partner-bank" }
```

`201 Created`, with `consent_record_id: "rec_1"` — the same record the decision
named — plus `recipient_public_key`, `nonce` and `expires_at`.

**09:05** — the source seals the payload locally and submits it to
`POST /api/v1/transfers`. The authorisation moves to `CONSUMED`; the transfer is
`RECORDED`.

**09:06** — the target collects it on the delivery plane and opens it. Rift held
ciphertext throughout.

**Audit** — `GET /api/v1/audit?principal_external_id=p_3f9c` with the secret key:

```json
{
  "entries": [
    { "kind": "transfer", "at": "2026-09-01T09:05:04.117Z", "status": "RECORDED",
      "summary": "Sealed payload of 148 bytes recorded for \"partner-bank\" (recorded).",
      "consent_record_id": "rec_1", "authorisation_id": "auth_1", "transfer_id": "tr_1",
      "site_id": "site_demo", "principal_external_id": "p_3f9c", "purpose_code": "analytics" },

    { "kind": "authorisation", "at": "2026-09-01T09:05:00.000Z", "status": "CONSUMED",
      "summary": "Transfer to \"partner-bank\" authorised for \"analytics\", relying on consent record rec_1.",
      "consent_record_id": "rec_1", "authorisation_id": "auth_1", "transfer_id": null,
      "site_id": "site_demo", "principal_external_id": "p_3f9c", "purpose_code": "analytics" },

    { "kind": "consent", "at": "2026-09-01T09:00:00.000Z", "status": "GRANTED",
      "summary": "Principal recorded GRANTED for \"analytics\".",
      "consent_record_id": "rec_1", "authorisation_id": null, "transfer_id": null,
      "site_id": "site_demo", "principal_external_id": "p_3f9c", "purpose_code": "analytics" }
  ]
}
```

Three entries, one story. Every one of them carries `rec_1`, so the chain from
the decision to the delivery can be followed in either direction without a join.
The `09:04` decision does not appear: asking created nothing, so there is nothing
to report.

## What a withdrawal does

**11:30** — the same visitor opens the preference centre and revokes.
`POST /api/v1/consent` appends `rec_2` (`WITHDRAWN`). Nothing is updated.

From that moment:

| | Effect |
| --- | --- |
| `POST /api/v1/authorisations/decision` | `200` with `permitted: false`, `reason: "consent_withdrawn"` |
| `POST /api/v1/authorisations` | `409 consent_not_granted`; no row is created |
| The transfer made at 09:05 | Unchanged. Still `RECORDED`, still citing `rec_1` |
| `rec_1` | Unchanged. Still `GRANTED` |
| `GET /api/v1/audit` | Now four entries; the withdrawal is added at the top |

A withdrawal **stops future authorisations. It does not rewrite the past.** The
transfer that already happened still cites the consent that was in force when it
happened, and that consent record still says `GRANTED`, because
`consent_records` is append-only and a database trigger refuses any `UPDATE`.

This is the honest position, not a limitation being glossed over. A record that
retroactively claimed the transfer had never been permitted would be false: it
*was* permitted, at 09:05, by a decision the principal had made. What a
withdrawal means for data already delivered is a question for the compliance
engine and for the recipient — it is not something this layer can answer by
editing history. `api/tests/lifecycle.test.ts` asserts exactly this behaviour.

## The SDK is unchanged

This is the correct outcome, and it is stated rather than omitted.

The SDK speaks only consent and events. It authenticates with a **site public
key**, which is visible to anyone who views page source. Authorisation, transfer
and audit are server-to-server capabilities on the management plane,
authenticated with the **organisation secret**, which must never reach a browser.

There is therefore no `analytics.authorise()`, no transfer client, and no audit
reader in `sdk/`. Adding one would require shipping a secret into browser code,
which would hand every visitor the ability to authorise transfers of other
people's data and to read the organisation's entire audit trail. The absence is
the design.

## What is proven

`api/tests/lifecycle.test.ts` exercises the API surface a fiduciary actually
integrates against, not the service functions underneath it.

| Scenario | What it establishes |
| --- | --- |
| **A** — no consent | A request for a principal who has never decided is refused; no authorisation and no transfer row exist afterwards. A known principal who decided nothing *for this purpose* is reported distinctly, as `no_consent_decision` |
| **B** — consent granted | The full path: consent, decision, authorisation, sealed transfer, collection, audit. The authorisation cites the same consent record the decision named, and so does every audit entry |
| **C** — consent withdrawn | After a withdrawal the decision reports `consent_withdrawn` and a new request is `409`. Both consent rows survive, in order. A transfer already made is untouched and still cites the `GRANTED` record |
| **D** — wrong purpose | A purpose the principal did not consent to is `409`; a purpose that does not exist at all is `404` with `purpose_not_found` — two different answers, not one |
| **E** — wrong Fiduciary | Organisation B, using its own valid credential against Organisation A's site, gets `404`, and the decision endpoint reports `site_not_found` — from B's position, A's site does not exist |
| **F** — cross-tenant | Naming another tenant's site fails; a *sibling site in the same organisation* also fails, because consent does not travel between sites; one organisation's audit trail is empty from another's credential |
| **G** — secure payload boundary | The payload appears nowhere in the stored transfer row, nowhere in its decoded ciphertext, and nowhere in the audit trail. The target, holding the key Rift never had, recovers it exactly |

Failure modes covered alongside them:

- `DENIED` is distinguished from "never decided" (`consent_denied`).
- Missing, wrong-plane (`pk_`, `rk_`) credentials are all `401`.
- Malformed bodies are `400` and touch no state — including one that attaches a
  `plaintext` field to a permission request, which the strict schema refuses.
- An unknown or **deactivated** recipient is `404`.
- **Replay**: resubmitting a consumed authorisation is `409`, and exactly one
  transfer exists.
- **Duplicate request**: two authorisation requests are two independent
  permissions with distinct ids and nonces. They are not deduplicated — asking
  twice is not the same as asking once.
- **Transfer failure**: a rejected envelope leaves the authorisation `AUTHORISED`
  and reusable, so a transient client bug does not burn a permission. The retry
  succeeds.
- **Concurrency**: two simultaneous submissions of the same authorisation resolve
  to exactly `[201, 409]`, one transfer row, and an authorisation left `CONSUMED`
  — never two transfers, and never a consumed authorisation with nothing recorded
  against it.

## Status codes

The orchestration layer's `reason` and the API's `code` are different
vocabularies on purpose: `reason` says why the answer was no, `code` says how the
request failed. `POST /api/v1/authorisations` maps one onto the other.

| `reason` | Status on `POST /api/v1/authorisations` | `code` |
| --- | --- | --- |
| `site_not_found` | `404` | `not_found` |
| `principal_not_found` | `404` | `not_found` |
| `purpose_not_found` | `404` | `unknown_purpose` |
| `no_consent_decision` | `409` | `consent_not_granted` |
| `consent_denied` | `409` | `consent_not_granted` |
| `consent_withdrawn` | `409` | `consent_not_granted` |

Anything the caller does not own is `404`, matching the rest of the API so ids
cannot be probed across tenants. `409` is used only for the one case where every
identifier resolved and the answer is simply "the principal has not permitted
this".

`POST /api/v1/authorisations/decision` never uses either mapping. It returns
`200` and reports the `reason` in the body, as above.

Full request and response shapes are in [api-spec.md](api-spec.md).

## Deliberate scope limits

These are known and accepted for this phase:

- **There is no dashboard.** `GET /api/v1/audit` returns JSON. Rendering a
  timeline, a filter UI or an export is the other side's work, per
  [integration-contract.md](integration-contract.md).
- **There are no analytics over the audit trail.** No counts, no aggregates, no
  "transfers per purpose this month", no alerting on a refusal rate. The endpoint
  lists events; anything that summarises them sits above it.
- **There is still no compliance rule engine.** The only rule applied is "the
  decision in force must be `GRANTED`". Whether a purpose requires consent at
  all, whether a decision has gone stale, and what a jurisdiction demands are all
  outside this layer, exactly as in [consent.md](consent.md).
- **Refused attempts are not persisted.** A refusal creates no row, so
  `GET /api/v1/audit` shows what happened, not what was attempted and denied.
  That is a real gap for anyone who wants to detect a fiduciary repeatedly
  probing withdrawn consent. Recording refusals would mean writing on a read
  path, and designing it — retention, volume, what an unauthenticated probe
  should produce — is separate work.
- **The audit trail is not itself append-only.** It is a projection over three
  tables. `consent_records` is protected by a trigger; the routing tables are
  not, and no trigger guards the timeline as a whole.
- **There is no per-user identity or role model.** An organisation secret is
  all-or-nothing over that organisation's authorisations and audit trail, exactly
  as it is over its sites and consent data. There is no read-only auditor
  credential.
- **The three domains are merged in memory, not in SQL.** `getAuditTrail` takes
  `limit` rows from each of the three tables and then sorts. With a `limit` far
  below a tenant's total volume, a very lopsided distribution can push older
  entries of one kind out of the window. That is a deliberate trade for keeping
  the domains unjoined; a tenant with real volume would need a different read
  model.
- **The secure routing half remains a proof of concept.** Joining it to consent
  does not make it reviewed. It has had no cryptographic review, has no key
  rotation story, and must not be described as production-secure. See the known
  limitations in [secure-transfer.md](secure-transfer.md).
