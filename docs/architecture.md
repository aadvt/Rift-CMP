# Architecture

## Overview

Rift-CMP is a privacy-first analytics + consent platform. Our side is responsible for the SDK, the ingestion API, and the database that stores raw event data and the consent record. The platform is multi-tenant: every website belongs to an **organisation**, and an organisation is the boundary that data isolation is enforced against. The full ownership model is in [tenancy.md](tenancy.md). The customer website embeds our SDK, which automatically emits session and page events and optionally sends custom events through `track(name, properties)`. The other side of the system is responsible for analytics dashboards, the compliance engine, consent UX, and downstream reporting; they consume the data from the database rather than through a read API in this MVP.

There are **two domains**, and they are deliberately kept apart:

| Domain | Tables | Grain | What it records |
| --- | --- | --- | --- |
| Analytics | `sessions`, `events` | site + session | what happened on a page |
| Consent | `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, `consent_records` | site + principal | who decided what, about which purpose, under which notice, when |

Nothing in the consent schema references `Session` or `Event`, and no consent flag is copied onto analytics rows. The link, when one is needed, is made through `Principal`. Denormalising consent onto immutable event rows would bake one reading of the rules into them, and would be wrong the moment a decision changed. The reasoning, and the whole consent vocabulary, is in [consent.md](consent.md).

```text
┌─────────────────────┐   queued + batched events     ┌─────────────────────┐      persist       ┌────────────────────┐
│ Customer Website    │ ─────────────────────▶ │ SDK (`sdk/`)        │ ─────────────────▶ │ API (`api/`)       │ ─────▶ Database (`database/`) │
│  - site script      │                         │ - queue events      │                    │ - validate         │
│  - custom events    │                         │ - 2s / 10-event    │                    │ - bearer auth      │
│                     │                         │ - retry/backoff    │                    │ - dedupe + insert  │
└─────────────────────┘                         │ - sendBeacon       │                    └────────────────────┘
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
- Uses `navigator.sendBeacon` on unload/hidden transitions to avoid dropping the final queue when a tab closes.
- Sends payloads to the API using the canonical event envelope defined in [event-schema.md](event-schema.md).
- Handles site and session context such as `site_id`, `session_id`, browser, OS, URL, title, and referrer.
- Exposes `analytics.consent`, a **headless** consent client: it mints and stores an anonymous principal id, records `GRANTED`/`DENIED`/`WITHDRAWN` decisions, caches the effective state in `localStorage`, and notifies subscribers via `onChange()`. It renders no UI at all.
- Does **not** wire consent into the event gate automatically. `setConsentCheck` keeps its permissive default until an integrator opts in with `analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose))` — the SDK does not decide that analytics requires consent.

### API (`api/`)
- Next.js App Router application under `app/api/`, exposing two separate planes.
- **Ingestion plane** - `POST /api/v1/events` and `/api/v1/consent`, authenticated by
  a site public key (`pk_...`). Open cross-origin with CORS and `OPTIONS` preflight,
  because customer websites call it from domains outside the API origin. Event
  ingestion accepts a single event or a batch `{ "events": [...] }`, deduplicates
  repeated `event_id` values, and is idempotent across retries. The consent route
  appends one decision, or returns the effective state of the *one* principal whose
  id the caller already knows.
- **Management plane** - `/api/v1/organisation`, `/api/v1/sites`,
  `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies` and
  `/api/v1/notices`, authenticated by an organisation secret key (`sk_...`).
  Server-to-server only, so it deliberately returns no CORS headers. The audit trail
  and all consent reference data live here because a public key is visible to anyone
  viewing page source and must not be able to enumerate principals or read history.
- The two credentials are never interchangeable; presenting one to the other plane
  is a `401`.
- `GET /api/healthz` is unauthenticated.
- Does not expose analytics or query endpoints in this MVP; those are intentionally out of scope.

### Database (`database/`)
- Stores the canonical event record model plus tenant, website and session metadata, and the consent domain.
- Analytics tables are `organisations`, `websites`, `sessions`, and `events`; consent tables are `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, and `consent_records`. All are described in [database-schema.md](database-schema.md).
- `consent_records` is **append-only**, enforced by a PostgreSQL trigger that rejects `UPDATE`. Current consent is derived as the newest record per `(principal, purpose)`, never stored as a mutable flag. `DELETE` stays permitted so tenant offboarding cascades still work.
- There is no `api_keys` table: a site's public key lives on `websites`, and an
  organisation's hashed secret key lives on `organisations`.
- Foreign keys - including a composite `(session_id, site_id)` key on `events` and
  five composite keys on `consent_records` - make cross-tenant rows unrepresentable,
  independently of application code.
- Also owns credential minting and tenant provisioning (`keys.ts`, `tenancy.ts`),
  so key material is generated in exactly one place, and the consent service layer
  (`consent.ts`), every function of which takes its tenant as an explicit argument.
- The database is accessed directly by the analytics/dashboard side for reporting, not via our API surface.

## Data flow

1. The SDK loads on a customer site and creates or reuses a session context.
2. The SDK emits `session_start` when a new session begins and `page_view` automatically on page load.
3. Custom events are emitted using `track(name, properties)` and include custom JSON in `payload.properties`.
4. The SDK batches queued events and sends them as `{ "events": [...] }` to `POST /api/v1/events` on a 2-second cadence or when 10 events accumulate.
5. The API resolves the site from the public key, checks every event's `site_id` against it, validates the envelope against the shared contract, deduplicates repeated `event_id` values, applies CORS headers, and writes the normalized rows to the database.
6. The other team reads from the database directly for analytics workflows; no query API is required in the MVP. Because those reads bypass our API, that side is responsible for scoping its own queries by `site_id` / `organisation_id` per [tenancy.md](tenancy.md).

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
- tenancy model, credential issuance, and authorisation
- database schema and persistence, including the append-only consent record
- event envelope definition and the consent vocabulary

The other side owns:
- analytics dashboards and views
- the compliance engine: which purposes require consent, in which jurisdiction, for how long
- consent UX (banners, preference centres) and enforcement
- downstream business logic that reads the database

The shared contract between these teams is the event schema in [event-schema.md](event-schema.md), the consent vocabulary in [consent.md](consent.md), and the API contract in [api-spec.md](api-spec.md). These must be agreed before any change is made.

The split on consent is the important one: we record structure, they judge it. Nothing in our schema, API or SDK encodes a retention period, a jurisdiction, or a rule that a given purpose requires consent.
