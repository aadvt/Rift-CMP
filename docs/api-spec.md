# API Spec

The public HTTP surface exposed by the Rift-CMP API service. In this repo the app
lives under `app/api/` because it is a Next.js App Router project.

The API has **three planes**, with separate credentials that are never
interchangeable. See [tenancy.md](tenancy.md) for the full ownership model.

| Plane | Base path | Credential | Purpose |
| --- | --- | --- | --- |
| Ingestion | `/api/v1/events`, `/api/v1/consent` | site public key `pk_...` | append events, record consent decisions, read one principal's state |
| Management | `/api/v1/organisation`, `/api/v1/sites`, `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices`, `/api/v1/recipients`, `/api/v1/transfers` | organisation secret key `sk_...` | read/modify that org's sites, consent reference data and the audit trail; register recipients; authorise and submit transfers; read its own transfer metadata |
| Delivery | `/api/v1/transfers/{transferId}/envelope` | recipient delivery key `rk_...` | collect sealed envelopes addressed to one recipient, and nothing else |

Each credential is **prefix-checked before any database lookup**, so no plane can
be probed with another plane's credential. Presenting the wrong prefix is a `401`
that looks identical to an unknown key.

The consent domain is split across the ingestion and management planes, for the
reason set out in [consent.md](consent.md): a public key is visible to anyone
viewing page source, so it may record a decision and read the state of one
principal whose id it already knows, but it may never enumerate principals or
read history.

The delivery plane is the narrowest of the three, and it is worth being precise
about what it does and does not confer. It authorises *collecting ciphertext*
addressed to one recipient. It grants no ability to read that ciphertext:
decryption needs the recipient's X25519 private key, which Rift has never held.
See [secure-transfer.md](secure-transfer.md) — that surface is a proof of
concept and has had no cryptographic review.

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

Secure data routing added these:

| `code` | Meaning |
| --- | --- |
| `unknown_recipient` | No **active** recipient with that code in the caller's organisation |
| `consent_not_granted` | The consent decision in force for that principal and purpose is not `GRANTED`, or there is none |
| `authorisation_expired` | The authorisation's `expires_at` has passed |
| `authorisation_consumed` | A transfer has already been recorded against that authorisation |
| `invalid_envelope` | The sealed envelope is malformed, empty, or over the size limit |

## CORS

The ingestion endpoints — `/api/v1/events` and `/api/v1/consent` — are called by
browsers on arbitrary customer domains, so they return permissive CORS headers
and handle `OPTIONS` preflight.

The management and delivery planes deliberately return **no** CORS headers: they
are server-to-server APIs authenticated with secrets that must never be present
in a browser.

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

### `GET /api/v1/recipients`

Lists the target fiduciaries the authenticated organisation may send data to,
ordered by `code`.

```json
{
  "recipients": [
    {
      "recipient_id": "2d51...",
      "code": "partner-bank",
      "name": "Partner Bank Ltd",
      "public_key": "MCowBQYDK2VuAyEA...",
      "algorithm": "X25519-HKDF-SHA256-AES256GCM",
      "is_active": true,
      "created_at": "2026-09-01T09:00:00.000Z"
    }
  ]
}
```

`public_key` is returned in plaintext because it *is* public — it is what a
source encrypts to. `delivery_key` is **not** in this response: only its digest
is stored, so it cannot be re-read after registration.

### `POST /api/v1/recipients`

Registers a target fiduciary and mints its delivery credential.

Request body (strict — unknown fields are a `400`):

```json
{
  "code": "partner-bank",
  "name": "Partner Bank Ltd",
  "public_key": "MCowBQYDK2VuAyEA..."
}
```

| Field | Notes |
| --- | --- |
| `code` | 1–100 chars, `^[a-z0-9_-]+$`. Unique within the organisation. |
| `name` | 1–200 chars. |
| `public_key` | 1–256 chars. The target's base64 SPKI X25519 public key, supplied out of band by the target. |

