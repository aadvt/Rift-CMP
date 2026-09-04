# Integration Contract

This is the contract between Rift-CMP’s SDK/API/database side and the other side of the platform: analytics, dashboarding, and consent engine. It defines the responsibilities and the exact shared artifacts that must stay aligned.

## System boundary

| Concern | Owned by our side | Owned by other side |
| --- | --- | --- |
| SDK event generation | ✅ | — |
| Event ingestion API | ✅ | — |
| Tenancy model and credential issuance | ✅ | — |
| Site management API | ✅ | — |
| Database storage and schema | ✅ | — |
| Consent record: principals, purposes, policies, notices, decisions | ✅ | — |
| Consent API and append-only audit trail | ✅ | — |
| Headless SDK consent client (`analytics.consent`) | ✅ | — |
| Secure routing: recipient registry, transfer authorisation, envelope relay | ✅ | — |
| Crypto boundary package (`secure-transfer/`) | ✅ | — |
| Orchestration: "is this action currently authorised?" | ✅ | — |
| Unified audit trail across consent, authorisations and transfers | ✅ | — |
| Aggregate analytics read API (`/api/v1/analytics/*`) | ✅ | — |
| Website scanner: Playwright crawl, scan API, scan persistence | ✅ | — |
| Deciding what a scan finding means legally, and what consent it needs | — | ✅ |
| Onboarding UI built on scan results | — | ✅ |
| Operator dashboard: an internal tool, built as a consumer of the API above | ✅ | — |
| Deciding whether a purpose required consent in the first place | — | ✅ |
| Customer-facing dashboards, exports and analytics over the audit trail | — | ✅ |
| Source fiduciary: producing and sealing the plaintext | — | ✅ |
| **Target fiduciary key management: generating, storing and rotating the X25519 private key** | — | ✅ |
| Analytics dashboards for customers | — | ✅ |
| Compliance engine (which purposes need consent, in which jurisdiction, for how long) | — | ✅ |
| Consent UX: banners, preference centres | — | ✅ |
| Event schema definition | shared | shared |
| Consent vocabulary definition | shared | shared |
| Secure transfer trust model | shared | shared |
| API contract definition | shared | shared |

## Explicit ownership

Our side is responsible for:
- SDK instrumentation that sends `page_view`, `session_start`, and custom events
- API ingestion endpoints under `app/api/`
- the organisation/website ownership model, credential issuance, and authorisation
- database storage for organisations, websites, sessions, and events
- database storage for the consent domain, and the guarantee that a recorded
  decision is never rewritten
- the headless SDK consent client: identity, transport, caching — no UI
- the secure routing relay: registering recipients and their **public** keys,
  gating a transfer on consent, minting single-use authorisations, storing sealed
  envelopes, and handing them to the recipient they were addressed to
- keeping the crypto boundary structural: `api/` and `database/` import only the
  Rift-safe half of `secure-transfer/`, enforced by a test rather than by review
- **the orchestration layer.** One function, `evaluateAuthorisation`, answers "is
  this requested action currently authorised for this Data Principal, this
  Fiduciary and this purpose?". It is side-effect free — it creates no rows and
  contains no cryptography — and it is the **only** place the consent domain and
  the routing prototype meet. Consent knows nothing about transfers; transfers
  know nothing about how consent is evaluated. We own keeping it that way.
- **the refusal vocabulary.** `site_not_found`, `principal_not_found`,
  `purpose_not_found`, `no_consent_decision`, `consent_denied` and
  `consent_withdrawn` are distinct and must stay distinguishable, for the same
  reason `DENIED` and `WITHDRAWN` are distinct statuses.
- **the audit read model.** One timeline over consent decisions, authorisations
  and transfers, cross-referenced by `consent_record_id` / `authorisation_id` /
  `transfer_id`. The three domains are not joined in the database, and we own not
  joining them.
- ensuring the event envelope, the consent vocabulary and the API contract are
  implemented correctly

The other side is responsible for:
- analytics processing and reporting
- dashboarding, consent UX, and consent enforcement
- **the compliance engine.** We record structure and no legal rules: no retention
  periods, no jurisdiction logic, no "analytics requires consent" policy. That
  engine sits above the vocabulary in [consent.md](consent.md), reading it rather
  than being embedded in it. Deciding whether a given `WITHDRAWN` decision must
  stop a given piece of processing is that side's call.
- any downstream business logic that reads the database and derives insights
- **the customer-facing product built on the audit trail.** `GET /api/v1/audit`
  returns a JSON timeline. Exporting it, alerting on it, and building anything an
  end customer sees are that side's work. We ship an **operator** dashboard,
  which renders that timeline and the analytics counts for our own use and is a
  consumer of the same public endpoints — it is not a privileged view, not a
  consent UI, and not the analytics product. Refused attempts are still not
  recorded at all, so detecting a fiduciary repeatedly probing withdrawn consent
  is not something the current trail supports, in either side's UI.
- **what a withdrawal means for data already delivered.** We stop future
  authorisations and preserve the past exactly as it was. Whether a recipient
  must now delete or stop processing what it already holds is a compliance
  question and a recipient obligation, not something this layer can express by
  editing history.
- **scoping every read by tenant.** Because that side queries the database
  directly rather than through our API, our authorisation layer is not in the
  path. The ownership model those queries must respect is in [tenancy.md](tenancy.md).
- **the target fiduciary's key management.** This is the load-bearing one for
  secure routing. That side generates the X25519 key pair, registers only the
  public half with us, and keeps the private half in infrastructure we have no
  access to. We never receive, request, or store a private key, and there is no
  API shape that would accept one — which also means we cannot help if one is
  lost, and cannot rotate one on that side's behalf. Our inability to decrypt is
  worth exactly as much as their custody of that key.
- **the source fiduciary's plaintext.** It is created and sealed in that side's
  own process, before any call to us. What we can prove ends at our boundary: if
  a source sends the payload somewhere else in the clear as well, nothing here
  detects it.

## Shared artifact: event schema

The single shared contract is the event schema defined in [event-schema.md](event-schema.md). This is the canonical artifact that both teams must agree on before changing anything. It includes:

- top-level fields: `event_id`, `site_id`, `session_id`, `event_type`, `name`, `event_time`, `schema_version`, `source`, `payload`
- automatic events: `page_view` and `session_start`
- custom events: `track(name, properties)`
- `payload.page`, `payload.device`, `payload.referrer`, and optional `payload.properties`
- no `public_key` field inside the event payload; the public key lives in the HTTP `Authorization` header
- field bounds and request bounds, defined once as `EVENT_LIMITS` in [`../shared/event.ts`](../shared/event.ts) and enforced by the API

