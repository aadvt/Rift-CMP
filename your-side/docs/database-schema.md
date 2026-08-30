# Database Schema

Storage model backing `api/`. Keep this in sync with the migrations in
`database/`.

## Engine

- Engine: TBD (e.g. PostgreSQL 16)
- Naming: `snake_case` tables and columns, plural table names
- Every table has `created_at` / `updated_at` (`timestamptz`, default `now()`)

## Tables

### `events`

Raw ingested events.

| Column           | Type          | Constraints                     |
|------------------|---------------|---------------------------------|
| `id`             | `uuid`        | PK                              |
| `event_id`       | `uuid`        | not null, unique                |
| `event_type`     | `text`        | not null                        |
| `event_time`     | `timestamptz` | not null                        |
| `schema_version` | `integer`     | not null                        |
| `source`         | `text`        | not null                        |
| `payload`        | `jsonb`       | not null                        |
| `received_at`    | `timestamptz` | not null, default `now()`       |

Indexes:
- `idx_events_event_time` on (`event_time`)
- `idx_events_event_type_time` on (`event_type`, `event_time`)
- `uq_events_event_id` unique on (`event_id`) — idempotent ingestion

### `api_keys`

Credentials for SDK/service clients.

| Column        | Type          | Constraints               |
|---------------|---------------|---------------------------|
| `id`          | `uuid`        | PK                        |
| `hashed_key`  | `text`        | not null, unique          |
| `name`        | `text`        | not null                  |
| `scopes`      | `text[]`      | not null, default `'{}'`  |
| `revoked_at`  | `timestamptz` | nullable                  |

_Add further tables as the model grows._

## Retention

- `events` retained for TBD days, then archived/deleted by a scheduled job.

## Migrations

- Tool: TBD (e.g. `sqlx`, `flyway`, `alembic`, `golang-migrate`)
- Location: [`../database/`](../database)
- Forward-only; every migration has an `up` and, where feasible, a `down`.
