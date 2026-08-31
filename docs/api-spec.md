# API Spec

The public HTTP surface exposed by the Rift-CMP API service. In this repo the app
lives under `app/api/` because it is a Next.js App Router project.

The API has **two planes**, with separate credentials that are never
interchangeable. See [tenancy.md](tenancy.md) for the full ownership model.

| Plane | Base path | Credential | Purpose |
| --- | --- | --- | --- |
| Ingestion | `/api/v1/events`, `/api/v1/consent` | site public key `pk_...` | append events, record consent decisions, read one principal's state |
| Management | `/api/v1/organisation`, `/api/v1/sites`, `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices` | organisation secret key `sk_...` | read/modify that org's sites, consent reference data, and the audit trail |

The consent domain is split across the same two planes, for the reason set out in
[consent.md](consent.md): a public key is visible to anyone viewing page source,
so it may record a decision and read the state of one principal whose id it
already knows, but it may never enumerate principals or read history.

## Conventions

- Request and response bodies are JSON.
- Authentication is `Authorization: Bearer <key>` on both planes.
- **The credential determines the tenant.** No URL or body field is ever trusted
  to select a site or an organisation.
- Errors share one shape:

```json
{ "error": { "code": "unauthorized", "message": "...", "details": [] } }
```

`code` values are stable and typed in `shared/api.ts`; branch on them rather than
on status codes or messages. The consent domain added these:

| `code` | Meaning |
| --- | --- |
| `unknown_purpose` | No such purpose in the caller's organisation, or a cited notice never disclosed it |
| `unknown_notice` | No such notice in the caller's organisation |
| `unknown_policy` | No such policy version in the caller's organisation |
| `conflict` | A code or version that must be unique already exists |

## CORS

The ingestion endpoints — `/api/v1/events` and `/api/v1/consent` — are called by
browsers on arbitrary customer domains, so they return permissive CORS headers
and handle `OPTIONS` preflight.

The management plane deliberately returns **no** CORS headers: it is a
server-to-server API authenticated with a secret that must never be present in a
browser.

---

## Ingestion

### `POST /api/v1/events`

Accepts one event or a batch of events for the site identified by the public key.

#### Authentication

```http
Authorization: Bearer pk_demo_12345
```

Because `navigator.sendBeacon` cannot set headers, this endpoint *also* accepts
the public key as a query parameter, used by the SDK on page unload:

```http
POST /api/v1/events?pk=pk_demo_12345
```

This is safe only because public keys are not secrets. An `sk_...` key presented
either way is rejected with `401`.

#### Request

Single event:

```json
{
  "event_id": "c4c7ca2f-4100-4d7f-8339-4ebf7ab7d311",
  "site_id": "site_demo",
  "session_id": "sess_8b5f5ecf",
  "event_type": "page_view",
  "event_time": "2026-08-30T12:00:00Z",
  "schema_version": 1,
  "source": "rift-cmp-sdk/1.0.0",
  "payload": {
    "page": { "url": "https://example.com/products", "title": "Products" },
    "device": { "type": "desktop", "browser": "Chrome", "os": "Windows" },
    "referrer": "https://example.com/landing"
  }
}
```

Batch payload: `{ "events": [ ... ] }`.

`site_id` remains a required envelope field, but it is **validated, not trusted**:
it must equal the site the public key resolves to. Any other value rejects that
event with `site_mismatch`. This keeps the event contract unchanged while making
the server authoritative about ownership.

#### Response

`202 Accepted`:

```json
{ "accepted": 1, "rejected": 0, "errors": [] }
```

Ingestion is idempotent on `event_id`. Replaying a batch — which the SDK does on
retry, and `sendBeacon` can do on a double-fire — is a no-op rather than a
duplicate row. Events are an immutable log, so the first write of an `event_id`
wins and later copies are ignored.

#### Errors

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `403` | `forbidden` | key is valid but the site is inactive |
| `400` | `invalid_json` | body is not valid JSON |
| `400` | `invalid_request` | every event in the batch was rejected |
| `202` | — | at least one event accepted; rejects listed in `errors[]` |

Per-event rejection codes reported in `errors[]`:

| `code` | Meaning |
| --- | --- |
| `invalid_event` | failed schema validation |
| `duplicate_event` | `event_id` repeated within the same batch |
| `site_mismatch` | `site_id` is not the authenticated site |
| `session_conflict` | `session_id` belongs to a different site |

Authentication is checked **before** the body is read, so an unauthenticated
request with a malformed body still returns `401`.

### `POST /api/v1/consent`