The SDK and API must implement the same schema without drift. The analytics side must read the database using the same semantics.

The SDK's own public surface — what a customer's developer may call, and what is internal and may change — is documented separately in [sdk-api.md](sdk-api.md).

## Shared artifact: the scan contract

The third shared artifact is the scan contract in
[`../shared/scan.ts`](../shared/scan.ts), documented in
[crawler.md](crawler.md) and [scan-api.md](scan-api.md).

**Scanner observations are evidence about what was observed during a scan. They
are not legal determinations.** A `ScanTechnology` says "we believe this is
Google Analytics, at this confidence, because of this evidence". Whether that
obliges a site to do anything is a question for the compliance layer, reading
this alongside the requirement matrix in [regulations/](regulations/).

Nothing in the scan schema, the scan API or the seven `scan_*` tables carries a
`requires_consent`, `lawful` or `legal_basis` field, and there is deliberately
nowhere to put one. That absence is the interface between the two halves of the
product, and a test asserts it rather than leaving it to review.

What that side can rely on:

- every accepted scan belongs to exactly one site and one organisation
- a `completed` scan has all of its observations, written in one transaction
- `summary.limit_reached` names the limit when a crawl stopped early, so counts
  can be read as the floor they are
- every technology finding carries `evidence` and a `confidence`, so a UI can
  answer "why was this detected?" and a customer can correct it
- cookie and storage **values**, headers, bodies and query strings are never
  present, because they are never collected

What it must not rely on: the crawler's internal modules, the detector
signature list, `scan_requests` being one row per request (it is aggregated),
or the worker being a single in-process loop.

The scanner **complements** in-page discovery rather than replacing it. Neither
subsumes the other, and [crawler.md](crawler.md) sets out the opposite blind
spots that keep both.

## Shared artifact: consent vocabulary

The second shared contract is the consent vocabulary defined in
[consent.md](consent.md) and typed in [`../shared/consent.ts`](../shared/consent.ts).
This is what the compliance engine will be built on, so it must not drift:

- the seven models and their scoping: **organisation = data fiduciary** owns
  purposes, policies, policy versions and notices; **site** owns principals and
  consent records
- `ConsentStatus` is `GRANTED | DENIED | WITHDRAWN`. Only `GRANTED` means
  processing is permitted, and **absence of a decision is not permission**.
  `WITHDRAWN` and `DENIED` are distinct on purpose and must stay distinguishable.
- `resolveEffectiveConsent()` is the single definition of "effective consent":
  newest record per `(principal, purpose)`, ordered by `decided_at`, then
  `recorded_at`, then id. The API and the SDK both call this exact function.
  Anything reading the database directly must reproduce the same derivation.
- current state is **derived, never stored**. There is no "is granted" column, and
  a consumer must not add one.
- `consent_records` is append-only. A `UPDATE` is refused by a database trigger,
  and since Phase 6A a `DELETE` is too unless the transaction has explicitly
  opted in via `rift.offboarding` — see [security.md](security.md).
- `transfer_authorisations` and `transfer_records` are now guarded the same way:
  identity columns frozen, `status` restricted to a forward state machine. A
  consumer that mutated them to "correct" history will start getting
  `restrict_violation`.
- **recording a decision needs a consent session**, not just the site public key.
  This is a breaking change to `POST /api/v1/consent`, made because a key in page
  source cannot be evidence that a person decided anything. A consumer building a
  banner calls `POST /api/v1/consent/session` first, or uses the SDK, which does
  it transparently.
- these models encode structure and **no legal rules**

The consent domain is kept separate from the analytics domain: nothing in the
consent schema references `Session` or `Event`, and no consent flag is written
onto analytics rows. The link, when needed, is through `Principal`. Neither side
should denormalise one into the other.

## Shared artifact: secure transfer trust model

The third shared contract is the trust model in
[secure-transfer.md](secure-transfer.md), typed in
[`../shared/transfer.ts`](../shared/transfer.ts) and
[`../secure-transfer/envelope.ts`](../secure-transfer/envelope.ts).

Read that document before building anything against this surface. It is explicit
about what the prototype does **not** claim, and this section does not repeat
those limits — it states what both sides must hold to:

- **The property.** Rift can authorise and record a personal-data transfer
  without being able to read the plaintext. Everything below serves that one
  sentence.
- **The construction.** X25519 ECDH with an ephemeral sender key → HKDF-SHA256 →
  AES-256-GCM, all from Node's built-in `node:crypto`. No new dependency and no
  novel cryptography. The identifier `X25519-HKDF-SHA256-AES256GCM` is stored per
  recipient, so a future change of scheme does not require guessing how existing
  envelopes were sealed. Changing the construction means a new algorithm
  identifier, not a redefinition of this one.
- **Who holds what.** The source creates and seals the plaintext. The target
  holds the only X25519 private key. Rift holds ciphertext, routing metadata and
  public keys — nothing that can open an envelope.
- **The binding.** An envelope is bound by AES-GCM's additional authenticated
  data to `{authorisationId, nonce, purposeCode, recipientCode,
  principalExternalId}`. Both sides derive the AAD independently from metadata
  they already have, so field order and serialisation are part of the contract:
  `buildTransferAad` in `secure-transfer/envelope.ts` is the single definition,
  and anything reimplementing it must produce byte-identical input. Tampering,
  replay under another authorisation, redirection to another recipient, and Rift
  re-labelling metadata all break decryption rather than silently succeeding.
- **Replay prevention is three independent mechanisms**, plus the nonce inside
  the AAD: an authorisation is single-use (`AUTHORISED` → `CONSUMED`), a `UNIQUE`
  constraint on `transfer_records.authorisation_id` refuses a second transfer
  even under a race, and `expires_at` bounds the window. None of the three may be
  removed on the grounds that the other two exist.
- **Consent is the gate, and it is the same gate.** Authorisation calls Phase 2's
  `getEffectiveConsent`, so a transfer is refused when consent is `DENIED`,
  `WITHDRAWN`, or absent — absence of a decision is not permission here either.
  The authorisation then references the exact `consent_records` id relied upon.
  A consumer must not substitute its own notion of "consent was granted".
- **This is a proof of concept.** It has had no cryptographic review, no
  key-rotation story, and no formal threat model. Neither side should describe it
  as production-secure, and a real deployment needs a review this prototype has
  not had.

## API contract

The ingestion API contract is defined in [api-spec.md](api-spec.md). The current live surface is:

