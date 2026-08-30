# Event Schema

Canonical definition of the events our SDK emits and our API ingests. Both sides
must agree on this document before shipping changes.

## Conventions

- Field names are `snake_case`.
- Timestamps are ISO 8601 / RFC 3339 in UTC.
- IDs are UUID v4 unless noted.
- Unknown fields are ignored by consumers (forward compatible).

## Envelope

Every event shares a common envelope:

| Field         | Type     | Required | Description                              |
|---------------|----------|----------|------------------------------------------|
| `event_id`    | string   | yes      | Unique ID for this event                 |
| `event_type`  | string   | yes      | Dotted name, e.g. `session.started`      |
| `event_time`  | string   | yes      | When the event occurred (RFC 3339, UTC)  |
| `schema_version` | integer | yes     | Envelope/schema version                  |
| `source`      | string   | yes      | Emitting SDK identifier + version        |
| `payload`     | object   | yes      | Type-specific body (see below)           |

### Example

```json
{
  "event_id": "b3f1c2a4-5d6e-4f70-8a91-2b3c4d5e6f70",
  "event_type": "session.started",
  "event_time": "2026-08-30T12:00:00Z",
  "schema_version": 1,
  "source": "your-sdk/0.1.0",
  "payload": {
    "session_id": "8a91b3f1-c2a4-4d6e-9f70-1b2c3d4e5f60",
    "user_ref": "anon-1234"
  }
}
```

## Event types

### `session.started`

| Field        | Type   | Required | Description               |
|--------------|--------|----------|---------------------------|
| `session_id` | string | yes      | Session identifier        |
| `user_ref`   | string | no       | Opaque user reference     |

### `session.ended`

| Field        | Type    | Required | Description                  |
|--------------|---------|----------|------------------------------|
| `session_id` | string  | yes      | Session identifier           |
| `duration_ms`| integer | yes      | Session length in ms         |

_Add further event types as they are defined._

## Versioning

- Additive changes (new optional fields, new event types) do **not** bump
  `schema_version`.
- Breaking changes (removed/renamed fields, type changes) bump `schema_version`
  and require a coordinated rollout — see [integration-contract.md](integration-contract.md).
