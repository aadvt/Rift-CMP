# Integration Contract

This is the contract between Rift-CMP’s SDK/API/database side and the other side of the platform: analytics, dashboarding, and consent engine. It defines the responsibilities and the exact shared artifacts that must stay aligned.

## System boundary

| Concern | Owned by our side | Owned by other side |
| --- | --- | --- |
| SDK event generation | ✅ | — |
| Event ingestion API | ✅ | — |
| Tenancy model and credential issuance | ✅ | — |
| Site management API | ✅ | — |
| Database storage and schema | ✅ | — |
| Consent record: principals, purposes, policies, notices, decisions | ✅ | — |
| Consent API and append-only audit trail | ✅ | — |
| Headless SDK consent client (`analytics.consent`) | ✅ | — |
| Analytics dashboards | — | ✅ |
| Compliance engine (which purposes need consent, in which jurisdiction, for how long) | — | ✅ |
| Consent UX: banners, preference centres | — | ✅ |
| Event schema definition | shared | shared |
| Consent vocabulary definition | shared | shared |
| API contract definition | shared | shared |

## Explicit ownership

Our side is responsible for:
- SDK instrumentation that sends `page_view`, `session_start`, and custom events
- API ingestion endpoints under `app/api/`
- the organisation/website ownership model, credential issuance, and authorisation
- database storage for organisations, websites, sessions, and events
- database storage for the consent domain, and the guarantee that a recorded
  decision is never rewritten
- the headless SDK consent client: identity, transport, caching — no UI
- ensuring the event envelope, the consent vocabulary and the API contract are
  implemented correctly

The other side is responsible for:
- analytics processing and reporting
- dashboarding, consent UX, and consent enforcement
- **the compliance engine.** We record structure and no legal rules: no retention
  periods, no jurisdiction logic, no "analytics requires consent" policy. That
  engine sits above the vocabulary in [consent.md](consent.md), reading it rather
  than being embedded in it. Deciding whether a given `WITHDRAWN` decision must
  stop a given piece of processing is that side's call.
- any downstream business logic that reads the database and derives insights
- **scoping every read by tenant.** Because that side queries the database
  directly rather than through our API, our authorisation layer is not in the
  path. The ownership model those queries must respect is in [tenancy.md](tenancy.md).

## Shared artifact: event schema

The single shared contract is the event schema defined in [event-schema.md](event-schema.md). This is the canonical artifact that both teams must agree on before changing anything. It includes:

- top-level fields: `event_id`, `site_id`, `session_id`, `event_type`, `name`, `event_time`, `schema_version`, `source`, `payload`
- automatic events: `page_view` and `session_start`
- custom events: `track(name, properties)`
- `payload.page`, `payload.device`, `payload.referrer`, and optional `payload.properties`
- no `public_key` field inside the event payload; the public key lives in the HTTP `Authorization` header

The SDK and API must implement the same schema without drift. The analytics side must read the database using the same semantics.

## Shared artifact: consent vocabulary

The second shared contract is the consent vocabulary defined in
[consent.md](consent.md) and typed in [`../shared/consent.ts`](../shared/consent.ts).
This is what the compliance engine will be built on, so it must not drift:

- the seven models and their scoping: **organisation = data fiduciary** owns
  purposes, policies, policy versions and notices; **site** owns principals and
  consent records
- `ConsentStatus` is `GRANTED | DENIED | WITHDRAWN`. Only `GRANTED` means
  processing is permitted, and **absence of a decision is not permission**.
  `WITHDRAWN` and `DENIED` are distinct on purpose and must stay distinguishable.
- `resolveEffectiveConsent()` is the single definition of "effective consent":
  newest record per `(principal, purpose)`, ordered by `decided_at`, then
  `recorded_at`, then id. The API and the SDK both call this exact function.
  Anything reading the database directly must reproduce the same derivation.
- current state is **derived, never stored**. There is no "is granted" column, and
  a consumer must not add one.
- `consent_records` is append-only. A `UPDATE` is refused by a database trigger.
- these models encode structure and **no legal rules**

The consent domain is kept separate from the analytics domain: nothing in the
consent schema references `Session` or `Event`, and no consent flag is written
onto analytics rows. The link, when needed, is through `Principal`. Neither side
should denormalise one into the other.

## API contract

The ingestion API contract is defined in [api-spec.md](api-spec.md). The current live surface is:

- `POST /api/v1/events` accepts one event or `{ "events": [...] }`, authenticated
  by a **site public key** (`pk_...`)
- `POST /api/v1/consent` appends one consent decision, and `GET /api/v1/consent`
  returns the effective state of **one** principal — both authenticated by a
  **site public key** (`pk_...`)
- `GET /api/v1/organisation`, `GET|POST /api/v1/sites`, `GET|PATCH /api/v1/sites/{siteId}`
  are the management surface, authenticated by an **organisation secret key** (`sk_...`)
- `GET /api/v1/consent/history` (the audit trail), `GET|POST /api/v1/purposes`,
  `GET|POST /api/v1/policies`, `POST /api/v1/policies/{policyId}/versions` and
  `GET|POST /api/v1/notices` are also management, for the same reason: a public
  key is visible in page source and must not be able to enumerate principals,
  read history, or invent reference data
- `GET /api/healthz` is the unauthenticated health check endpoint
- the two credentials are never interchangeable; using one on the other plane is `401`
- invalid keys return `401`, inactive sites `403`, another tenant's site `404`
- an event whose `site_id` is not the authenticated site is rejected as `site_mismatch`
- CORS is enabled for ingestion; the management plane intentionally sends none
- There is no analytics query API in the MVP

## Read API status

A read API may be added later if the analytics/dashboard team explicitly needs it. That is outside scope until requested, and any such addition must be reviewed as part of the same integration contract before implementation.

## Database access model

For the MVP, the analytics/dashboard side reads the database directly, not through a dedicated read endpoint. This separation keeps the API focused on ingestion and preserves a simple first version of the platform.

## Tenancy guarantees

These are part of the contract and must not regress:

- A credential authenticated for Site A cannot read, create, modify or impersonate
  data belonging to Site B - including a sibling site in the same organisation.
- The tenant is derived from the credential alone. `site_id` in a request body and
  `siteId` in a URL are validated against it, never used to select it.
- Ownership (`organisation_id`) and key material (`public_key`) are server-assigned
  and are not mutable over the API.
- The database enforces the same rules independently, so a bug in the API layer
  cannot by itself produce cross-tenant rows.
- The same guarantees extend to consent. Composite foreign keys tie every consent
  reference into one tenant, so a decision can never cite another organisation's
  purpose, notice or policy version, and the same `external_id` on two sites is
  two separate principals.
- A recorded consent decision is never rewritten. This is enforced by a database
  trigger, not by convention, and must not be relaxed.

These properties are covered by automated tests; see `api/tests/`.

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
| 2026-08-31 | Added organisation tenancy, public/secret key separation, the site management plane, and tenant-isolation guarantees. Event envelope unchanged; `site_id` is now validated against the authenticating key. | v1 | — |
| 2026-08-31 | Phase 2: added the consent domain — principals, purposes, policies, policy versions, notices and an append-only consent record — plus `POST\|GET /api/v1/consent` on the browser plane and `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices` on the management plane, and a headless `analytics.consent` SDK client. The consent vocabulary in [consent.md](consent.md) becomes a shared artifact: it encodes structure and no legal rules, and is the base the compliance engine is expected to be built on. Event envelope and analytics tables unchanged; the two domains are not joined. | v1 | — |
