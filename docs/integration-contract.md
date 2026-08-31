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
| Source fiduciary: producing and sealing the plaintext | — | ✅ |
| **Target fiduciary key management: generating, storing and rotating the X25519 private key** | — | ✅ |
| Analytics dashboards | — | ✅ |
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

The SDK and API must implement the same schema without drift. The analytics side must read the database using the same semantics.

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
- `consent_records` is append-only. A `UPDATE` is refused by a database trigger.
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
- `POST /api/v1/consent` appends one consent decision, and `GET /api/v1/consent`
  returns the effective state of **one** principal — both authenticated by a
  **site public key** (`pk_...`)
- `GET /api/v1/organisation`, `GET|POST /api/v1/sites`, `GET|PATCH /api/v1/sites/{siteId}`
  are the management surface, authenticated by an **organisation secret key** (`sk_...`)
- `GET /api/v1/consent/history` (the audit trail), `GET|POST /api/v1/purposes`,
  `GET|POST /api/v1/policies`, `POST /api/v1/policies/{policyId}/versions` and
  `GET|POST /api/v1/notices` are also management, for the same reason: a public
  key is visible in page source and must not be able to enumerate principals,
  read history, or invent reference data
- `GET|POST /api/v1/recipients`, `POST /api/v1/transfers/authorisations` and
  `GET|POST /api/v1/transfers` are management too, authenticated by the
  **organisation secret key** (`sk_...`): registering a target fiduciary,
  authorising one transfer, submitting the sealed envelope, and reading the
  organisation's own transfer metadata
- `GET /api/v1/transfers/{transferId}/envelope` is the **delivery plane**,
  authenticated by a **recipient delivery key** (`rk_...`). It is the only
  endpoint on that plane: it collects sealed envelopes addressed to one recipient
  and confers no ability to read them
- `GET /api/healthz` is the unauthenticated health check endpoint
- the three credentials are never interchangeable; using one on another plane is
  `401`, decided on the key prefix before any database lookup
- invalid keys return `401`, inactive sites `403`, another tenant's site `404`
- an event whose `site_id` is not the authenticated site is rejected as `site_mismatch`
- CORS is enabled for ingestion; the management and delivery planes intentionally
  send none
- There is no analytics query API in the MVP

## Read API status

A read API may be added later if the analytics/dashboard team explicitly needs it. That is outside scope until requested, and any such addition must be reviewed as part of the same integration contract before implementation.

## Database access model

For the MVP, the analytics/dashboard side reads the database directly, not through a dedicated read endpoint. This separation keeps the API focused on ingestion and preserves a simple first version of the platform.

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

## Compatibility rules

- Schema changes must be reviewed by both teams before implementation.
- Breaking changes require a version bump in `schema_version` and coordinated rollout.
- New optional fields must not silently break compatibility.
- Changes to the API and schema must be reflected in the shared documentation before they are shipped.
- Batch payload behavior is part of the live contract: the SDK sends `{ "events": [...] }` in a single request, and the API treats duplicates within the same batch idempotently via `event_id`.

## Cross-origin requirement

Because the SDK runs on arbitrary customer domains, the API must support browser-based cross-origin requests. This means handling `OPTIONS` preflight requests and returning the proper CORS headers, including `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`. Same-origin traffic does not need the same treatment, but cross-origin traffic does.

## Change log

| Date | Change | Version | Approved by |
| --- | --- | --- | --- |
| 2026-08-30 | Initial contract for SDK/API/database split, shared event schema, bearer auth, and batch ingestion | v1 | — |
| 2026-08-31 | Added organisation tenancy, public/secret key separation, the site management plane, and tenant-isolation guarantees. Event envelope unchanged; `site_id` is now validated against the authenticating key. | v1 | — |
| 2026-08-31 | Phase 2: added the consent domain — principals, purposes, policies, policy versions, notices and an append-only consent record — plus `POST\|GET /api/v1/consent` on the browser plane and `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices` on the management plane, and a headless `analytics.consent` SDK client. The consent vocabulary in [consent.md](consent.md) becomes a shared artifact: it encodes structure and no legal rules, and is the base the compliance engine is expected to be built on. Event envelope and analytics tables unchanged; the two domains are not joined. | v1 | — |
| 2026-09-01 | Phase 3: added secure data routing as a **proof of concept** — `data_recipients`, `transfer_authorisations` and `transfer_records`, plus `GET\|POST /api/v1/recipients`, `POST /api/v1/transfers/authorisations` and `GET\|POST /api/v1/transfers` on the management plane, and a third credential plane (`rk_` recipient delivery key) whose only endpoint is `GET /api/v1/transfers/{transferId}/envelope`. The trust model in [secure-transfer.md](secure-transfer.md) becomes a shared artifact. Rift stores ciphertext and routing metadata and cannot decrypt either; the target fiduciary's X25519 private key is that side's responsibility and never reaches us. Event envelope, analytics tables and the consent schema are unchanged — routing reads consent through `getEffectiveConsent` and references the consent record it relied on, rather than copying a flag. Not cryptographically reviewed; not to be described as production-secure. | v1 | — |