Appends one immutable consent decision for a principal on the authenticated site.
Nothing is ever updated: changing your mind appends a new record.

#### Authentication

```http
Authorization: Bearer pk_demo_12345
```

`OPTIONS` preflight is handled. An `sk_...` key is rejected with `401`; an
inactive site is `403`.

#### Request

Strict schema — unknown fields are a `400`:

```json
{
  "principal_external_id": "p_3f9c",
  "principal_kind": "anonymous",
  "purpose_code": "analytics",
  "status": "GRANTED",
  "notice_id": "3a1e6b52-2f0c-4f2e-9c1a-7d3f0b8e4a11",
  "policy_version_id": "9c04b1de-5a8c-4c33-8f6a-19b2d0c7e5aa",
  "decided_at": "2026-08-31T09:00:00Z",
  "source": "sdk",
  "metadata": { "surface": "banner" }
}
```

Only `principal_external_id`, `purpose_code` and `status` are required.

| Field | Notes |
| --- | --- |
| `principal_external_id` | 1–200 chars. Opaque; the SDK sends a `crypto.randomUUID()`. The principal is created on first use and reused afterwards. |
| `principal_kind` | Optional, defaults to `anonymous`. |
| `purpose_code` | Must be a purpose of the authenticated site's organisation. |
| `status` | One of `GRANTED`, `DENIED`, `WITHDRAWN`. |
| `notice_id` | Optional UUID. Must be the caller's own notice **and** must have disclosed `purpose_code`. |
| `policy_version_id` | Optional UUID. If omitted and a notice is given, it is derived from the notice. |
| `decided_at` | Optional RFC3339. Defaults to now. May not be more than 5 minutes in the future. |
| `source` | Optional, defaults to `sdk` on this endpoint. |
| `metadata` | Optional free-form JSON. Never legal rules. |

`site_id` and `organisation_id` are **absent by design** — the tenant comes from
the credential, so sending one is a validation error rather than a silently
ignored field.

#### Response

`201 Created`, carrying the recomputed effective state so a client needs only one
call:

```json
{
  "record": {
    "consent_record_id": "6b1c0f2a-...",
    "site_id": "site_demo",
    "principal_external_id": "p_3f9c",
    "purpose_code": "analytics",
    "status": "GRANTED",
    "notice_id": "3a1e6b52-...",
    "policy_version_id": "9c04b1de-...",
    "source": "sdk",
    "decided_at": "2026-08-31T09:00:00.000Z",
    "recorded_at": "2026-08-31T09:00:00.412Z",
    "metadata": { "surface": "banner" }
  },
  "effective": [
    {
      "purpose_code": "analytics",
      "status": "GRANTED",
      "decided_at": "2026-08-31T09:00:00.000Z",
      "consent_record_id": "6b1c0f2a-...",
      "notice_id": "3a1e6b52-...",
      "policy_version_id": "9c04b1de-..."
    }
  ]
}
```

#### Errors

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `403` | `forbidden` | key is valid but the site is inactive |
| `400` | `invalid_json` | body is not valid JSON |
| `400` | `invalid_request` | schema failure, unknown field, or `decided_at` in the future |
| `400` | `unknown_purpose` | no such purpose in this organisation, **or** the given notice never disclosed it |
| `400` | `unknown_notice` | no such notice in this organisation |
| `400` | `unknown_policy` | no such policy version in this organisation |

Reference data belonging to another organisation is reported exactly like data
that does not exist.

### `GET /api/v1/consent`

The decision currently in force for each purpose, for **one** principal on the
authenticated site.

```http
GET /api/v1/consent?principal_external_id=p_3f9c
Authorization: Bearer pk_demo_12345
```

`200 OK`:

```json
{
  "site_id": "site_demo",
  "principal_external_id": "p_3f9c",
  "purposes": [
    {
      "purpose_code": "analytics",
      "status": "WITHDRAWN",
      "decided_at": "2026-08-31T11:30:00.000Z",
      "consent_record_id": "b21d4e70-...",
      "notice_id": null,
      "policy_version_id": null
    }
  ]
}
```

One entry per purpose, newest decision wins, computed by
`resolveEffectiveConsent` in `shared/consent.ts` — the same function the SDK
uses, so the two cannot disagree.

A principal that has never been seen returns `purposes: []`, **not** `404`. "No
decision recorded" is the normal state for a first-time visitor, absence of a
decision already means "not granted", and a `404` would turn the endpoint into an
oracle for whether a principal id exists.

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `403` | `forbidden` | key is valid but the site is inactive |
| `400` | `invalid_request` | `principal_external_id` missing or empty |

---

## Management

