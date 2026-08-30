# Integration Contract

This is the contract between Rift-CMP’s SDK/API/database side and the other side of the platform: analytics, dashboarding, and consent engine. It defines the responsibilities and the exact shared artifacts that must stay aligned.

## System boundary

| Concern | Owned by our side | Owned by other side |
| --- | --- | --- |
| SDK event generation | ✅ | — |
| Event ingestion API | ✅ | — |
| Database storage and schema | ✅ | — |
| Analytics dashboards | — | ✅ |
| Consent engine and UX | — | ✅ |
| Event schema definition | shared | shared |
| API contract definition | shared | shared |

## Explicit ownership

Our side is responsible for:
- SDK instrumentation that sends `page_view`, `session_start`, and custom events
- API ingestion endpoints under `app/api/`
- database storage for websites, sessions, and events
- ensuring the event envelope and API contract are implemented correctly

The other side is responsible for:
- analytics processing and reporting
- dashboarding and consent behavior
- any downstream business logic that reads the database and derives insights

## Shared artifact: event schema

The single shared contract is the event schema defined in [event-schema.md](event-schema.md). This is the canonical artifact that both teams must agree on before changing anything. It includes:

- top-level fields: `event_id`, `site_id`, `session_id`, `event_type`, `name`, `event_time`, `schema_version`, `source`, `payload`
- automatic events: `page_view` and `session_start`
- custom events: `track(name, properties)`
- `payload.page`, `payload.device`, `payload.referrer`, and optional `payload.properties`
- no `public_key` field inside the event payload; the public key lives in the HTTP `Authorization` header

The SDK and API must implement the same schema without drift. The analytics side must read the database using the same semantics.

## API contract

The ingestion API contract is defined in [api-spec.md](api-spec.md). The current live surface is:

- `POST /api/v1/events` accepts one event or `{ "events": [...] }`
- `GET /api/healthz` is the health check endpoint
- requests require `Authorization: Bearer <public_key>`
- invalid keys return `401`, inactive sites return `403`
- CORS is enabled for browser traffic and `OPTIONS` preflight requests are handled
- There is no analytics query API in the MVP

## Read API status

A read API may be added later if the analytics/dashboard team explicitly needs it. That is outside scope until requested, and any such addition must be reviewed as part of the same integration contract before implementation.

## Database access model

For the MVP, the analytics/dashboard side reads the database directly, not through a dedicated read endpoint. This separation keeps the API focused on ingestion and preserves a simple first version of the platform.

## Compatibility rules

- Schema changes must be reviewed by both teams before implementation.
- Breaking changes require a version bump in `schema_version` and coordinated rollout.
- New optional fields must not silently break compatibility.
- Changes to the API and schema must be reflected in the shared documentation before they are shipped.
- Batch payload behavior is part of the live contract: the SDK sends `{ "events": [...] }` in a single request, and the API treats duplicates within the same batch idempotently via `event_id`.

## Cross-origin requirement

Because the SDK runs on arbitrary customer domains, the API must support browser-based cross-origin requests. This means handling `OPTIONS` preflight requests and returning the proper CORS headers, including `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, and `Access-Control-Allow-Headers`. Same-origin traffic does not need the same treatment, but cross-origin traffic does.

## Change log

| Date | Change | Version | Approved by |
| --- | --- | --- | --- |
| 2026-08-30 | Initial contract for SDK/API/database split, shared event schema, bearer auth, and batch ingestion | v1 | — |