There is no field for a private key, and there is no request that would accept
one. `algorithm` is server-assigned to `X25519-HKDF-SHA256-AES256GCM`; a caller
does not choose the construction.

`201 Created` returns the recipient object above **plus** one extra field:

```json
{
  "recipient_id": "2d51...",
  "code": "partner-bank",
  "name": "Partner Bank Ltd",
  "public_key": "MCowBQYDK2VuAyEA...",
  "algorithm": "X25519-HKDF-SHA256-AES256GCM",
  "is_active": true,
  "created_at": "2026-09-01T09:00:00.000Z",
  "delivery_key": "rk_9f2c..."
}
```

`delivery_key` appears **only here**, exactly once, in the same way an
organisation secret does at provisioning. Rift stores its SHA-256 digest and
nothing else, so a lost delivery key cannot be recovered — only a new recipient
can be registered. Hand it to the target fiduciary out of band.

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `400` | `invalid_json` | body is not valid JSON |
| `400` | `invalid_request` | schema failure or unknown field |
| `409` | `conflict` | a recipient with that `code` already exists in this organisation |

### `POST /api/v1/transfers/authorisations`

Mints a single-use, time-bounded permission to transfer one principal's data to
one recipient for one purpose.

This request is **payload-free by construction**. Rift decides whether a transfer
may happen before any ciphertext exists, so the ciphertext can never influence
the decision. The schema is strict: sending `plaintext`, `data` or an envelope
here is a `400`, not something quietly ignored.

Request body:

```json
{
  "site_id": "site_demo",
  "principal_external_id": "p_3f9c",
  "purpose_code": "analytics",
  "recipient_code": "partner-bank",
  "ttl_seconds": 900
}
```

| Field | Notes |
| --- | --- |
| `site_id` | Must be a site the caller owns, else `404`. |
| `principal_external_id` | 1–200 chars. Must already exist on that site. |
| `purpose_code` | 1–100 chars. Must be a purpose of the caller's organisation. |
| `recipient_code` | 1–100 chars. Must be an **active** recipient of the caller's organisation. |
| `ttl_seconds` | Optional integer, 30–3600. Defaults to 900 (15 minutes). |

Consent is checked here, using the same `getEffectiveConsent` derivation the
consent API uses, so a transfer can never be authorised against a rule the
consent API would disagree with. The newest decision for `(principal, purpose)`
must resolve to `GRANTED`: `DENIED`, `WITHDRAWN` and *no decision at all* are all
refusals.

`201 Created`:

```json
{
  "authorisation_id": "8ad1f0c2-...",
  "site_id": "site_demo",
  "principal_external_id": "p_3f9c",
  "purpose_code": "analytics",
  "recipient_code": "partner-bank",
  "recipient_public_key": "MCowBQYDK2VuAyEA...",
  "algorithm": "X25519-HKDF-SHA256-AES256GCM",
  "consent_record_id": "6b1c0f2a-...",
  "nonce": "Zk8sT1x2...",
  "status": "AUTHORISED",
  "expires_at": "2026-09-01T09:15:00.000Z",
  "created_at": "2026-09-01T09:00:00.000Z"
}
```

The response carries everything a source needs to seal a payload and nothing
more: the public key to encrypt to, and the five fields that make up the
authenticated data — `authorisation_id`, `nonce`, `purpose_code`,
`recipient_code`, `principal_external_id`. `consent_record_id` names the exact
decision relied upon, not a boolean, so the authorisation stays auditable after
the fact.

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `400` | `invalid_json` | body is not valid JSON |
| `400` | `invalid_request` | schema failure, unknown field, or `ttl_seconds` out of range |
| `404` | `not_found` | `site_id` is not the caller's, or no such principal on that site |
| `404` | `unknown_purpose` | no such purpose in this organisation |
| `404` | `unknown_recipient` | no such recipient, or it is deactivated |
| `409` | `consent_not_granted` | consent is `DENIED`, `WITHDRAWN`, or was never recorded |