All management endpoints require an organisation secret key:

```http
Authorization: Bearer sk_2f8c...
```

A site public key is rejected with `401`. A site belonging to another organisation
returns `404`, never `403` — see "Existence non-disclosure" in
[tenancy.md](tenancy.md).

### `GET /api/v1/organisation`

Returns the organisation the presented key belongs to.

```json
{
  "organisation_id": "org_acme",
  "name": "Acme Analytics",
  "slug": "acme",
  "created_at": "2026-08-31T12:00:00.000Z"
}
```

Key material is never included in any response.

### `GET /api/v1/sites`

Lists every site owned by the authenticated organisation, and only those.

```json
{
  "sites": [
    {
      "site_id": "site_demo",
      "organisation_id": "org_acme",
      "name": "Demo Website",
      "domain": "demo.example.com",
      "public_key": "pk_demo_12345",
      "is_active": true,
      "created_at": "2026-08-31T12:00:00.000Z"
    }
  ]
}
```

`public_key` is returned in plaintext on purpose: it is a public identifier its
owner needs in order to install the SDK.

### `POST /api/v1/sites`

Creates a site owned by the authenticated organisation and mints its public key.

Request body (strict — unknown fields are a `400`):

```json
{ "name": "Acme Blog", "domain": "blog.acme.example" }
```

Responds `201` with the `WebsiteSummary` shape above. Ownership comes from the
credential; sending `organisation_id` is a validation error, not a silent no-op.

### `GET /api/v1/sites/{siteId}`

Returns one owned site, or `404` if it is not owned by the caller.

### `PATCH /api/v1/sites/{siteId}`

Updates an owned site. Only these fields are accepted, under a strict schema:

```json
{ "name": "New name", "domain": "new.example.com", "is_active": false }
```

`organisation_id`, `site_id` and `public_key` are **not** mutable; sending them
returns `400`. Ownership and key material are server-assigned.

### `GET /api/v1/consent/history`

The complete consent audit trail for the authenticated organisation, newest
first. This is an operator capability, which is why it needs the secret key: a
site public key can only read the single principal it already has the id for.

Optional query parameters, all of which **narrow within** the tenant and can
never widen beyond it:

| Parameter | Notes |
| --- | --- |
| `site_id` | Must be a site the caller owns, else `404` |
| `principal_external_id` | Exact match |
| `purpose_code` | Exact match |
| `limit` | Integer 1–1000, default 500 |

```http
GET /api/v1/consent/history?principal_external_id=p_3f9c
Authorization: Bearer sk_2f8c...
```

`200 OK`:

```json
{
  "records": [
    {
      "consent_record_id": "b21d4e70-...",
      "site_id": "site_demo",
      "principal_external_id": "p_3f9c",
      "purpose_code": "analytics",
      "status": "WITHDRAWN",
      "notice_id": null,
      "policy_version_id": null,
      "source": "sdk",
      "decided_at": "2026-08-31T11:30:00.000Z",
      "recorded_at": "2026-08-31T11:30:00.318Z",
      "metadata": null
    },
    {
      "consent_record_id": "6b1c0f2a-...",
      "site_id": "site_demo",
      "principal_external_id": "p_3f9c",
      "purpose_code": "analytics",
      "status": "GRANTED",
      "notice_id": "3a1e6b52-...",
      "policy_version_id": "9c04b1de-...",
      "source": "sdk",
      "decided_at": "2026-08-31T09:00:00.000Z",
      "recorded_at": "2026-08-31T09:00:00.412Z",
      "metadata": { "surface": "banner" }
    }
  ]
}
```

Both records survive the withdrawal. `consent_records` is append-only, enforced
by a database trigger — see [consent.md](consent.md).

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `400` | `invalid_request` | `limit` is not an integer between 1 and 1000 |
| `404` | `not_found` | `site_id` names a site the caller does not own |

An out-of-range `limit` is rejected rather than silently clamped, so a caller is
never quietly given a different page size than it asked for.

### `GET /api/v1/purposes`

Lists the authenticated organisation's purposes, ordered by `code`. Purposes are
organisation-scoped reference data, shared across all of that organisation's
sites — a fiduciary declares "analytics" once.

```json
{
  "purposes": [
    {
      "purpose_id": "1d2a...",
      "code": "analytics",
      "name": "Product analytics",
      "description": "Understand how visitors use the site.",
      "is_active": true,
      "created_at": "2026-08-31T12:00:00.000Z"
    }
  ]
}
```

### `POST /api/v1/purposes`

Request body (strict):

```json
{
  "code": "marketing",
  "name": "Marketing communication",
  "description": "Personalised marketing and remarketing."
}
```

