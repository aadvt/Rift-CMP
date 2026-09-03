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