Note the split. Anything the caller *does not own* is `404`, matching the rest of
the API so ids cannot be probed across tenants — which is why `unknown_purpose`
is a `404` here while the same code is a `400` on `POST /api/v1/consent`. `409`
is used only for the one case where every identifier resolved and the answer is
simply "the principal has not permitted this".

### `POST /api/v1/transfers`

Submits a sealed envelope, consuming its authorisation.

Request body (strict, and strict on the nested envelope too):

```json
{
  "authorisation_id": "8ad1f0c2-...",
  "nonce": "Zk8sT1x2...",
  "envelope": {
    "ciphertext": "0mJ4v...",
    "iv": "aWQxMjM0NTY3ODkw",
    "auth_tag": "9wUyR1p0bWFjdGFn",
    "ephemeral_public_key": "MCowBQYDK2VuAyEA..."
  }
}
```

`.strict()` on both objects is doing real work: a client that attached
`plaintext` — by mistake or otherwise — gets a validation error rather than
having Rift quietly store it.

Rift validates the envelope for **shape and size only**: base64 that decodes to a
12-byte `iv` and a 16-byte `auth_tag`, a non-empty ciphertext of 1–262144 bytes,
and an `ephemeral_public_key` of at most 256 characters. It cannot check that the
envelope decrypts, because it cannot decrypt it. Authenticity is established by
the recipient when the GCM tag is verified.

`201 Created` returns routing metadata only — never the envelope:

```json
{
  "transfer_id": "c07e4b9a-...",
  "authorisation_id": "8ad1f0c2-...",
  "site_id": "site_demo",
  "purpose_code": "analytics",
  "recipient_code": "partner-bank",
  "principal_external_id": "p_3f9c",
  "consent_record_id": "6b1c0f2a-...",
  "status": "RECORDED",
  "ciphertext_sha256": "3f2a91...",
  "payload_bytes": 148,
  "recorded_at": "2026-09-01T09:00:04.117Z",
  "delivered_at": null
}
```

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `400` | `invalid_json` | body is not valid JSON |
| `400` | `invalid_request` | schema failure or unknown field |
| `400` | `invalid_envelope` | envelope is malformed, empty, or over 256 KiB |
| `404` | `not_found` | no such authorisation for this organisation, **or** the `nonce` does not match the one issued |
| `409` | `authorisation_expired` | `expires_at` has passed; the row is moved to `EXPIRED` |
| `409` | `authorisation_consumed` | a transfer was already recorded against it |
| `409` | `conflict` | the unique constraint on `authorisation_id` refused a second row — the same protection, one layer down |

A mismatched nonce reports `not_found` rather than a distinct code, because from
the caller's position an authorisation it cannot name correctly is one it does
not hold. Such an envelope would fail to decrypt in any case: the nonce is inside
the authenticated data.

### `GET /api/v1/transfers`

The authenticated organisation's own transfer records, newest first, capped at
200. Routing metadata and integrity digests only — **the envelope is never
returned here**. It is collected by the recipient, on the delivery plane.

| Parameter | Notes |
| --- | --- |
| `site_id` | Optional. Must be a site the caller owns, else `404` |

```http
GET /api/v1/transfers?site_id=site_demo
Authorization: Bearer sk_2f8c...
```

`200 OK` with `{ "transfers": [ ... ] }`, each entry the object shown under
`POST /api/v1/transfers`.

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, or wrong-plane key |
| `404` | `not_found` | `site_id` names a site the caller does not own |

---

## Delivery

One endpoint, authenticated by a recipient delivery key:

```http
Authorization: Bearer rk_9f2c...
```

A site public key and an organisation secret are both rejected with `401`, on the
prefix, before any lookup. No CORS headers are returned.

### `GET /api/v1/transfers/pending`

Lists the envelopes waiting for the authenticated recipient, newest last. Routing
metadata only — the envelope itself is fetched one transfer at a time below.

Without this a target could only fetch a transfer whose id it had been told out
of band, which would make the delivery plane unusable on its own.

