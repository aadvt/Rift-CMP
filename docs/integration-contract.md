# Integration Contract

The agreement between our side and the other side. Changes here require sign-off
from both teams.

## Scope

| Concern                     | Owned by our side | Owned by other side |
|-----------------------------|:-----------------:|:-------------------:|
| Event production (SDK)      | ✅                | —                   |
| Event ingestion API        | ✅                | —                   |
| Storage / retention        | ✅                | —                   |
| Downstream consumption     | —                 | ✅                  |
| Event schema definition    | shared            | shared              |

## Interfaces

### 1. Event schema

- Source of truth: [`event-schema.md`](event-schema.md)
- Both sides validate against the same version.

### 2. Ingestion API

- Source of truth: [`api-spec.md`](api-spec.md)
- Transport: HTTPS, JSON.
- Auth: bearer token issued by our side.

### 3. Query API

- The other side reads events via `GET /events`.
- Pagination is cursor-based; cursors are opaque and must not be parsed.

## Compatibility rules

- **Additive changes** (new optional fields, new event types, new endpoints)
  can ship without coordination. Consumers must ignore unknown fields.
- **Breaking changes** (removed/renamed fields, semantic changes, type changes)
  require:
  1. An RFC / issue describing the change.
  2. Agreement from both teams.
  3. A new schema/API version.
  4. A dual-write or dual-read window before the old version is retired.

## SLAs / expectations

| Metric                    | Target        |
|---------------------------|---------------|
| Ingestion availability    | TBD           |
| Ingestion p99 latency     | TBD           |
| Max event lag (end to end)| TBD           |
| Deprecation notice period | TBD           |

## Change log

| Date       | Change                    | Version | Approved by |
|------------|---------------------------|---------|-------------|
| 2026-08-30 | Initial contract drafted  | v1      | —           |
