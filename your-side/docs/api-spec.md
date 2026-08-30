# API Spec

Public HTTP API exposed by `api/`. This is a contract document; keep it in sync
with the implementation and with the OpenAPI file when one exists.

## Base

- Base URL: `https://api.example.com/v1`
- Content type: `application/json`
- Auth: `Authorization: Bearer <token>`

## Conventions

- All request/response bodies are JSON.
- Errors use a consistent shape:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "human readable description",
    "details": []
  }
}
```

- Standard status codes: `200`, `201`, `202`, `400`, `401`, `403`, `404`,
  `409`, `422`, `429`, `500`.

## Endpoints

### `POST /events`

Ingest a batch of events.

**Request**

```json
{
  "events": [ { /* event envelope, see event-schema.md */ } ]
}
```

**Response** `202 Accepted`

```json
{
  "accepted": 10,
  "rejected": 0,
  "errors": []
}
```

### `GET /events`

Query stored events.

| Query param   | Type    | Description                          |
|---------------|---------|--------------------------------------|
| `event_type`  | string  | Filter by type                       |
| `since`       | string  | RFC 3339 lower bound (inclusive)     |
| `until`       | string  | RFC 3339 upper bound (exclusive)     |
| `limit`       | integer | Page size (default 100, max 1000)    |
| `cursor`      | string  | Opaque pagination cursor             |

**Response** `200 OK`

```json
{
  "data": [ { /* event */ } ],
  "next_cursor": "..."
}
```

### `GET /healthz`

Liveness/readiness probe. Returns `200 OK` with `{ "status": "ok" }`.

## Rate limiting

- `429 Too Many Requests` with `Retry-After` header when exceeded.

## Versioning

- Version is in the path (`/v1`).
- Backwards-compatible changes ship in place; breaking changes get a new path
  segment and a deprecation window.
