# Architecture

## Overview

Rift-CMP is a privacy-first analytics + consent platform. Our side is responsible for the SDK, the ingestion API, and the database that stores raw event data and the consent record. The platform is multi-tenant: every website belongs to an **organisation**, and an organisation is the boundary that data isolation is enforced against. The full ownership model is in [tenancy.md](tenancy.md). The customer website embeds our SDK, which automatically emits session and page events and optionally sends custom events through `track(name, properties)`. The other side of the system is responsible for analytics dashboards, the compliance engine, consent UX, and downstream reporting; they consume the data from the database rather than through a read API in this MVP.

There are **four domains**, and they are deliberately kept apart:

| Domain | Tables | Grain | What it records |
| --- | --- | --- | --- |
| Analytics | `sessions`, `events` | site + session | what happened on a page |
| Consent | `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, `consent_records` | site + principal | who decided what, about which purpose, under which notice, when |
| Secure data routing | `data_recipients`, `transfer_authorisations`, `transfer_records` | site + principal + recipient | that an authorised personal-data transfer happened, and the sealed payload while it is in transit |
| Discovery | `discovered_components`, `discovered_storage`, `discovery_violations` | site + destination | what runs on the site's pages, where it sends data, and what fired without consent |

The discovery domain is site-scoped like analytics and is deliberately never joined to `Principal`: a violation records that a destination was contacted under a non-granted purpose, never who was on the page. See [discovery.md](discovery.md).

Nothing in the consent schema references `Session` or `Event`, and no consent flag is copied onto analytics rows. The link, when one is needed, is made through `Principal`. Denormalising consent onto immutable event rows would bake one reading of the rules into them, and would be wrong the moment a decision changed. The reasoning, and the whole consent vocabulary, is in [consent.md](consent.md).

The third domain is a **proof of concept**, added in Phase 3. It exists to demonstrate one property, stated narrowly:

> Rift can authorise and record a personal-data transfer without being able to read the plaintext.

Routing depends on consent rather than duplicating it: an authorisation is minted only if `getEffectiveConsent` — the same derivation the consent API uses — resolves to `GRANTED`, and the authorisation row then references the exact `consent_records` id it relied upon rather than a copied boolean. It invents no cryptography; every primitive comes from Node's built-in `node:crypto`. It has had **no cryptographic review** and must not be treated as production-secure. The trust model, the construction, and the things it explicitly does not defend against are all in [secure-transfer.md](secure-transfer.md).

Phase 4 joins the consent and routing domains into one product flow without joining the domains themselves. The single coupling point is an **orchestration layer**, described below and in [lifecycle.md](lifecycle.md); a fourth table is not added, and the audit trail that reads across all three domains is a read model rather than a foreign key.

Phase 5 adds an aggregate read surface over the same three domains (`database/analytics.ts`) and an **operator dashboard** on top of it. It adds no table and no migration, and it adds no rule: the dashboard reads the public API over HTTP like any other consumer. The complete picture, including what the MVP assumes and what it does not do, is in [mvp.md](mvp.md).

```text
┌─────────────────────┐   queued + batched events     ┌─────────────────────┐      persist       ┌────────────────────┐
│ Customer Website    │ ─────────────────────▶ │ SDK (`sdk/`)        │ ─────────────────▶ │ API (`api/`)       │ ─────▶ Database (`database/`) │
│  - site script      │                         │ - queue events      │                    │ - validate         │
│  - custom events    │                         │ - 2s / 10-event    │                    │ - bearer auth      │
│                     │                         │ - retry/backoff    │                    │ - dedupe + insert  │
└─────────────────────┘                         │ - keepalive flush  │                    └────────────────────┘
                                              └─────────────────────┘
                                                           │
                                                           │ reads/writes
                                                           ▼
                                                  Analytics / dashboard / consent engine
                                                  (owned by the other team; not in this repo)
