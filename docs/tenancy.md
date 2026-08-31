# Tenancy and Ownership Model

This document defines who owns what in Rift-CMP, and how the platform guarantees
that one tenant can never reach another tenant's data.

## The rule

> Data belonging to one website/tenant must never be accessible through another
> website/tenant.

Everything below exists to make that rule true by construction rather than by
convention.

## Ownership tree

Ownership is two levels deep. An **organisation** is the tenant boundary; a
**website** (also called a site) is the unit an SDK installation reports to.

```text
Organisation A                      Organisation B
 ├── Site A1                         └── Site B1
 │    ├── Session ──── Event              ├── Session ──── Event
 │    └── Session ──── Event              └── Session ──── Event
 └── Site A2
      └── Session ──── Event
```

- An organisation owns zero or more websites.
- A website belongs to exactly one organisation and cannot be reassigned over the API.
- A session belongs to exactly one website.
- An event belongs to exactly one website **and** to a session of that same website.

`npm run seed` (from `database/`) provisions exactly this shape and prints it.

## Two credential planes

The platform has two kinds of credential, and they are never interchangeable.

| | Public key | Secret key |
| --- | --- | --- |
| Format | `pk_<32 hex>` | `sk_<64 hex>` |
| Identifies | one **website** | one **organisation** |
| Lives in | browser code, page source | server-side config only |
| Stored as | plaintext (it is not a secret) | SHA-256 digest only |
| Grants | append events to that one site | read/modify that org's sites |
| Used by | `POST /api/v1/events` | `/api/v1/organisation`, `/api/v1/sites` |

A public key presented to the management API is rejected with `401`. A secret key
presented to the ingestion API is rejected with `401`. The check is on the key
*prefix* before any database lookup, so neither plane can be probed with the
other's credential.

Because public keys ship inside browser code, they are treated as public
information: they are returned to their owning organisation in plain text, and
`navigator.sendBeacon` may pass one as a `?pk=` query parameter (that API cannot
set headers). A secret key is never accepted in a URL, so it can never leak
through logs, browser history or `Referer` headers.

SHA-256 — rather than a password hash such as argon2 — is the right digest for
secret keys because they are 256-bit random tokens, not user-chosen passwords:
there is no dictionary to attack, so a deliberately slow KDF would add latency
without adding security.

## The credential decides the tenant

This is the single most important implementation rule:

> Nothing in a URL or request body is ever trusted to select a tenant.

Every authenticated request resolves its principal purely from the presented key,
and every subsequent query is scoped to that principal:

- **Ingestion.** The site is resolved by `publicKey` alone. The `site_id` field
  in the event envelope is then *compared* against it; a mismatch rejects the
  event with `site_mismatch`. `site_id` is never used to look the site up.
- **Management.** The organisation is resolved by the secret key's digest. Site
  lookups filter on `organisationId`, and updates go through the
  `(id, organisation_id)` unique key so the tenant filter is in the SQL `WHERE`
  clause and cannot be forgotten.
- **Mutable fields are allow-listed.** `PATCH /api/v1/sites/{siteId}` accepts only
  `name`, `domain` and `is_active`, under a strict schema. Sending
  `organisation_id`, `site_id` or `public_key` is a `400`, not a silently ignored
  field — ownership and key material are server-assigned.

## Defence in depth: the database enforces it too

Application checks are the first line, not the only one. The schema makes
cross-tenant rows unrepresentable:

| Constraint | What it prevents |
| --- | --- |
| `websites.organisation_id` FK → `organisations.id` | A site with no owner |
| `sessions.site_id` FK → `websites.id` | A session with no site |
| `events.site_id` FK → `websites.id` | An event with no site |
| **`events (session_id, site_id)` FK → `sessions (id, site_id)`** | An event attached to a session belonging to a *different* site |
| `websites.public_key` unique | Two sites sharing an identity |
| `organisations.secret_key_hash` unique | Two tenants sharing a credential |
| `@@unique([id, organisationId])` on `websites` | Tenant-scoped updates without a second query |
| `@@unique([id, siteId])` on `sessions` | Target for the composite FK above |

The composite foreign key is the important one. Even if every application-level
check were removed, PostgreSQL would still refuse to attach one site's event to
another site's session. `tests/tenancy-model.test.ts` asserts this directly by
writing through Prisma with the API bypassed entirely.

All foreign keys cascade on delete, so removing an organisation removes its
websites, sessions and events, and nothing else.

## Existence non-disclosure

A site owned by another organisation returns `404 not_found`, not `403 forbidden`.
Answering "forbidden" would confirm that the ID exists, letting one tenant
enumerate another's site IDs. From a caller's point of view, sites it does not own
simply do not exist.

`403` is reserved for the one case where the caller *is* authorised and the
resource *is* theirs, but the site is switched off: an inactive site's own key
gets `403 forbidden` on ingestion.

## Status codes

| Situation | Status | Code |
| --- | --- | --- |
| No credential, malformed, wrong plane, or unknown key | `401` | `unauthorized` |
| Valid key, site is inactive | `403` | `forbidden` |
| Site exists but belongs to another organisation | `404` | `not_found` |
| Event's `site_id` is not the authenticated site | per-event reject | `site_mismatch` |
| Event references another site's session | per-event reject | `session_conflict` |

Per-event rejections appear in the batch response's `errors[]`. If *every* event
in a batch is rejected the request returns `400`; if at least one is accepted the
request returns `202` with a non-zero `rejected` count, preserving the existing
partial-success contract.

## Deliberate scope limits

These are known and accepted for this phase:

- **Organisations are provisioned out of band**, by the seed script or the
  `createOrganisation()` helper in `database/tenancy.ts` — not over HTTP. There is
  no credential that could authenticate "create a tenant", so an HTTP endpoint
  would necessarily be an unauthenticated write.
- **A public key authorises anyone who holds it**, which for browser analytics
  means anyone who views the page source. This is inherent to client-side
  telemetry. The `websites.domain` column exists but is not yet enforced against
  the request `Origin`; adding that (plus rate limiting per site) is the natural
  hardening step and belongs to a later phase.
- **There is no per-user identity or role model.** An organisation secret is
  all-or-nothing over that organisation's sites.
- **There is no read API for event data.** The analytics side still reads the
  database directly, so tenant scoping of *reads* is that consumer's
  responsibility until a read API exists.