`code` must match `^[a-z0-9_-]+$`. Responds `201` with the purpose object above
(unwrapped).

| Status | `code` | Cause |
| --- | --- | --- |
| `400` | `invalid_request` | schema failure, or an unknown field such as `organisation_id` |
| `409` | `conflict` | a purpose with that `code` already exists in this organisation |

### `GET /api/v1/policies`

Lists the organisation's policies with their versions, ordered by `code`, each
version ordered by `published_at`.

```json
{
  "policies": [
    {
      "policy_id": "7f31...",
      "code": "privacy-policy",
      "name": "Privacy Policy",
      "created_at": "2026-08-31T12:00:00.000Z",
      "versions": [
        {
          "policy_version_id": "9c04b1de-...",
          "policy_id": "7f31...",
          "policy_code": "privacy-policy",
          "version": "1.0.0",
          "document_url": "https://example.com/privacy/1.0.0",
          "content_hash": null,
          "published_at": "2026-08-31T12:00:00.000Z"
        }
      ]
    }
  ]
}
```

### `POST /api/v1/policies`

Creates a policy **together with its first version** — a policy with no version
cannot be referenced by a consent record.

Request body (strict):

```json
{
  "code": "privacy-policy",
  "name": "Privacy Policy",
  "version": "1.0.0",
  "document_url": "https://example.com/privacy/1.0.0",
  "content_hash": "sha256:..."
}
```

`document_url` and `content_hash` are optional. Responds `201` with the policy
object above.

| Status | `code` | Cause |
| --- | --- | --- |
| `400` | `invalid_request` | schema failure or unknown field |
| `409` | `conflict` | a policy with that `code` already exists in this organisation |

### `POST /api/v1/policies/{policyId}/versions`

Publishes a new version of an existing policy.

```json
{ "version": "1.1.0", "document_url": "https://example.com/privacy/1.1.0" }
```

Responds `201` with a policy-version object. There is no update or delete route
for a version: consent records point at the version that was in force when a
decision was made, so editing one in place would silently rewrite what a
principal agreed to.

| Status | `code` | Cause |
| --- | --- | --- |
| `400` | `invalid_request` | schema failure or unknown field |
| `409` | `conflict` | that `version` already exists on this policy |
| `404` | `not_found` | the policy is not owned by the caller |

### `GET /api/v1/notices`

Lists the organisation's notices, oldest first, each with the purpose codes it
disclosed.

```json
{
  "notices": [
    {
      "notice_id": "3a1e6b52-...",
      "version": "notice-1",
      "locale": "en",
      "policy_version_id": "9c04b1de-...",
      "published_at": "2026-08-31T12:00:00.000Z",
      "purpose_codes": ["analytics", "marketing"]
    }
  ]
}
```

### `POST /api/v1/notices`

Records what was actually shown to a principal: one policy version, one locale, a
set of disclosed purposes.

```json
{
  "policy_version_id": "9c04b1de-...",
  "version": "notice-2",
  "locale": "en",
  "purpose_codes": ["analytics", "marketing"]
}
```

`locale` defaults to `en`. `purpose_codes` must be non-empty; duplicates are
collapsed. Responds `201` with the notice object above.

The disclosed set is enforced later: `POST /api/v1/consent` rejects a decision
that cites this notice for a purpose it never disclosed.

| Status | `code` | Cause |
| --- | --- | --- |
| `400` | `invalid_request` | schema failure or unknown field |
| `400` | `unknown_policy` | `policy_version_id` is not the caller's |
| `400` | `unknown_purpose` | one or more `purpose_codes` are not the caller's |

---

## `GET /api/healthz`

Unauthenticated liveness check.

```json
{ "status": "ok" }
```

## Notes on scope

- There are no analytics or reporting endpoints. The analytics/dashboard team
  reads the database directly for now.
- The consent surface records and reads decisions; it enforces nothing. There is
  no compliance engine, no consent UI, and no endpoint that answers "is this
  processing lawful". See [consent.md](consent.md).
- Consent reference data has no update or delete routes. Purposes, policies,
  versions and notices can be created and listed only.
- Organisations are provisioned out of band (seed script or the
  `createOrganisation()` helper), not over HTTP — there is no credential that
  could authenticate creating a tenant.
- If a read API is added later it must be reviewed as part of the integration
  contract, and must scope every query to the authenticated tenant.

## Versioning

- The API is versioned in the path as `/api/v1`.
- Breaking API changes require a new versioned route, not an in-place change.
- The underlying event schema remains the shared artifact both teams depend on.
