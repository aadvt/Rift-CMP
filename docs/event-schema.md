# Event Schema

This is the canonical event contract for the Rift-CMP SDK and ingestion API. Every emitted event must use this envelope, and any change to it must be reviewed by both teams before deployment.

## Conventions

- Field names use `snake_case`.
- Timestamps are RFC 3339 UTC strings such as `2026-08-30T12:00:00Z`.
- `event_id` is a UUID v4 value.
- `schema_version` starts at `1` and increases only when the contract changes in a breaking way.
- `payload` is always present.
- `name` is optional and populated for custom events; automatic events usually omit it.
- `payload.properties` is optional, but it is always included as an object in the SDK event builder even when empty.
- The public key is not part of the event envelope. It is sent in the HTTP `Authorization` header as `Bearer <public_key>`.
- `site_id` is **validated, not trusted**. The API resolves the site from the public key and rejects any event whose `site_id` differs, with the code `site_mismatch`. The field stays in the envelope so the contract is unchanged and so misconfiguration fails loudly instead of being silently reassigned. See [tenancy.md](tenancy.md).

## Envelope

Every event shares the same top-level structure:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `event_id` | string | yes | UUID v4 unique event identifier |
| `site_id` | string | yes | Customer site identifier |
| `session_id` | string | yes | Session identifier for the browser session |
| `event_type` | string | yes | One of `page_view`, `session_start`, or `custom` |
| `name` | string | no | Custom event name when `event_type` is `custom` |
| `event_time` | string | yes | Event time in RFC3339 UTC |
| `schema_version` | integer | yes | Schema version; starting value is `1` |
| `source` | string | yes | SDK identifier and version, e.g. `rift-cmp-sdk/0.1.0` |
| `payload` | object | yes | Event payload containing page metadata, device metadata, and optional custom properties |

### `payload`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | object | yes | Current page metadata |
| `page.url` | string | yes | Full URL of the current document |
| `page.title` | string | yes | Current page title |
| `device.type` | string | yes | Device category such as `desktop`, `tablet`, or `mobile` |
| `device.browser` | string | yes | Browser name |
| `device.os` | string | yes | Operating system |
| `referrer` | string or null | yes | Page referrer or null |
| `properties` | object | no | Arbitrary JSON object; populated for custom events and empty for automatic events |

## Event types

### `session_start` (automatic)

A new browser session begins and the SDK emits this event automatically.

- `event_type`: `"session_start"`
- `name`: omitted or `"session_start"` in practice for the SDK’s internal naming shape
- `payload.properties`: empty object

### `page_view` (automatic)

The SDK emits this event whenever a page loads or becomes active.

- `event_type`: `"page_view"`
- `name`: omitted or `"page_view"` in practice for the SDK’s internal naming shape
- `payload.properties`: empty object

### `custom` (user-defined)

The SDK emits custom events through `track(name, properties)`.

- `event_type`: `"custom"`
- `name`: required, custom event name
- `payload.properties`: object containing arbitrary JSON

## Example payloads

### `session_start`

```json
{
  "event_id": "4c0ad1f4-54f7-4f4f-8d6d-9de5f3ed9ca1",
  "site_id": "site_demo",
  "session_id": "sess_8b5f5ecf",
  "event_type": "session_start",
  "event_time": "2026-08-30T12:00:00Z",
  "schema_version": 1,
  "source": "rift-cmp-sdk/0.1.0",
  "payload": {
    "page": {
      "url": "https://example.com/products",
      "title": "Products"
    },
    "device": {
      "type": "desktop",
      "browser": "Chrome",
      "os": "Windows"
    },
    "referrer": "https://example.com/landing",
    "properties": {}
  }
}
```

### `custom`

```json
{
  "event_id": "9d47d2a6-6b78-4d12-bb09-e65ec6d3b2a9",
  "site_id": "site_demo",
  "session_id": "sess_8b5f5ecf",
  "event_type": "custom",
  "name": "signup_started",
  "event_time": "2026-08-30T12:03:15Z",
  "schema_version": 1,
  "source": "rift-cmp-sdk/0.1.0",
  "payload": {
    "page": {
      "url": "https://example.com/signup",
      "title": "Sign up"
    },
    "device": {
      "type": "mobile",
      "browser": "Safari",
      "os": "iOS"
    },
    "referrer": "https://example.com/landing",
    "properties": {
      "plan": "pro",
      "source": "checkout_banner"
    }
  }
}
```

## Versioning

- The initial schema version is `1`.
- Backward-compatible additions should not silently break the event contract; they must still remain readable by the API and downstream database consumers.
- Breaking schema changes require a coordinated rollout and a bump to `schema_version`.
- This schema is the shared artifact both sides must agree on before any change is merged.
