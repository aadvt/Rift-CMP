# Architecture

## Overview

Rift-CMP is a privacy-first analytics + consent platform. Our side is responsible for the SDK, the ingestion API, and the database that stores raw event data. The customer website embeds our SDK, which automatically emits session and page events and optionally sends custom events through `track(name, properties)`. The other side of the system is responsible for analytics dashboards, consent orchestration, and downstream reporting; they consume the data from the database rather than through a read API in this MVP.

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
- Uses `fetch(..., { keepalive: true })` on unload/hidden transitions to avoid dropping the final queue when a tab closes. `navigator.sendBeacon` cannot set request headers and therefore cannot send `Authorization: Bearer <public_key>`, so every beacon would be rejected with `401`; `keepalive` survives unload and does support headers. The queue is not cleared on this path, because the request cannot be awaited during unload — events stay in `localStorage` and are re-sent on the next load, where the API deduplicates them by `event_id`.
- Sends payloads to the API using the canonical event envelope defined in [event-schema.md](event-schema.md).
- Handles site and session context such as `site_id`, `session_id`, browser, OS, URL, title, and referrer.

### API (`api/`)
- Next.js App Router application under `app/api/`.
- Exposes the public ingestion surface: `POST /api/v1/events` and `GET /api/healthz`.
- Validates incoming events, enforces the shared schema contract, verifies `Authorization: Bearer <public_key>`, and manages cross-origin requests from arbitrary third-party domains.
- Uses CORS headers and handles `OPTIONS` preflight requests because customer websites may invoke the API from domains outside the API origin.
- Accepts either a single event or a batch payload `{ "events": [...] }`, and it deduplicates repeated `event_id` values within the same batch.
- Does not expose analytics or query endpoints in this MVP; those are intentionally out of scope.

### Database (`database/`)
- Stores the canonical event record model and website/session metadata.
- Current tables are `websites`, `sessions`, and `events` as described in [database-schema.md](database-schema.md).
- `public_key` lives on `websites` for the MVP; there is no `api_keys` table yet.
- The database is accessed directly by the analytics/dashboard side for reporting, not via our API surface.

## Data flow

1. The SDK loads on a customer site and creates or reuses a session context.
2. The SDK emits `session_start` when a new session begins and `page_view` automatically on page load.
3. Custom events are emitted using `track(name, properties)` and include custom JSON in `payload.properties`.
4. The SDK batches queued events and sends them as `{ "events": [...] }` to `POST /api/v1/events` on a 2-second cadence or when 10 events accumulate.
5. The API validates the envelope against the shared contract, deduplicates repeated `event_id` values in the same batch, applies CORS headers, and writes the normalized rows to the database.
6. The other team reads from the database directly for analytics workflows; no query API is required in the MVP.

## Cross-cutting concerns

- **Auth / identity:** the request must include `Authorization: Bearer <public_key>`. The API matches that bearer against the website’s `site_id` and `public_key` before accepting data, returning `401` for bad keys and `403` for inactive sites.
- **Observability:** request logging, validation errors, and ingestion metrics should be recorded in the API layer.
- **Error handling:** the API rejects malformed payloads with clear validation errors, while the SDK keeps client code safe by retrying recoverable failures and persisting queued events to `localStorage` instead of throwing into the host page.
- **Versioning:** `schema_version` is part of the event envelope and starts at `1`; contract changes require coordination across SDK, API, and the analytics consumer.

## Boundary definition

Our side owns:
- SDK capture logic
- ingestion API
- database schema and persistence
- event envelope definition

The other side owns:
- analytics dashboards and views
- consent UX and enforcement
- downstream business logic that reads the database

The shared contract between these teams is the event schema in [event-schema.md](event-schema.md) and the API contract in [api-spec.md](api-spec.md). These must be agreed before any change is made.