- `POST /api/v1/events` accepts one event or `{ "events": [...] }`, authenticated
  by a **site public key** (`pk_...`)
- `POST /api/v1/consent/session` opens a consent session, authenticated by a
  **site public key** (`pk_...`), and is what binds a decision to a browser that
  controls the principal it is deciding for
- `POST /api/v1/consent` appends one consent decision — site public key **plus**
  a consent session in `X-Rift-Consent-Session` — and `GET /api/v1/consent`
  returns the effective state of **one** principal with the public key alone
- `POST /api/v1/discovery` accepts in-page observations, authenticated by a
  **site public key** and deliberately never consent-gated: a gate would drop the
  evidence that something fired without consent
- `GET /api/v1/organisation`, `GET|POST /api/v1/sites`, `GET|PATCH /api/v1/sites/{siteId}`
  are the management surface, authenticated by an **organisation secret key** (`sk_...`)
- `GET /api/v1/consent/history` (the audit trail), `GET|POST /api/v1/purposes`,
  `GET|POST /api/v1/policies`, `POST /api/v1/policies/{policyId}/versions` and
  `GET|POST /api/v1/notices` are also management, for the same reason: a public
  key is visible in page source and must not be able to enumerate principals,
  read history, or invent reference data
- `GET|POST /api/v1/recipients`, `GET|POST /api/v1/authorisations`,
  `POST /api/v1/authorisations/decision`, `GET|POST /api/v1/transfers` and
  `GET /api/v1/audit` are management too, authenticated by the
  **organisation secret key** (`sk_...`): registering a target fiduciary, asking
  whether an action is permitted, authorising one transfer, submitting the sealed
  envelope, and reading the organisation's own transfer metadata and lifecycle
  timeline
- **`POST /api/v1/transfers/authorisations` moved to `POST /api/v1/authorisations`
  in Phase 4.** The old path is gone, with no alias — a breaking change, recorded
  in the change log below. Authorisation is its own concern, not a sub-resource of
  transfers
- `POST /api/v1/authorisations/decision` answers the same question with **no side
  effect**, and a refusal is a `200` with `permitted: false` rather than an HTTP
  error: "consent was withdrawn" is a successful answer to a well-formed question
- `GET /api/v1/transfers/{transferId}/envelope` is the **delivery plane**,
  authenticated by a **recipient delivery key** (`rk_...`). It is the only
  endpoint on that plane: it collects sealed envelopes addressed to one recipient
  and confers no ability to read them
- `GET /api/v1/consent/effective` returns the decisions currently in force for
  **one** principal on **one** site, on the management plane. It answers the same
  question as the browser-plane `GET /api/v1/consent`, through the same
  `resolveEffectiveConsent`, for a caller that holds an `sk_` rather than a
  `pk_`. Re-deriving the answer from the *paginated* `GET /api/v1/consent/history`
  is silently wrong past the limit, so consumers should call this instead
- `GET /api/v1/analytics/summary` and `GET /api/v1/analytics/overview` are
  management too: aggregate counts over the caller's own sites, filtered by
  `site_id`, `from` and `to`, defaulting to the last 30 days
- `GET /api/v1/transfers` gained a `limit` (integer 1–500, default 200) in
  Phase 5; it was the last list endpoint with no caller-settable bound
- `GET /api/healthz` is the unauthenticated health check endpoint
- the three credentials are never interchangeable; using one on another plane is
  `401`, decided on the key prefix before any database lookup
- invalid keys return `401`, inactive sites `403`, another tenant's site `404`
- an event whose `site_id` is not the authenticated site is rejected as `site_mismatch`
- CORS is enabled for ingestion; the management and delivery planes intentionally
  send none
- There is still no analytics **query** API. `/api/v1/analytics/*` is a fixed set
  of counts; it takes no metric, dimension or grouping from the caller

## Shared artifact: the analytics read contract

The fourth shared contract, added in Phase 5, is the analytics read model typed
in [`../shared/analytics.ts`](../shared/analytics.ts) and served by
`GET /api/v1/analytics/summary` and `GET /api/v1/analytics/overview`.

It exists so the other side has an alternative to reading the database for
aggregate activity — one that goes through our authorisation layer instead of
around it. What both sides must hold to:

- **It is a fixed set of metrics, not a query API.** Totals, ten top pages, three
  categorical breakdowns, per-site rows, and the operational counts across
  consent, authorisations and transfers. Adding a metric is a change to this
  contract; adding a query language is not on the table.
- **It returns aggregates only.** No individual event, no page URL tied to a
  person, no consent record, no envelope, no key material. Every query resolves
  the caller's own site ids first and filters on that list, so a tenant can only
  ever aggregate over its own data.
- **It reports sessions, not unique visitors, and must not be relabelled.** There
  is no persistent visitor identifier in the analytics domain: a session id lives
  in `sessionStorage` and expires after 30 minutes of inactivity. The one durable
  per-person identifier is `Principal`, which belongs to the consent domain and
  is **deliberately never joined to analytics rows**. A consumer that presents
  `sessions` as a user count is overstating what the data supports, and a
  consumer that fixes the gap by joining the two domains has broken the
  separation both sides agreed to in [consent.md](consent.md).
- **`overview` filters only its `activity` block.** `site_id`, `from` and `to`
  narrow the SDK activity counts; the sites, consent, authorisation and transfer
  counts are whole-organisation and all-time. Read them accordingly.
- **The window is `[from, to)`**, defaulting to the last 30 days, and the
  resolved range is always echoed in the response.

## Read API status

The analytics read API above is the first read surface added under this rule, and
it was reviewed as part of this contract before implementation. Any further read
endpoint must be reviewed the same way, and must scope every query to the
authenticated tenant.

## Database access model

For the MVP, the analytics/dashboard side still reads the database directly for
its own reporting. That remains supported, and that side remains responsible for
scoping its own queries per [tenancy.md](tenancy.md), because our authorisation
layer is not in the path.

`/api/v1/analytics/*` is a **shared artifact the other team can consume instead**
for aggregate activity: it is tenant-scoped by the credential, it cannot drift
from the schema, and it does not require the consumer to reproduce a derivation
correctly. It does not replace direct access — it is deliberately narrow, and
anything it does not express still needs the database.

Our own operator dashboard is the proof that the boundary holds: it renders every
screen from these endpoints and imports `database` nowhere.

## Tenancy guarantees

These are part of the contract and must not regress:

- A credential authenticated for Site A cannot read, create, modify or impersonate
  data belonging to Site B - including a sibling site in the same organisation.
