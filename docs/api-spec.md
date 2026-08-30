# API Spec

This document describes the public HTTP surface exposed by the Rift-CMP API service. In this repo, the app lives under `app/api/` because it is a Next.js App Router project.

## Base

- Base path: `/api/v1`
- Content type: `application/json`
- This is a pure ingestion API; there are no reporting endpoints in the MVP.

## Conventions

- Request and response bodies are JSON.
- The SDK batches events in memory and sends them to the API as `{ "events": [...] }` by default, but the API still accepts either a single event or a batch payload.
- The API must support cross-origin requests from arbitrary customer domains.
- CORS must be enabled for browser-based calls and `OPTIONS` preflight requests must be handled.

## CORS requirements

Because the SDK executes on customer websites and those domains are outside the API origin, browser requests require CORS support. The API must respond to preflight requests with the appropriate `Access-Control-Allow-*` headers, including the allowed origin, methods, and headers used by the SDK.

This is required for browser-to-API calls from arbitrary domains and is not necessary for same-origin requests.

## Endpoints

### `POST /api/v1/events`

Accept one event or a batch of events.

#### Request

Authentication is required for every request using the site’s public key:

```http
Authorization: Bearer pk_demo_12345
```

The API validates the request against the combination of `site_id` and the matching `public_key` stored on the website record.

Single event:

```json
{
  "event_id": "c4c7ca2f-4100-4d7f-8339-4ebf7ab7d311",
  "site_id": "site_123",
  "session_id": "sess_8b5f5ecf",
  "event_type": "page_view",
  "event_time": "2026-08-30T12:00:00Z",
  "schema_version": 1,
  "source": "rift-cmp-sdk/1.0.0",
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
    "referrer": "https://example.com/landing"
  }
}
```

Batch payload:

```json
{
  "events": [
    {
      "event_id": "...",
      "site_id": "site_123",
      "session_id": "sess_8b5f5ecf",
      "event_type": "session_start",
      "event_time": "2026-08-30T12:00:00Z",
      "schema_version": 1,
      "source": "rift-cmp-sdk/1.0.0",
      "payload": {
        "page": {
          "url": "https://example.com",
          "title": "Home"
        },
        "device": {
          "type": "desktop",
          "browser": "Firefox",
          "os": "macOS"
        },
        "referrer": null
      }
    }
  ]
}
```

#### Response

`202 Accepted` on success.

```json
{
  "accepted": 1,
  "rejected": 0,
  "errors": []
}
```

The SDK batches multiple payloads together, so a normal browser request may contain up to 10 queued events and is flushed on a 2-second cadence. The API treats each event idempotently, so duplicate `event_id` values within the same batch are ignored after the first accepted item.

#### Error behavior

- Invalid JSON or invalid event payloads should return `400`.
- Duplicate or malformed events may be rejected and reflected in `rejected` / `errors` in the batch response.
- The API should validate the event envelope against the schema described in [event-schema.md](event-schema.md).

### `GET /api/healthz`

Health check endpoint for liveness and readiness.

#### Response

`200 OK`

```json
{
  "status": "ok"
}
```

## Notes on scope

- This API does not include analytics queries or reporting endpoints.
- The analytics/dashboard team reads from the database directly for now.
- If a read API is needed later, it will be added only when explicitly requested and after an integration contract review.

## Versioning

- The API is versioned in the path as `/api/v1`.
- Breaking API changes require a new versioned route, not an in-place change to the existing contract.
- The underlying event schema remains the shared artifact that both teams depend on.