`200 OK`:

```json
{
  "transfers": [
    {
      "transfer_id": "c07e4b9a-...",
      "authorisation_id": "8ad1f0c2-...",
      "site_id": "site_demo",
      "purpose_code": "analytics",
      "recipient_code": "partner-bank",
      "principal_external_id": "p_3f9c",
      "consent_record_id": "3eda117f-...",
      "status": "RECORDED",
      "ciphertext_sha256": "3f2a91...",
      "payload_bytes": 57,
      "recorded_at": "2026-09-01T09:00:04.117Z",
      "delivered_at": null
    }
  ]
}
```

Only transfers still in `RECORDED` state appear; collecting one moves it to
`DELIVERED`.

### `GET /api/v1/transfers/{transferId}/envelope`

Hands a sealed envelope to the recipient it was addressed to.

The lookup is scoped to the authenticated recipient, so a delivery credential
cannot collect envelopes sealed for anyone else — and could not read them if it
did, since the private key those envelopes were sealed to lives only in the
target fiduciary.

`200 OK`:

```json
{
  "transfer_id": "c07e4b9a-...",
  "envelope": {
    "ciphertext": "0mJ4v...",
    "iv": "aWQxMjM0NTY3ODkw",
    "auth_tag": "9wUyR1p0bWFjdGFn",
    "ephemeral_public_key": "MCowBQYDK2VuAyEA..."
  },
  "binding": {
    "authorisation_id": "8ad1f0c2-...",
    "nonce": "Zk8sT1x2...",
    "purpose_code": "analytics",
    "recipient_code": "partner-bank",
    "principal_external_id": "p_3f9c"
  },
  "ciphertext_sha256": "3f2a91...",
  "recorded_at": "2026-09-01T09:00:04.117Z"
}
```

The envelope is snake_case here and on submission, like every other field in this
API. The crypto package's `SealedEnvelope` and `TransferBinding` are camelCase
because they are TypeScript values rather than a wire format; `toWireEnvelope` /
`fromWireEnvelope` and `toWireBinding` / `fromWireBinding` in `shared/transfer.ts`
convert at the boundary so neither convention leaks into the other.

`binding` is exactly the input to `buildTransferAad`. The recipient rebuilds the
additional authenticated data from it and opens the envelope; if Rift altered the
ciphertext *or* the metadata, the GCM tag check fails and decryption throws
rather than returning something plausible. That is what makes Rift a relay it is
safe to distrust for confidentiality.

Collection is not a pure read: the first successful collection stamps the record
`DELIVERED` with a `delivered_at`. Re-collecting the same transfer returns the
same envelope and leaves the timestamp alone — there is no ack step, so a
recipient that crashed mid-processing can simply ask again.

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | missing, malformed, unknown, wrong-plane, or inactive-recipient key |
| `404` | `not_found` | no transfer with that id addressed to this recipient |

A transfer sealed for another recipient is reported exactly like one that does
not exist, following the same existence non-disclosure rule as the rest of the
API.

There is no "list my pending envelopes" endpoint. `listPendingForRecipient` exists
in `database/transfers.ts` but is not exposed over HTTP in this prototype; a
target learns its transfer ids out of band.

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
- The secure routing surface is a **proof of concept**. It has had no
  cryptographic review and must not be described as production-secure. There is
  no recipient update or delete route, no key rotation, no PKI to authenticate a
  registered public key, and no retention policy for delivered envelopes. See the
  known limitations in [secure-transfer.md](secure-transfer.md).
- Organisations are provisioned out of band (seed script or the
  `createOrganisation()` helper), not over HTTP — there is no credential that
  could authenticate creating a tenant.
- If a read API is added later it must be reviewed as part of the integration
  contract, and must scope every query to the authenticated tenant.

## Versioning

- The API is versioned in the path as `/api/v1`.
- Breaking API changes require a new versioned route, not an in-place change.
- The underlying event schema remains the shared artifact both teams depend on.