- The tenant is derived from the credential alone. `site_id` in a request body and
  `siteId` in a URL are validated against it, never used to select it.
- Ownership (`organisation_id`) and key material (`public_key`) are server-assigned
  and are not mutable over the API.
- The database enforces the same rules independently, so a bug in the API layer
  cannot by itself produce cross-tenant rows.
- The same guarantees extend to consent. Composite foreign keys tie every consent
  reference into one tenant, so a decision can never cite another organisation's
  purpose, notice or policy version, and the same `external_id` on two sites is
  two separate principals.
- A recorded consent decision is never rewritten. This is enforced by a database
  trigger, not by convention, and must not be relaxed.
- A recipient delivery key collects envelopes for exactly one recipient. It
  cannot reach another recipient's envelopes, cannot read any organisation's
  transfer metadata, and is rejected on the ingestion and management planes.
- One organisation's transfers are invisible to another, and a transfer
  authorisation cannot be minted against another tenant's site, principal,
  purpose, recipient or consent record. The composite foreign keys on
  `transfer_authorisations` make such a row unrepresentable in PostgreSQL.

These properties are covered by automated tests; see `api/tests/`.

## Secure routing guarantees

These are part of the contract and **must not regress**. They are the reason the
prototype exists, so a change that quietly relaxes one is a change to the
contract, not an implementation detail:

- **Rift cannot decrypt what it relays.** It holds ciphertext, digests, sizes,
  routing metadata and public keys. It holds no plaintext, no private key, and no
  derived symmetric key. `api/tests/transfer-boundary.test.ts` dumps every row of
  every table after a completed transfer, asserts the payload appears nowhere in
  it, and then tries every string Rift stores as a decryption key and asserts
  that none of them works.
- **Rift has no code path to decryption.** `api/` and `database/transfers.ts`
  import only `secure-transfer/envelope.ts`. A test walks the source tree for
  real import statements of `secure-transfer/fiduciary` and fails if one appears.
  Adding a schema column for plaintext or key material, or importing the
  fiduciary module into `api/` or `database/`, breaks this guarantee — the test
  failure is the point, not an obstacle to work around.
- **No endpoint accepts a plaintext payload or a private key.** The authorisation
  and submission schemas are `.strict()`, so an attached `plaintext` field is a
  `400` rather than something quietly stored.
- **Authorisation and payload stay separate requests.** The decision is made
  before any ciphertext exists, so the ciphertext can never influence it.
- **The consent gate is not bypassable.** Every authorisation goes through
  `getEffectiveConsent`; there is no path that mints one without it.

The prototype's limits are set out honestly in
[secure-transfer.md](secure-transfer.md) and neither side should overstate them.
In particular: metadata is not private (Rift learns who sent what, to whom, for
which purpose, when, and how large it was), Rift is trusted for availability and
is not defended against as a malicious operator who changes the code, and none of
this has been reviewed by a cryptographer.

## Lifecycle guarantees

Phase 4 joined the consent and routing domains into one flow. These properties
are part of the contract and **must not regress**. They are covered by
`api/tests/lifecycle.test.ts`, whose scenarios A–G walk the flow end to end
through the HTTP surface rather than the service functions underneath it. The
full reasoning is in [lifecycle.md](lifecycle.md).

- **Asking is not committing.** `evaluateAuthorisation` is side-effect free: it
  creates no rows, mints no nonce and contains no cryptography. A test asserts
  that a permitted decision leaves the authorisation count at zero. Anything that
  makes the evaluation write becomes a change to this contract.
- **There is one gate and one definition of current consent.** The evaluation
  calls `getEffectiveConsent`; `authoriseTransfer` calls the evaluation. There is
  no second implementation of "is consent granted", and no path that mints an
  authorisation without going through it.
- **The domains stay decoupled.** The orchestration layer is the only place
  consent and transfers meet, and the audit trail is a read model — consent has
  no foreign key to transfers, and adding one to tidy a query is a contract
  change, not an optimisation.
- **Refusals stay distinguishable.** Six reasons, not one generic failure.
  Collapsing `no_consent_decision`, `consent_denied` and `consent_withdrawn` into
  a single code would destroy information no later query can recover.
- **Existence non-disclosure holds across the seam.** Another tenant's site,
  principal or purpose is reported exactly like one that does not exist —
  including through the decision endpoint's body, where a cross-tenant request
  reports `site_not_found` rather than leaking that the site exists. Consent does
  not travel between sites, including sibling sites of one organisation.
- **Every step names the decision it relied upon.** An authorisation stores the
  exact `consent_records` id, a transfer inherits it, and every audit entry
  carries it. None of them stores a copied boolean.
- **History is never mutated.** A withdrawal appends a new consent record and
  stops *future* authorisations. It does not rewrite past transfers, which still
  cite the consent that was in force when they happened, and that record still
  reads `GRANTED`. A test asserts exactly this.
- **A refusal creates nothing.** No authorisation row and no transfer row exist
  after a refused request, in any scenario.
- **Single-use stays single-use, under a race.** Two simultaneous submissions of
  one authorisation resolve to exactly one `201` and one `409`, one transfer row,
  and an authorisation left `CONSUMED` — never two transfers, and never a
  consumed authorisation with nothing recorded against it.
- **A failed transfer does not burn its permission.** A rejected envelope leaves
  the authorisation `AUTHORISED` and the retry succeeds.
- **Two requests are two permissions.** Authorisation requests are not
  deduplicated; each is independently single-use, with its own nonce.
- **No payload rides along with a permission request.** The authorisation and
  decision schemas are `.strict()`, so an attached `plaintext` is a `400`.
- **The audit trail carries metadata, never contents.** A test asserts the
  plaintext appears nowhere in it.
- **The SDK is unchanged, and must stay that way.** It speaks only consent and
  events, authenticated by a site public key. Authorisation, transfer and audit
  are server-to-server, authenticated by the organisation secret, which must
  never reach a browser. Shipping any of the three into the SDK would hand every
  visitor the ability to authorise transfers of other people's data and to read
  the whole organisation's audit trail.

## Boundary map

Every seam in the platform, and what may cross it. A component may depend on the
**stable fields** of the boundary to its left and nothing else; the forbidden
column is not advice.

### SDK → API

| | |
| --- | --- |
| Input | `AnalyticsEvent` batches, `Authorization: Bearer pk_…`, optional `X-Rift-Consent-Session` |
| Output | `IngestResponse` — `accepted`, `rejected`, `errors[]` |
| Stable | The envelope in [event-schema.md](event-schema.md), `EVENT_LIMITS`, `error.code` |
| Owner | Both. Changing either half alone breaks the contract. |
| Forbidden | The SDK depending on how events are stored; the API depending on SDK internals |
| Errors | `error.code` is stable; `message` is for humans and may be reworded |
| Versioning | `schema_version` on the envelope. Adding optional fields is non-breaking; raising a limit is non-breaking; lowering one is breaking |

