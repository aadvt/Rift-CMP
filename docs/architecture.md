# Architecture

## Overview

Rift-CMP is a privacy-first analytics + consent platform. Our side is responsible for the SDK, the ingestion API, and the database that stores raw event data and the consent record. The platform is multi-tenant: every website belongs to an **organisation**, and an organisation is the boundary that data isolation is enforced against. The full ownership model is in [tenancy.md](tenancy.md). The customer website embeds our SDK, which automatically emits session and page events and optionally sends custom events through `track(name, properties)`. The other side of the system is responsible for analytics dashboards, the compliance engine, consent UX, and downstream reporting; they consume the data from the database rather than through a read API in this MVP.

There are **three domains**, and they are deliberately kept apart:

| Domain | Tables | Grain | What it records |
| --- | --- | --- | --- |
| Analytics | `sessions`, `events` | site + session | what happened on a page |
| Consent | `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, `consent_records` | site + principal | who decided what, about which purpose, under which notice, when |
| Secure data routing | `data_recipients`, `transfer_authorisations`, `transfer_records` | site + principal + recipient | that an authorised personal-data transfer happened, and the sealed payload while it is in transit |

Nothing in the consent schema references `Session` or `Event`, and no consent flag is copied onto analytics rows. The link, when one is needed, is made through `Principal`. Denormalising consent onto immutable event rows would bake one reading of the rules into them, and would be wrong the moment a decision changed. The reasoning, and the whole consent vocabulary, is in [consent.md](consent.md).

The third domain is a **proof of concept**, added in Phase 3. It exists to demonstrate one property, stated narrowly:

> Rift can authorise and record a personal-data transfer without being able to read the plaintext.

Routing depends on consent rather than duplicating it: an authorisation is minted only if `getEffectiveConsent` — the same derivation the consent API uses — resolves to `GRANTED`, and the authorisation row then references the exact `consent_records` id it relied upon rather than a copied boolean. It invents no cryptography; every primitive comes from Node's built-in `node:crypto`. It has had **no cryptographic review** and must not be treated as production-secure. The trust model, the construction, and the things it explicitly does not defend against are all in [secure-transfer.md](secure-transfer.md).

Phase 4 joins the consent and routing domains into one product flow without joining the domains themselves. The single coupling point is an **orchestration layer**, described below and in [lifecycle.md](lifecycle.md); a fourth table is not added, and the audit trail that reads across all three domains is a read model rather than a foreign key.

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
- Exposes `analytics.consent`, a **headless** consent client: it mints and stores an anonymous principal id, records `GRANTED`/`DENIED`/`WITHDRAWN` decisions, caches the effective state in `localStorage`, and notifies subscribers via `onChange()`. It renders no UI at all.
- Does **not** wire consent into the event gate automatically. `setConsentCheck` keeps its permissive default until an integrator opts in with `analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose))` — the SDK does not decide that analytics requires consent.

### API (`api/`)
- Next.js App Router application under `app/api/`, exposing three separate planes.
- **Ingestion plane** - `POST /api/v1/events` and `/api/v1/consent`, authenticated by
  a site public key (`pk_...`). Open cross-origin with CORS and `OPTIONS` preflight,
  because customer websites call it from domains outside the API origin. Event
  ingestion accepts a single event or a batch `{ "events": [...] }`, deduplicates
  repeated `event_id` values, and is idempotent across retries. The consent route
  appends one decision, or returns the effective state of the *one* principal whose
  id the caller already knows.
- **Management plane** - `/api/v1/organisation`, `/api/v1/sites`,
  `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies`,
  `/api/v1/notices`, `/api/v1/recipients`, `/api/v1/authorisations` (including
  `/api/v1/authorisations/decision`), `/api/v1/transfers` and `/api/v1/audit`,
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
- Does not expose analytics or query endpoints in this MVP; those are intentionally out of scope.

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

### Database (`database/`)
- Stores the canonical event record model plus tenant, website and session metadata, the consent domain, and the secure routing tables.
- Analytics tables are `organisations`, `websites`, `sessions`, and `events`; consent tables are `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, and `consent_records`; secure routing tables are `data_recipients`, `transfer_authorisations`, and `transfer_records`. All are described in [database-schema.md](database-schema.md).
- The routing tables hold ciphertext, its digest and size, public keys, and routing metadata. There is deliberately **no plaintext column and no private-key column**, and a test asserts that a completed transfer's payload appears nowhere in any row of any table.
- `consent_records` is **append-only**, enforced by a PostgreSQL trigger that rejects `UPDATE`. Current consent is derived as the newest record per `(principal, purpose)`, never stored as a mutable flag. `DELETE` stays permitted so tenant offboarding cascades still work.
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

The other side owns:
- analytics dashboards and views
- the compliance engine: which purposes require consent, in which jurisdiction, for how long
- consent UX (banners, preference centres) and enforcement
- downstream business logic that reads the database
- the fiduciary systems at either end of a transfer, and above all **the target's key management**: generating the X25519 key pair, keeping the private half out of Rift's reach, and rotating it. Rift's inability to decrypt is only worth as much as that side's custody of the key

The shared contract between these teams is the event schema in [event-schema.md](event-schema.md), the consent vocabulary in [consent.md](consent.md), the trust model in [secure-transfer.md](secure-transfer.md), the end-to-end flow in [lifecycle.md](lifecycle.md), and the API contract in [api-spec.md](api-spec.md). These must be agreed before any change is made.

The split on consent is the important one: we record structure, they judge it. Nothing in our schema, API or SDK encodes a retention period, a jurisdiction, or a rule that a given purpose requires consent.