```

## Components

### SDK (`sdk/`)
- JavaScript/TypeScript client that runs on customer websites.
- Automatically emits `page_view` and `session_start` events.
- Allows arbitrary custom events via `track(name, properties)`.
- Queues events in memory and flushes as batch payloads of up to 10 events every 2 seconds, with retry/backoff and localStorage persistence for recoverable failures.
- Uses `fetch(..., { keepalive: true })` on unload/hidden transitions to avoid dropping the final queue when a tab closes. `navigator.sendBeacon` cannot set request headers and therefore cannot send `Authorization: Bearer <public_key>`, so every beacon would be rejected with `401`; `keepalive` survives unload and does support headers. The queue is not cleared on this path, because the request cannot be awaited during unload — events stay in `localStorage` and are re-sent on the next load, where the API deduplicates them by `event_id`.
- Sends payloads to the API using the canonical event envelope defined in [event-schema.md](event-schema.md).
- Handles site and session context such as `site_id`, `session_id`, browser, OS, URL, title, and referrer.
- Exposes `analytics.consent`, a **headless** consent client: it obtains and stores a server-minted anonymous principal id and the secret that binds it to this browser, opens and renews consent sessions transparently, records `GRANTED`/`DENIED`/`WITHDRAWN` decisions, caches the effective state in `localStorage`, and notifies subscribers via `onChange()`. It renders no UI at all.
- Does **not** wire consent into the event gate automatically. `setConsentCheck` keeps its permissive default until an integrator opts in with `analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose))` — the SDK does not decide that analytics requires consent.

### API (`api/`)
- Next.js App Router application under `app/api/`, exposing three separate planes.
- **Ingestion plane** - `POST /api/v1/events`, `/api/v1/consent`,
  `/api/v1/consent/session` and `/api/v1/discovery`, authenticated by
  a site public key (`pk_...`). Open cross-origin with CORS and `OPTIONS` preflight,
  because customer websites call it from domains outside the API origin. Event
  ingestion accepts a single event or a batch `{ "events": [...] }`, deduplicates
  repeated `event_id` values, and is idempotent across retries. The consent route
  appends one decision — with a consent session as well as the key, since Phase
  6A — or returns the effective state of the *one* principal whose id the caller
  already knows. Every route on this plane is rate limited and origin checked;
  `lib/ingest-guard.ts` applies all of it in one place, in one order.
- **Management plane** - `/api/v1/organisation`, `/api/v1/sites`,
  `/api/v1/consent/history`, `/api/v1/consent/effective`, `/api/v1/purposes`,
  `/api/v1/policies`, `/api/v1/notices`, `/api/v1/recipients`,
  `/api/v1/authorisations` (including `/api/v1/authorisations/decision`),
  `/api/v1/transfers`, `/api/v1/audit` and `/api/v1/analytics/*`,
  authenticated by an organisation secret key
  (`sk_...`). Server-to-server only, so it deliberately returns no CORS headers. The
  audit trail and all consent reference data live here because a public key is
  visible to anyone viewing page source and must not be able to enumerate principals
  or read history.
- Authorisation is its own top-level resource, not a sub-resource of transfers:
  `POST /api/v1/transfers/authorisations` **moved** to `POST /api/v1/authorisations`
  in Phase 4. A transfer is one action that needs permission; the permission is the
  thing being modelled, so a later action type can reuse the same decision without
  reshaping the API. This is a breaking change and is recorded as one in
  [integration-contract.md](integration-contract.md).
- **Delivery plane** - `GET /api/v1/transfers/{transferId}/envelope`, authenticated
  by a recipient delivery key (`rk_...`). The narrowest of the three: it authorises a
  target fiduciary to collect sealed envelopes addressed to that one recipient, and
  confers no ability to read them. No CORS headers.
- The three credentials are never interchangeable; presenting one to another plane
  is a `401`, decided on the key prefix before any database lookup.
- `GET /api/healthz` is unauthenticated.
- Exposes a deliberately small analytics read surface —
  `GET /api/v1/analytics/summary` and `GET /api/v1/analytics/overview` — which
  returns aggregate counts and nothing else. It is not a query API, and it is not
  a replacement for the direct database access the analytics team has; see
  [mvp.md](mvp.md).

### Operator dashboard (`api/app/dashboard/`)

- Five server-rendered pages in the same Next.js app as the API: Overview,
  Consent, Transfers, Analytics and Integration, plus a sign-in page at
  `/signin`.
- **It is an API consumer, not a source of business logic.** Every page reads
  through `apiGet` in `api/lib/dashboard/api.ts`, which makes a real HTTP request
  to the platform API. No page imports `database`, and no page touches Prisma.
  That is slightly slower than querying directly, and it is the point: if a
  screen needs something the API cannot express, **the API is what changes**. No
  rule, no aggregate and no derivation lives here that an integrator calling the
  same endpoints could not reproduce.
- `GET /api/v1/consent/effective` exists because that rule was followed rather
  than worked around. The browser-plane `GET /api/v1/consent` needs a site public
  key the dashboard does not hold, and re-deriving effective consent from a
  *paginated* history page would be silently wrong past the limit. Both planes
  reduce the same append-only log through the same `resolveEffectiveConsent`.
- Sign-in takes the **organisation secret key** and exchanges it for a revocable
  session. The cookie (`rift_dashboard_session`, `httpOnly`, `sameSite: strict`,
  60-minute idle timeout inside an eight-hour lifetime, `secure` in production)
  holds an opaque token; the secret is sealed at rest in `dashboard_sessions`
  under a key derived from that token, so neither the cookie nor the database is
  enough alone. It is read only on the server and attached to outgoing requests
  in `apiGet`; the browser receives rendered HTML and never the credential.
  Still an **MVP compromise**: there are no user accounts and no roles, so any
  live session speaks for the whole organisation. See [security.md](security.md).
- The layout's redirect to `/signin` is **convenience, not security**. The API
  authenticates every request independently, so a page reached without a valid
  key renders nothing; the guard exists so an operator sees a form rather than a
  wall of `401`s.
- The dashboard is the one part of this repo that overlaps the other side's
  scope. It is an operator tool for confirming the platform is working — not the
  analytics product, not a consent UI, and not a compliance view. See
  [integration-contract.md](integration-contract.md).

### Orchestration layer (`database/authorisation.ts`)

- The component that joins the domains, and **the only place they are joined**. `evaluateAuthorisation` answers exactly one question: *is this requested action currently authorised for this Data Principal, this Fiduciary and this purpose?*
- It is **side-effect free**. It creates no rows, mints no nonce, and contains no cryptography. Asking is not the same as being granted permission, and keeping the two apart is what lets `POST /api/v1/authorisations/decision` exist at all — a fiduciary can check before committing without writing a row or burning a single-use permission.
- Consent knows nothing about transfers, and transfers know nothing about how consent is evaluated. `authoriseTransfer` in `database/transfers.ts` no longer decides anything: it delegates to this module and then does the one transfer-specific thing, minting a single-use permission. Remove the routing prototype and the consent domain is untouched; remove this module and the two stop being able to talk, which is the correct blast radius for a coupling point.
- There is one definition of "current consent" in the codebase. This module calls `getEffectiveConsent`, the same derivation the consent API and the SDK use, rather than reimplementing the gate.
- Refusals are distinct — `site_not_found`, `principal_not_found`, `purpose_not_found`, `no_consent_decision`, `consent_denied`, `consent_withdrawn` — because "never decided", "refused" and "granted then withdrew" are different facts to both a caller and an auditor. Every lookup is scoped to the organisation the credential resolved to, so another tenant's rows are indistinguishable from rows that do not exist.
- `database/audit.ts` is the matching read side: it queries the three domains separately and interleaves them by time into one timeline. They are **not joined in SQL** — introducing a foreign key to make the query tidier would couple domains that Phase 2 and Phase 3 kept apart. The join happens in a read model, where it costs nothing structurally.
- The end-to-end flow, the refusal vocabulary and what a withdrawal does and does not change are in [lifecycle.md](lifecycle.md).

### Secure transfer (`secure-transfer/`)
- A workspace package holding every line of cryptography in the project, split so the trust boundary is **structural rather than a matter of discipline**.

```text
secure-transfer/
  envelope.ts    types, canonical AAD, digest, shape validation   <- Rift may import
  fiduciary.ts   generateRecipientKeyPair, seal, open             <- fiduciaries only
```

- `envelope.ts` is the Rift-safe half. It can describe an envelope, hash it, measure it and check its shape; it contains no key generation, no encryption and no decryption.
- `fiduciary.ts` belongs to the source and target fiduciaries — mock actors in this prototype, separate systems Rift has no access to in any real deployment. It is textbook hybrid public-key encryption assembled from `node:crypto`: ephemeral X25519 ECDH, HKDF-SHA256 to derive the key, AES-256-GCM to seal. No new dependency and no novel cryptography, which in a proof of concept is a feature.
- `api/` imports only `envelope.ts`, and so does `database/transfers.ts`. `api/tests/transfer-boundary.test.ts` walks every `.ts`/`.tsx` file under `api/` (excluding `tests/`, which acts as the fiduciaries) and fails if any of them contains a real import of the fiduciary module. Rift does not merely decline to decrypt; the code to do so is not in its dependency graph.

### Policy engine (`policy/`)

- A workspace package that answers *given this processing activity and this context, what requirements apply?* It reads the Phase 6B requirement matrix and holds **no legal content of its own**: a wrong requirement is fixed in `docs/regulations/matrix/requirements.json` and rebuilt, because there is nowhere else it could be fixed.
- Split so that being generic is structural rather than a matter of discipline, in the same spirit as `secure-transfer/`:

```text
policy/
  model.ts             the generic vocabulary - jurisdiction, actor, rule, verdict
  disposition.ts       the ONE table that turns a topic into a verdict  <- names no regime
  rules.ts             matrix -> Rule[], and which rules a context reaches
  evaluate.ts          the evaluator: one pure function
  location.ts          location *evidence*: source, confidence, observed time
  jurisdiction-rules.ts  versioned region -> jurisdiction mapping (configuration)
  resolve.ts           observations -> jurisdictions -> a policy decision
```

- `disposition.ts` is keyed on canonical topic and **contains no regime name**; `api/tests/policy-rules.test.ts` reads the file and fails the build if one appears. Adding an eighth regime to the matrix therefore adds rows to the matrix and changes no engine code. "A notice requirement obliges you to give notice" is not a fact about the GDPR.
- `evaluate` is pure: no clock, no I/O, no state between calls. `asOf` is a required input, because an evaluator that reads the clock stops producing the same answer for the same question the moment some requirement's `effective_from` passes.
- It resolves conservatively, and **absence never permits**: no matching rule, an unclassifiable topic, a condition it cannot evaluate and a missing jurisdiction are all `REVIEW`. `ALLOW` requires a rule that positively says so — and no context in the current matrix produces one, which a test pins down.
- It is **not imported by any route, page or database module**. That is the whole of its relationship to the running platform today, and [policy-engine.md](policy-engine.md) sets out why.
- Phase 7B adds jurisdiction resolution in the same package, kept in separate files because it answers a different question: *whose law is in play?* rather than *what does that law require?* Jurisdictions **accumulate** - there is no ranking and no winner, because a visitor can be reached by several regimes at once - and confidence is reported but never used to drop one, since discarding a weakly evidenced jurisdiction is the under-inclusive failure that looks like success.
- The resolver **cannot geolocate and will not accept an IP address**. It takes a derived region code; a signal that looks like an address is rejected with a reason rather than ignored. The same structural argument as the crypto boundary: the capability is not in its dependency graph. See [jurisdiction-resolution.md](jurisdiction-resolution.md).

### Database (`database/`)
- Stores the canonical event record model plus tenant, website and session metadata, the consent domain, and the secure routing tables.
- Analytics tables are `organisations`, `websites`, `sessions`, and `events`; consent tables are `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, and `consent_records`; secure routing tables are `data_recipients`, `transfer_authorisations`, and `transfer_records`. All are described in [database-schema.md](database-schema.md).
- The routing tables hold ciphertext, its digest and size, public keys, and routing metadata. There is deliberately **no plaintext column and no private-key column**, and a test asserts that a completed transfer's payload appears nowhere in any row of any table.
- `consent_records` is **append-only**, enforced by a PostgreSQL trigger that rejects `UPDATE`. Current consent is derived as the newest record per `(principal, purpose)`, never stored as a mutable flag. Since Phase 6A `DELETE` is guarded too — permitted only inside a transaction that has set `rift.offboarding = 'on'`, which `deleteOrganisation()` does and nothing else should. `transfer_authorisations` and `transfer_records` carry the same deletion guard plus a forward-only status state machine, so the audit timeline cannot be rewritten underneath itself.
- There is no `api_keys` table: a site's public key lives on `websites`, and an
  organisation's hashed secret key lives on `organisations`.
- Foreign keys - including a composite `(session_id, site_id)` key on `events` and
  five composite keys on `consent_records` - make cross-tenant rows unrepresentable,
  independently of application code.
- Also owns credential minting and tenant provisioning (`keys.ts`, `tenancy.ts`),
  so key material is generated in exactly one place, the consent service layer
  (`consent.ts`), the secure routing service layer (`transfers.ts`), the
  orchestration layer (`authorisation.ts`) and the audit read model (`audit.ts`) —
  every function of all four takes its tenant as an explicit argument.
- The database is accessed directly by the analytics/dashboard side for reporting, not via our API surface.

## Data flow

1. The SDK loads on a customer site and creates or reuses a session context.
2. The SDK emits `session_start` when a new session begins and `page_view` automatically on page load.
3. Custom events are emitted using `track(name, properties)` and include custom JSON in `payload.properties`.
4. The SDK batches queued events and sends them as `{ "events": [...] }` to `POST /api/v1/events` on a 2-second cadence or when 10 events accumulate.
5. The API resolves the site from the public key, checks every event's `site_id` against it, validates the envelope against the shared contract, deduplicates repeated `event_id` values, applies CORS headers, and writes the normalized rows to the database.
6. The other team reads from the database directly for analytics workflows; no query API is required in the MVP. Because those reads bypass our API, that side is responsible for scoping its own queries by `site_id` / `organisation_id` per [tenancy.md](tenancy.md).

### Secure routing flow

A second, separate flow. Rift is a **relay that cannot read what it relays**: it
decides whether a transfer may happen, stores the sealed result, and hands it on.

```text
   Source Fiduciary                 Rift (this repo)              Target Fiduciary
   holds the plaintext              ciphertext + metadata         holds the X25519
                                                                  private key
        |                                 |                              |
        |  1. authorise (no payload) ---> |                              |
        |                                 | checks consent, mints a      |
        |                                 | single-use authorisation     |
        |  <--- public key + binding ---- |                              |
        |                                 |                              |
   2. seal locally                        |                              |
      ECDH -> HKDF -> AES-GCM             |                              |
      AAD = the binding                   |                              |
        |                                 |                              |
        |  3. submit sealed envelope ---> |                              |
        |                                 | consumes the authorisation,  |
        |                                 | stores ciphertext + digest   |
        |                                 |                              |
        |                                 |  4. collect (rk_ key) <----- |
        |                                 |  --- envelope + binding ---> |
        |                                 |                       5. opens it;
        |                                 |                          only it can
```

Steps 1 and 3 are separate requests on purpose: the ciphertext does not exist when
the decision is made, so it cannot influence it. Both the sealing in step 2 and the
opening in step 5 happen outside Rift, in code Rift does not import.

## Cross-cutting concerns

- **Auth / identity:** every request is authenticated with `Authorization: Bearer <key>`, and **the credential alone determines which tenant the request acts on** - no URL or body field is trusted to select a site or organisation. Ingestion resolves the site from the public key and then *validates* the envelope's `site_id` against it; management resolves the organisation from the secret key's digest and scopes every query to it. Bad or wrong-plane keys return `401`, inactive sites `403`, and another tenant's resources `404` so that IDs cannot be enumerated.
- **Tenant isolation:** enforced twice - in the API by scoping every query to the authenticated principal, and in PostgreSQL by foreign keys that make cross-tenant rows impossible to write. See [tenancy.md](tenancy.md).
- **Observability:** request logging, validation errors, and ingestion metrics should be recorded in the API layer.
- **Error handling:** the API rejects malformed payloads with clear validation errors, while the SDK keeps client code safe by retrying recoverable failures and persisting queued events to `localStorage` instead of throwing into the host page.
- **Versioning:** `schema_version` is part of the event envelope and starts at `1`; contract changes require coordination across SDK, API, and the analytics consumer.

## Boundary definition

Our side owns:
- SDK capture logic, and the headless consent client
- ingestion API, site management API, and the consent API
- tenancy model, credential issuance, and authorisation across all three planes
- database schema and persistence, including the append-only consent record
- event envelope definition and the consent vocabulary
- the secure routing prototype: recipient registration, the consent-gated transfer
  authorisation, the relay itself, and the crypto boundary package — but **not** the
  fiduciaries at either end, and specifically not the target's key management
- the orchestration layer that answers "is this action currently authorised?", and
  the unified audit read model over consent, authorisations and transfers — but
  **not** any judgement about whether a purpose required consent in the first place
- the aggregate analytics read models and the operator dashboard that renders
  them — an internal tool for confirming the platform is working, built strictly
  as a consumer of the public API, and **not** the analytics product

The other side owns:
- analytics dashboards and views
- the compliance engine *as enforcement*: acting on a requirement, and deciding what a product does when a regime demands more than a recorded decision provides. Since Phase 7A this repo carries the **evaluator** for those requirements in `policy/`, which says what applies and cites why; it enforces nothing and no route consults it
- consent UX (banners, preference centres) and enforcement
- downstream business logic that reads the database
- the fiduciary systems at either end of a transfer, and above all **the target's key management**: generating the X25519 key pair, keeping the private half out of Rift's reach, and rotating it. Rift's inability to decrypt is only worth as much as that side's custody of the key

The shared contract between these teams is the event schema in [event-schema.md](event-schema.md), the consent vocabulary in [consent.md](consent.md), the trust model in [secure-transfer.md](secure-transfer.md), the end-to-end flow in [lifecycle.md](lifecycle.md), and the API contract in [api-spec.md](api-spec.md). These must be agreed before any change is made.

The split on consent is the important one: we record structure, they judge it. Nothing in our **schema, API or SDK** encodes a retention period, a jurisdiction, or a rule that a given purpose requires consent — and Phase 7A did not change that. `policy/` reasons about jurisdictions, but it is none of those three: no table stores its output, no endpoint returns it, and no request is refused because of it. The moment a route consults it, this paragraph stops being true and both sides need to agree what replaces it.