### Crawler → Scan API → Onboarding

| | |
| --- | --- |
| Input | `start_url` plus an organisation secret; the crawler takes a queued `scans` row |
| Output | `ScanResultsResponse` — observations with evidence and confidence |
| Stable | [`../shared/scan.ts`](../shared/scan.ts), the `scan_*` tables, the endpoints in [scan-api.md](scan-api.md) |
| Owner | Our side |
| Forbidden | Depending on crawler internals, on `scan_requests` being one row per request (it is aggregated), or on the worker being an in-process loop |
| Errors | Scan-level failure sets `status: failed` with `error.code`; page-level failure is a `pages[]` row with `error` and the scan still completes |
| Versioning | `crawler_version` is stamped on every scan; `mode` records the consent state it ran under |

### Scanner → Consent configuration

**The load-bearing boundary of this phase.** The scanner observes; the consent
layer interprets.

| | |
| --- | --- |
| Input | `ScanTechnology` — name, category, confidence, evidence, destination country |
| Output | Nothing automatic. An operator maps a finding to a `Purpose` they have declared |
| Stable | The finding shape, and the guarantee that no finding carries a legal conclusion |
| Owner | Scanner: our side. The mapping decision: the operator, surfaced by the other side |
| Forbidden | **The scanner asserting that anything requires consent**, and any automatic technology → purpose mapping |
| Errors | An unrecognised technology is a `low`-confidence `unclassified` finding, never a safe one |

There is deliberately **no automatic mapping** from a detected technology to a
consent purpose, and this is a finding rather than an omission. `Purpose` is
operator-declared free text scoped to an organisation (`purposes.code`), so the
platform has no way to know that a site's `analytics` purpose is the one that
covers Google Analytics — only the operator does. `docs/discovery.md` already
reached the same conclusion for in-page discovery: *"The mapping from host to
purpose belongs to the operator, not the SDK: only the fiduciary knows which of
its vendors serve which declared purpose."*

Inventing the mapping would produce a confident, unauditable and frequently
wrong answer. The scanner therefore presents findings and their evidence, and
the mapping stays an explicit human step.

### Consent → SDK

| | |
| --- | --- |
| Input | `analytics.setConsentCheck((purpose) => boolean)`, wired by the integrator |
| Output | Events created or refused before they are queued |
| Stable | `analytics.consent` in [sdk-api.md](sdk-api.md); the effective-consent shape in [`../shared/consent.ts`](../shared/consent.ts) |
| Owner | SDK client: our side. Whether analytics *needs* consent: the other side |
| Forbidden | The SDK hard-coding that any purpose is required; consent state living in the scanner |
| Errors | The gate is a client-side convenience. Server-side enforcement is `analytics_consent_purpose` on the site, re-derived from the append-only log on every batch |

### API → Database

| | |
| --- | --- |
| Input | Validated events, scans, consent decisions, all tenant-scoped by credential |
| Output | Rows |
| Stable | The tables in [database-schema.md](database-schema.md) |
| Owner | Our side |
| Forbidden | Depending on `skipDuplicates`, the session upsert, or the write transaction shape |

### Events → Analytics

| | |
| --- | --- |
| Input | `events` and `sessions` rows written by ingestion |
| Output | `GET /api/v1/analytics/*` aggregates |
| Stable | [`../shared/analytics.ts`](../shared/analytics.ts) |
| Owner | Our side |
| Forbidden | Joining `Principal` to analytics rows; reporting unique visitors — the platform counts **sessions**, and there is no persistent visitor identifier to count |

### Regulation data → Policy engine → (not yet) enforcement

| | |
| --- | --- |
| Input | `docs/regulations/generated/requirements.ts`, a `PolicyContext` with a required `asOf` |
| Output | A `Decision` with obligations, open questions and a citation on every part |
| Stable | The `policy/` public surface, and the matrix schema |
| Owner | Evaluator: our side. Acting on a decision: a product call not yet made |
| Forbidden | **Wiring the evaluator into live enforcement without a product decision.** See below |

The policy engine is deliberately **not wired into any route**, and Phase 9 did
not wire it in. Its own documentation states why: the platform's live gate is a
fact about a recorded decision, the engine is a statement about what a regime
requires, and joining them would mean refusing live traffic on the strength of a
research artifact whose coverage document lists `consent` as populated on 34 of
102 records. That is a product decision with a blast radius, and integration
work is not the place to make it.

## Two discovery mechanisms, and how they are reconciled

The platform observes site behaviour twice, and the two are **not merged**:

| | In-page discovery | Scanner |
| --- | --- | --- |
| Sees | What a real visitor's browser did | What a robot saw, logged out, once |
| Needs the tag installed | Yes | No |
| Works during onboarding | No | **Yes** |
| Can evidence a consent violation | **Yes** | No |
| Tables | `discovered_*` | `scan_*` |
| Dashboard | Discovery | Scans |

Both classify hosts through the **same** `database/tracker-catalogue.ts`, so a
vendor is named identically by both. What differs is the claim each makes:
discovery says *this fired in production*, the scanner says *this was present
during a scan*. Reconciling them into one row would destroy that distinction,
which is the thing that makes a discovery violation evidentiary.

When both report the same vendor, they are two independent observations of the
same fact, and the UI shows them in their own sections rather than deduplicating
across the boundary.

## Compatibility rules

- Schema changes must be reviewed by both teams before implementation.
- Breaking changes require a version bump in `schema_version` and coordinated rollout.
- New optional fields must not silently break compatibility.
- Changes to the API and schema must be reflected in the shared documentation before they are shipped.
- Batch payload behavior is part of the live contract: the SDK sends `{ "events": [...] }` in a single request, and the API treats duplicates within the same batch idempotently via `event_id`.
- Input bounds are part of the contract. `EVENT_LIMITS` in [`../shared/event.ts`](../shared/event.ts) is the single definition; raising a limit is non-breaking, lowering one is breaking and needs the same coordination as any other breaking change.

### What the other side must not depend on

Depend on the documented contracts — the event envelope, the HTTP surface in [api-spec.md](api-spec.md), the database tables in [database-schema.md](database-schema.md), and the read contract in [`../shared/analytics.ts`](../shared/analytics.ts). Not on:

- **SDK internals.** Class names (`AnalyticsClient`, `ConsentClient`), file layout under `sdk/src/`, the event queue, its `localStorage` keys, the 2 s flush interval, the batch size of 10, the retry schedule, or the bundler's internal IIFE global name (`__riftCmpBundle`). All of these are free to change; only the surface in [sdk-api.md](sdk-api.md) is stable, and on that surface the browser entry point is `window.analytics`.
- **API internals.** Helper modules under `api/lib/`, route file structure, or Zod schema objects. The stable surface is the HTTP contract.
- **How the API stores what it accepts.** Column names are contract via [database-schema.md](database-schema.md); the mechanism is not — `skipDuplicates`, the session upsert, and the write transaction may all change.
- **Rejection message strings.** `error.code` is stable and typed in [`../shared/api.ts`](../shared/api.ts); `message` is for humans and may be reworded at any time.

## Cross-origin requirement

Because the SDK runs on arbitrary customer domains, the API must support browser-based cross-origin requests. This means handling `OPTIONS` preflight requests and returning the proper CORS headers, including `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`. Same-origin traffic does not need the same treatment, but cross-origin traffic does.

## Change log

| Date | Change | Version | Approved by |
| --- | --- | --- | --- |
| 2026-08-30 | Initial contract for SDK/API/database split, shared event schema, bearer auth, and batch ingestion | v1 | — |
| 2026-08-31 | Added organisation tenancy, public/secret key separation, the site management plane, and tenant-isolation guarantees. Event envelope unchanged; `site_id` is now validated against the authenticating key. | v1 | — |
| 2026-08-31 | Phase 2: added the consent domain — principals, purposes, policies, policy versions, notices and an append-only consent record — plus `POST\|GET /api/v1/consent` on the browser plane and `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices` on the management plane, and a headless `analytics.consent` SDK client. The consent vocabulary in [consent.md](consent.md) becomes a shared artifact: it encodes structure and no legal rules, and is the base the compliance engine is expected to be built on. Event envelope and analytics tables unchanged; the two domains are not joined. | v1 | — |
| 2026-09-01 | Phase 3: added secure data routing as a **proof of concept** — `data_recipients`, `transfer_authorisations` and `transfer_records`, plus `GET\|POST /api/v1/recipients`, `POST /api/v1/transfers/authorisations` and `GET\|POST /api/v1/transfers` on the management plane, and a third credential plane (`rk_` recipient delivery key) whose only endpoint is `GET /api/v1/transfers/{transferId}/envelope`. The trust model in [secure-transfer.md](secure-transfer.md) becomes a shared artifact. Rift stores ciphertext and routing metadata and cannot decrypt either; the target fiduciary's X25519 private key is that side's responsibility and never reaches us. Event envelope, analytics tables and the consent schema are unchanged — routing reads consent through `getEffectiveConsent` and references the consent record it relied on, rather than copying a flag. Not cryptographically reviewed; not to be described as production-secure. | v1 | — |
| 2026-09-01 | Phase 4: connected the consent and secure-routing domains into one product flow. Added an orchestration layer (`database/authorisation.ts`) that answers "is this action currently authorised for this Data Principal, Fiduciary and purpose?" — side-effect free, no cryptography, and the only place the two domains meet — plus a unified audit read model (`database/audit.ts`) that interleaves consent decisions, authorisations and transfers into one timeline without joining them in the database. New endpoints on the management plane: `GET\|POST /api/v1/authorisations`, `POST /api/v1/authorisations/decision` (evaluate only; a refusal is `200` with `permitted: false`, not an HTTP error) and `GET /api/v1/audit`. **BREAKING: `POST /api/v1/transfers/authorisations` moved to `POST /api/v1/authorisations`, in place and with no alias** — authorisation is its own concern, not a sub-resource of transfers. The lifecycle guarantees above become part of the contract. No schema change, no new table, and no SDK change: authorisation, transfer and audit are server-to-server with the organisation secret and must never reach a browser. The secure routing half is still an unreviewed proof of concept. | v1 | — |
| 2026-09-01 | Phase 5: added an **analytics read API** and an operator dashboard. New on the management plane: `GET /api/v1/analytics/summary` and `GET /api/v1/analytics/overview` (aggregate counts, filters `site_id`, `from`, `to`, default window 30 days) and `GET /api/v1/consent/effective` (effective consent for one principal on one site, for a caller holding `sk_` rather than `pk_` — history is paginated, so re-deriving the answer from it is silently wrong past the limit). `GET /api/v1/transfers` gained a `limit` of 1–500; it was the last unbounded list endpoint. The analytics read contract in [`../shared/analytics.ts`](../shared/analytics.ts) becomes a **shared artifact the other side can consume in place of reading the database directly** for aggregate activity — tenant-scoped by the credential, aggregates only, and reporting **sessions, not unique visitors**: there is no persistent visitor identifier in the analytics domain, and `Principal` is deliberately never joined to analytics rows. The dashboard is an internal operator tool and a pure API consumer — no page imports `database` — signing in with the organisation secret held in an httpOnly cookie, which is an MVP compromise standing in for user accounts and roles. **No schema change and no migration**; analytics reads existing tables. No SDK change. The secure routing half is still an unreviewed proof of concept. | v1 | — |
| 2026-09-03 | Phase 7A: contract hardening, no new endpoints and no schema change. Added [sdk-api.md](sdk-api.md), the SDK's public interface — `init`, `track`, `setConsentCheck`, `consent`, `discovery` — stated as a stable surface, alongside an explicit list of SDK and API internals the other side must not depend on. Bounded the ingestion input: `EVENT_LIMITS` in [`../shared/event.ts`](../shared/event.ts) caps every envelope field, the property object by key count and serialised size, a batch at 100 events and a request body at 1 MiB, adding the error code `payload_too_large` (`413`). Ingestion was the one write endpoint with no input bounds, and it is the one authenticated with a key that ships in page source. Raising a limit is non-breaking; lowering one is breaking. Event envelope, tables and every other endpoint unchanged. | v1 | — |
| 2026-09-03 | Phase 7A (SDK fixes): repaired the browser global and added SDK-side pre-validation. The IIFE build claimed the global name `analytics` while `sdk/src/index.ts` also assigned `window.analytics`; under classic `<script>` semantics the bundler's `var` won, leaving `window.analytics` as the module namespace and `analytics.init` undefined — so the install snippet the dashboard generates did not work. The build global is now internal (`__riftCmpBundle`) and `window.analytics` is the callable SDK, which is what every document already claimed. `sdk/scripts/verify-global.mjs` loads the real bundle under `vm.Script` and gates `npm -w sdk run build` so the collision cannot return. Separately, `analytics.track()` now checks its input against `EVENT_LIMITS` before queueing and refuses over-limit or unserialisable input with a synchronous `false` and one `console.warn`, matching the shape the consent gate already returned; it never truncates, holds no numbers of its own, and does not weaken the API check, which remains authoritative. No endpoint, envelope, table, credential or consent behaviour changed. | v1 | — |
| 2026-09-03 | Phase 8A: added a **website scanner**. A Playwright crawler (`crawler/`) visits a customer's site during onboarding and reports pages, cookies, scripts, network destinations, browser storage and the technologies behind them, with evidence and a confidence for every finding. New on the management plane: `POST|GET /api/v1/sites/{siteId}/scans`, `GET|DELETE /api/v1/scans/{scanId}` and `GET /api/v1/scans/{scanId}/results`, all requiring the organisation secret — a site public key ships in page source, and one that could start crawls would be a request-forgery primitive anyone could aim. Seven new tables (`scans` and six `scan_*` children), added **alongside** the in-page discovery domain rather than replacing it: a crawler works before signup, which onboarding needs, and structurally cannot evidence that a tracker fired while consent was withdrawn, which discovery exists to do. Host classification reuses `database/tracker-catalogue.ts` rather than forking a second catalogue. The scan contract in [`../shared/scan.ts`](../shared/scan.ts) becomes a shared artifact, and carries **no legal determination**: no schema, table or response has a `requires_consent` field, and a test asserts that. Known limitation carried forward: DNS-rebinding protection is narrowed but not closed, because the network half of that defence — egress policy or an address-pinning proxy — does not exist in this repository. | v1 | — |
| 2026-09-04 | Phase 7A (policy engine): added `policy/`, a workspace package that answers *given this processing activity and this context, what requirements apply?* over the Phase 6B/6C requirement matrix. **Nothing here is an interface change**: no endpoint, no table, no migration, no credential, no SDK change, no dependency, and no route, page or database module imports it. It is recorded in this log because it moves an ownership boundary — [architecture.md](architecture.md) previously assigned "the compliance engine" wholly to the other side, and this repo now carries the **evaluator** for regulatory requirements while still carrying none of the enforcement. The engine is deterministic (`asOf` is a required input, never the clock), resolves conflicting requirements conservatively, cites the requirement and source behind every part of an answer, and never returns `ALLOW` from absence of evidence. Two limits are structural rather than provisional and are stated in [policy-engine.md](policy-engine.md): jurisdiction is region-level, so no Member-State question can be asked; and applicability triggers are free text in the research (102 distinct values across 102 records), so they are cited and never matched — making them matchable is a matrix change, not an engine change. The consent gate the platform actually enforces is unchanged and still reads "the decision in force must be `GRANTED`". | v1 | — |
| 2026-09-04 | Phase 7B (jurisdiction resolution): added a resolver to `policy/` that answers *whose law is in play* from dated location observations, and carries the answer into the Phase 7A evaluator through `resolveContext`. **Not an interface change**: no endpoint, table, migration, credential, SDK change or dependency, and nothing imports it. Recorded here because it fixes the shape of an input the other side will eventually supply. Three properties are contractual rather than incidental. **Jurisdictions accumulate** - there is no ranking, no winner and no tie-break, because a visitor can be reached by several regimes at once; two signals naming different regions are two reasons the law might attach, not a conflict to resolve. **Confidence never removes a jurisdiction** - a weakly evidenced jurisdiction is reported as weak and kept, since dropping it is the under-inclusive failure that looks like success. **The resolver refuses an IP address** - `VisitorContext` has no field for one and a signal resembling an address is rejected with a reason rather than ignored; geolocation happens on the caller's side and only a derived ISO 3166 region code crosses the boundary, so no new personal data is collected to sharpen detection. The region-to-jurisdiction mapping is versioned configuration (`DEFAULT_JURISDICTION_RULES.version`, stamped on every resolution) and a caller may supply its own; `GB` is recognised and deliberately mapped to nothing, because UK GDPR is a separate instrument the matrix does not carry. Coverage is the EU-27 plus `IS`/`LI`/`NO`, India, Brazil, and `US-CA` which also carries the generic US state model. An unresolved location produces an empty jurisdiction list, which the evaluator already turns into `REVIEW` - "we do not know where they are" cannot become "nothing is required" at the seam. | v1 | — |
| 2026-09-04 | Phase 9: integration. No new capability. The scanner reached the dashboard — `/dashboard/scans` renders scan history and, for a completed scan, its technologies with evidence and confidence, cookies, third-party destinations, scripts, pages and storage keys, consuming the existing scan API through the same `apiGet` path every other dashboard page uses. A scan that is `queued`, `running` or `failed` renders its state rather than an empty inventory, because an unfinished scan and a site with no trackers produce identical counts and mean opposite things. This contract gained a **boundary map** naming the input, output, stable fields, owner, forbidden dependencies and error semantics for each of the seven seams. Two findings are recorded rather than fixed: there is **no safe automatic mapping from a detected technology to a consent purpose**, because `purposes.code` is operator-declared free text and only the operator knows which vendor serves which declared purpose — so the mapping stays an explicit human step, matching the conclusion `discovery.md` already reached for in-page discovery; and the **policy engine remains unwired** from live enforcement, which is a product decision its own documentation defers to a phase convened to make it. No endpoint, table, migration, credential, envelope or SDK change. | v1 | — |
| 2026-09-04 | Phase 9 (onboarding UI): made the dashboard writable. It had been entirely read-only — the only server action in it was sign-out — so every write an operator needed was a hand-assembled `curl`, and the platform worked while nobody could reach it. Added `/dashboard/sites` (register a website, start a scan) and `/dashboard/configure` (declare purposes, review them against what the scanner found), plus `apiSend` in the dashboard's API client so writes go through the same public API the reads do rather than touching the database. **The technology → purpose mapping is still not automatic**, and the Configure screen is built around saying so: it shows plausible matches as a hint, marks anything with no matching declared purpose as *Unresolved*, and states in the page that unresolved does not mean consent is required. Deciding which purpose covers which vendor stays a human step, for the reason `discovery.md` already gave — only the fiduciary knows which of its vendors serve which declared purpose. No endpoint, table, migration, credential, envelope or SDK change; the new screens are pure consumers of endpoints that already existed. | v1 | — |
| 2026-09-04 | Phase 8B (consent experience): added the consent banner, the preference centre and a one-line install snippet. **Two new endpoints.** `GET /api/v1/consent/config` on the **browser plane** (`pk_`) returns what the banner renders - purposes, display order, operator copy, the notice in force - derived on read from the purposes and notice already declared, so there is no new table and "activate" stays the act of declaring a purpose. It is cacheable (60s, `stale-while-revalidate`), identical for every visitor, and contains **no personal data and no legal reasoning**: no regime, jurisdiction, citation or requirement crosses into the browser, and a test greps the serialised payload for each of those. `GET /api/v1/sites/{siteId}/consent-proposal` on the **management plane** (`sk_`) returns a review artifact - suggested purposes with the technologies and evidence behind them, the regimes the policy engine considered applicable, and every question it would not decide. It is computed on demand, **stored nowhere and applied never**, and is always marked `requires_review`. Markets are supplied by the operator (`?market=DE`) and nothing geolocates anyone. The policy engine gained its first consumer, `api/lib/consent-config.ts`, under an enforced allowlist of one file; a separate test asserts no route handler imports it, so the engine annotates for a person and cannot gate a request. SDK: `analytics.banner.show()` / `showPreferences()` / `close()`, opt-in like discovery, rendered in a shadow root with no dismiss control - a dismissal that silently means "no" is a decision made for the visitor. Turning a purpose off records `withdraw` where it was previously granted and `deny` where it was not, preserving the distinction the append-only log exists for. No schema change, no migration, no change to any existing endpoint or to the event envelope. | v1 | — |
| 2026-09-04 | Phase 9A (consent autopilot): added recommended-policy generation and human approval. **Two new management-plane endpoints and one migration.** `GET|POST /api/v1/sites/{siteId}/consent-policy` generates a recommendation set (never stored) and approves one (published as an immutable version); `GET|POST|DELETE .../consent-policy/overrides` manages per-vendor operator overrides. Each recommendation carries a vendor, suggested purpose, data categories, jurisdictions, consent and opt-out findings, a recommended action, a reason, evidence, rule references and a confidence. **It is a recommendation engine and its data says so**: `consent_requirement` has four values including `conditional` and `unknown`, an unresolved input yields the action `review` and never `allow`, and `block` means "we suggest you do not load this" - Rift enforces nothing and the review screen states that. Two tables: `consent_policy_versions` is immutable once approved (a trigger refuses `UPDATE`, and a partial unique index permits one approved version per site, so "which configuration is live" has exactly one answer) and `consent_recommendation_overrides` is mutable and keyed on the detector, so an operator decision survives the vendor disappearing from a scan and reapplies when it returns. Approval sends the reviewed recommendations back in the request rather than the server re-deriving them, so a scan finishing mid-review cannot silently change what was agreed to. `GET /api/v1/consent/config` is unchanged in shape but now populates each purpose's `vendors` from the approved version; it still carries no regime, jurisdiction, citation or requirement. Approval does not declare purposes - a banner cannot record a decision against a purpose the consent domain does not hold, so undeclared ones are flagged for the operator. No change to the event envelope, the consent tables, or any existing endpoint's contract. | v1 | — |
| 2026-09-04 | Phase 9B (enforcement): the platform now acts on an approved policy rather than only recording a decision. **No new endpoint and no migration.** `GET /api/v1/consent/config` gains an `enforcement` block - `mode`, `unknown_host` and a list of `{host, vendor, purpose, action}` rules - present only once a policy version is approved, and `null` before that. Vendor-to-host resolution happens server-side against the same catalogue that classified the vendor, so classification and enforcement cannot match differently; the catalogue never ships to a page. The block still carries **no regime, citation, jurisdiction or requirement**, and a test greps the payload. `config_version` now includes the enforcement rules, so approving a policy invalidates cached configs rather than leaving them a minute behind. SDK: `analytics.enforcement.start()` / `stop()` / `mode()` / `explain()` / `preview()`, opt-in, defaulting to **observe** - it decides exactly as `enforce` would and blocks nothing, because turning enforcement on is the most dangerous thing an operator can do to their own site. It patches `fetch`, `XMLHttpRequest`, `sendBeacon`, `Image.src` and script insertion. **The boundary is contractual, not incidental**: browser enforcement cannot stop a `<script src>` already present in the served HTML (the parser fetches it before any script runs), cannot see a server-to-server transfer, and can be undone by another script on a page the customer controls. The load-bearing control is the server, where `POST /api/v1/events` re-derives consent from the append-only log for sites that set `analytics_consent_purpose` - unchanged since 6A and now tested from the bypass direction. Approving a policy is **not** a server-side gate and does not begin refusing traffic; conflating the two is pinned against by a regression test. Approving and setting overrides remain management-plane only, since either changes what every visitor's banner enforces. Regression tests confirm the analytics and secure-transfer paths are unchanged. | v1 | — |
| 2026-09-04 | Phase 10A (consent proof and privacy rights): **one migration and three new endpoints.** `consent_records` gains evidence columns - `jurisdictions`, `mechanism`, `policy_config_version`, `vendors` and `proof_hash` - all nullable, because a record written before this has no evidence and backfilling a value nobody observed would manufacture it. `proof_hash` is a SHA-256 receipt computed at write time over a canonical form exported as `canonicalEvidence()` so a principal can recompute it; it is **a receipt, not a signature and not a chain**, and `RECEIPT_CAVEAT` says so on every receipt. `purposes` gains `retention_note` and `retention_period`, both operator-declared with no default and no derivation - null means "not stated", never "none", and the period is never parsed out of the prose. New: `GET /api/v1/rights` (browser plane) reports which privacy controls apply for the markets given, as `always` / `indicated` / `unknown` - **`unknown` is never a denial**, and the note on every such row says so; `POST /api/v1/rights/requests` (browser plane, **consent session required**, because a deletion request naming somebody else's principal is a worse forgery than a consent record) records a request and snapshots the rules cited at the time; `GET /api/v1/rights/requests` and `PATCH .../{requestId}` (management plane) are the operator's queue. **Rift records rights requests and does not fulfil them**: access and deletion reach into systems it does not hold. A request is accepted even where the matrix indicates nothing, because refusing would turn an incomplete research artifact into a reason to deny somebody a request. `Citation` gains `applies`, so a consumer can distinguish a requirement from a recorded absence. One matrix data fix: `REQ-BR-LGPD-016` stated an absence while marked `applies: true`, so it was indistinguishable from the CCPA records granting the same-topic right; it now carries `applies: false` with the reasoning in its notes and **no legal proposition changed**. The append-only guarantee on `consent_records` is untouched. | v1 | — |
