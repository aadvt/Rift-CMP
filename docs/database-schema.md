# Database Schema

This is the actual database model used by the MVP. It supports website registration, browser sessions, and the raw event stream emitted by the SDK. Prisma is the schema authoring tool, and it maps camelCase model names onto the underlying PostgreSQL table/column names with `@map` and `@map("...")` attributes.

## Engine

- PostgreSQL is the target engine for the MVP.
- Prisma model names use `PascalCase`, but the database names are mapped to `snake_case` columns such as `site_id`, `public_key`, and `created_at`.
- The app uses string IDs generated as UUIDs by Prisma (`@default(uuid())`) rather than a separate numeric ID strategy.
- The MVP does not include an `api_keys` table; `public_key` is stored directly on `websites`.

## Prisma models

### `Website`

Customer websites that install the SDK.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `name` | `name` | `String` | not null |
| `domain` | `domain` | `String` | not null |
| `publicKey` | `public_key` | `String` | not null |
| `isActive` | `is_active` | `Boolean` | not null, default `true` |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Notes:
- A website is uniquely associated with a public key used to validate inbound events.
- The API validates both `site_id` and `public_key` before accepting events.

### `Session`

Browser sessions for a site.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `siteId` | `site_id` | `String` | not null, FK to `websites.id` |
| `startedAt` | `started_at` | `DateTime` | not null |
| `lastActivity` | `last_activity` | `DateTime` | not null |

Notes:
- Each session belongs to exactly one website.
- `last_activity` is refreshed as events continue arriving for that session.

### `Event`

Normalized raw ingestion table for SDK events.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `eventId` | `event_id` | `String` | not null, unique |
| `siteId` | `site_id` | `String` | not null, FK to `websites.id` |
| `sessionId` | `session_id` | `String` | not null, FK to `sessions.id` |
| `eventType` | `event_type` | `String` | not null |
| `name` | `name` | `String?` | nullable |
| `eventTime` | `event_time` | `DateTime` | not null |
| `pageUrl` | `page_url` | `String` | not null |
| `pageTitle` | `page_title` | `String` | not null |
| `referrer` | `referrer` | `String?` | nullable |
| `deviceType` | `device_type` | `String` | not null |
| `browser` | `browser` | `String` | not null |
| `os` | `os` | `String` | not null |
| `properties` | `properties` | `Json?` | nullable |
| `receivedAt` | `received_at` | `DateTime` | not null, default `now()` |

Notes:
- `event_type` is one of `page_view`, `session_start`, or `custom`.
- `name` is populated for custom events and left null for automatic events.
- `properties` stores arbitrary JSON for custom events and may be `null` for automatic events.

## Indexing expectations

At minimum, the event table should support:
- filtering by `site_id`
- filtering by `event_time`
- filtering by `event_type`
- joins on `session_id`

## Retention

The MVP does not yet specify a retention policy. This will be added when the first production storage strategy is defined.

## Migrations

- Prisma schema lives in `database/prisma/schema.prisma`.
- Migrations are created with Prisma from `database/`.
- The repo includes the `database` package + seed script used for local development and test data setup.
