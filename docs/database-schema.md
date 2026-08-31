# Database Schema

This is the database model used by the MVP. It supports tenant (organisation)
ownership, website registration, browser sessions, the raw event stream emitted
by the SDK, the consent domain, and the secure data routing prototype. Prisma is
the schema authoring tool, and it maps camelCase model fields onto snake_case
PostgreSQL columns with `@map`.

The ownership rules these tables encode are explained in [tenancy.md](tenancy.md);
the consent vocabulary and its append-only guarantee are in
[consent.md](consent.md); the trust model behind the transfer tables, including
what they deliberately cannot hold, is in [secure-transfer.md](secure-transfer.md).

## Engine

- PostgreSQL is the target engine for the MVP.
- Prisma model names use `PascalCase`; database names are `snake_case`.
- IDs are strings, generated as UUIDs by Prisma (`@default(uuid())`).
- There is no `api_keys` table. A website's public key lives on `websites`, and an
  organisation's hashed secret key lives on `organisations`.

## Prisma models

### `Organisation`

The tenant. Every website belongs to exactly one organisation, and the
organisation is the boundary isolation is enforced against.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `name` | `name` | `String` | not null |
| `slug` | `slug` | `String` | not null, **unique** |
| `secretKeyHash` | `secret_key_hash` | `String` | not null, **unique** |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Notes:
- `secret_key_hash` is the SHA-256 digest of the `sk_...` key. The plaintext
  secret is returned once at creation and never stored.
- Lookup during authentication is a single indexed equality match on the digest.

### `Website`

Customer websites that install the SDK.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, FK → `organisations.id` (cascade) |
| `name` | `name` | `String` | not null |
| `domain` | `domain` | `String` | not null |
| `publicKey` | `public_key` | `String` | not null, **unique** |
| `isActive` | `is_active` | `Boolean` | not null, default `true` |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@index([organisationId])`, `@@unique([id, organisationId])`.

Notes:
- `public_key` is unique, so it identifies exactly one site on its own. The API
  resolves the site from the key and never from a request body.
- `@@unique([id, organisationId])` lets a tenant-scoped update address a row by
  `(id, organisation_id)`, keeping the tenant filter inside the SQL `WHERE`.

### `Session`

Browser sessions for a site.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK |
| `siteId` | `site_id` | `String` | not null, FK → `websites.id` (cascade) |
| `startedAt` | `started_at` | `DateTime` | not null, default `now()` |
| `lastActivity` | `last_activity` | `DateTime` | not null |

Indexes and keys: `@@index([siteId, lastActivity])`, `@@unique([id, siteId])`.

Notes:
- `last_activity` is set from event data, not wall-clock time, and only ever moves
  forward — a late-arriving event cannot pull it backwards.
- `@@unique([id, siteId])` exists to be the target of the composite foreign key on
  `events` described below.

### `Event`

Normalised raw ingestion table for SDK events.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `eventId` | `event_id` | `String` | not null, **unique** |
| `siteId` | `site_id` | `String` | not null, FK → `websites.id` (cascade) |
| `sessionId` | `session_id` | `String` | not null, part of composite FK below |
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

Indexes: `@@index([siteId, eventTime])`, `@@index([siteId, eventType])`,
`@@index([sessionId])`.

**Composite foreign key:** `events (session_id, site_id)` references
`sessions (id, site_id)`. This is the constraint that makes cross-tenant data
unrepresentable — an event can only ever attach to a session belonging to the same
site, regardless of what application code does. See [tenancy.md](tenancy.md).

Notes:
- `event_id` is unique, which makes ingestion idempotent: replayed batches are
  skipped rather than duplicated.
- `event_type` is one of `page_view`, `session_start`, or `custom`.
- `properties` stores arbitrary JSON for custom events; `null` for automatic ones.

## Consent domain models

These seven models are deliberately generic: they encode structure and no legal
rules. See [consent.md](consent.md) for the reasoning behind each one.

Reference data (`Purpose`, `Policy`, `PolicyVersion`, `Notice`) is
**organisation-scoped**; people and decisions (`Principal`, `ConsentRecord`) are
**site-scoped**.

### `Principal`

The person a consent decision belongs to. Anonymous for the MVP.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `siteId` | `site_id` | `String` | not null, FK → `websites.id` (cascade) |
| `externalId` | `external_id` | `String` | not null |
| `kind` | `kind` | `String` | not null, default `'anonymous'` |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@unique([siteId, externalId])`, `@@unique([id, siteId])`.

Notes:
- `external_id` is opaque to us — the SDK mints a `crypto.randomUUID()` and keeps
  it in `localStorage`. The same value on two sites is two different principals.
- `kind` is an open string, not an enum, so a principal can later be promoted to
  `"identified"` without a type migration.
- `@@unique([id, siteId])` exists to be the target of the composite FK on
  `consent_records`.

### `Purpose`

Something a fiduciary uses data for, referenced by stable `code`.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, FK → `organisations.id` (cascade) |
| `code` | `code` | `String` | not null |
| `name` | `name` | `String` | not null |
| `description` | `description` | `String` | not null |
| `isActive` | `is_active` | `Boolean` | not null, default `true` |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@unique([organisationId, code])`, `@@unique([id, organisationId])`.

Notes:
- The SDK and notices name a purpose by `code`, never by UUID.
- Codes are unique per organisation, so two tenants may both declare `analytics`
  and each resolves only to its own.

### `Policy`

A document owned by a fiduciary. The text itself lives in versions.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, FK → `organisations.id` (cascade) |
| `code` | `code` | `String` | not null |
| `name` | `name` | `String` | not null |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@unique([organisationId, code])`, `@@unique([id, organisationId])`.

### `PolicyVersion`

An immutable version of a policy. Consent is always recorded against the version
that was in force, so the audit trail survives the policy text changing.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, part of composite FK below |
| `policyId` | `policy_id` | `String` | not null, part of composite FK below |
| `version` | `version` | `String` | not null |
| `documentUrl` | `document_url` | `String?` | nullable |
| `contentHash` | `content_hash` | `String?` | nullable |
| `publishedAt` | `published_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@index([organisationId])`,
`@@unique([policyId, version])`, `@@unique([id, organisationId])`.

**Composite foreign key:** `policy_versions (policy_id, organisation_id)`
references `policies (id, organisation_id)` — `ON DELETE CASCADE`. A version can
never attach to another tenant's policy.

Notes:
- `content_hash` is a digest of the published text, so a stored version can be
  proven unchanged.
- There is no update or delete route. Editing a published version in place would
  rewrite what a principal actually agreed to.

### `Notice`

What was actually shown to a principal: one policy version, in one locale,
disclosing a specific set of purposes.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, FK → `organisations.id` (cascade) |
| `policyVersionId` | `policy_version_id` | `String` | not null, part of composite FK below |
| `version` | `version` | `String` | not null |
| `locale` | `locale` | `String` | not null, default `'en'` |
| `publishedAt` | `published_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@unique([organisationId, version, locale])`,
`@@unique([id, organisationId])`.

**Composite foreign key:** `notices (policy_version_id, organisation_id)`
references `policy_versions (id, organisation_id)` — `ON DELETE NO ACTION`.

### `NoticePurpose`

Which purposes a notice disclosed. This link is checked, not decorative: a
consent decision naming a notice that never disclosed its purpose is rejected.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `noticeId` | `notice_id` | `String` | PK part, FK → `notices.id` (cascade) |
| `purposeId` | `purpose_id` | `String` | PK part, FK → `purposes.id` (cascade) |

Indexes and keys: `@@id([noticeId, purposeId])`, `@@index([purposeId])`.

### `ConsentRecord`

One immutable consent decision. **Append-only** — see the trigger below.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, part of every composite FK below |
| `siteId` | `site_id` | `String` | not null, part of composite FKs below |
| `principalId` | `principal_id` | `String` | not null, part of composite FK below |
| `purposeId` | `purpose_id` | `String` | not null, part of composite FK below |
| `noticeId` | `notice_id` | `String?` | nullable, part of composite FK below |
| `policyVersionId` | `policy_version_id` | `String?` | nullable, part of composite FK below |
| `status` | `status` | `String` | not null |
| `source` | `source` | `String` | not null, default `'api'` |
| `decidedAt` | `decided_at` | `DateTime` | not null |
| `recordedAt` | `recorded_at` | `DateTime` | not null, default `now()` |
| `metadata` | `metadata` | `Json?` | nullable |

Indexes and keys: `@@index([principalId, purposeId, decidedAt])`,
`@@index([siteId, decidedAt])`, `@@index([organisationId, decidedAt])`,
`@@index([purposeId])`, `@@unique([id, organisationId])`.

`@@unique([id, organisationId])` was added in the secure-transfer migration. It
is the target of the composite foreign key on `transfer_authorisations`, which is
what lets an authorisation cite the exact consent decision it relied on without
that decision being allowed to belong to another tenant.

**Composite foreign keys** — each one keeps a reference inside a single tenant:

| Foreign key | References | On delete |
| --- | --- | --- |
| `(site_id, organisation_id)` | `websites (id, organisation_id)` | cascade |
| `(principal_id, site_id)` | `principals (id, site_id)` | cascade |
| `(purpose_id, organisation_id)` | `purposes (id, organisation_id)` | no action |
| `(notice_id, organisation_id)` | `notices (id, organisation_id)` | no action |
| `(policy_version_id, organisation_id)` | `policy_versions (id, organisation_id)` | no action |

`NO ACTION` rather than `RESTRICT` on the reference-data edges is deliberate. It
is checked at the end of the statement, so a cascading tenant delete that removes
both sides at once still succeeds, while deleting a purpose that still has
consent history on its own fails.

Notes:
- `status` is `GRANTED`, `DENIED` or `WITHDRAWN`. It is a string, not a DB enum,
  so new decision types need no type migration; the API validates against
  `CONSENT_STATUSES` in `shared/consent.ts`. This matches the `event_type`
  convention.
- `decided_at` is when the principal decided; `recorded_at` is when we durably
  stored it. They differ for imported records.
- `policy_version_id` is snapshotted onto the record, so it stands alone even if
  the notice is later superseded.
- There is no "current consent" column. Current state is derived as the newest
  record per `(principal_id, purpose_id)` by `resolveEffectiveConsent`, which is
  what `@@index([principalId, purposeId, decidedAt])` supports.

### Append-only trigger

```sql
CREATE TRIGGER consent_records_append_only
    BEFORE UPDATE ON "consent_records"
    FOR EACH ROW EXECUTE FUNCTION rift_consent_records_append_only();
```

The function raises unconditionally with `ERRCODE = 'restrict_violation'`
(SQLSTATE `23001`). Consent history is preserved by the database rather than by
convention in application code: changing your mind means appending a new record.

`DELETE` is deliberately **not** blocked. Tenant offboarding cascades from
`organisations` and must keep working, and retention/erasure is a separate
concern from immutability. The guarantee made here is precisely that a decision
is never *rewritten*.

## Secure data routing models

Three models added by the Phase 3 prototype. Rift acts as a relay: it stores the
sealed payload and the routing metadata around it, and nothing that could open
that payload. See [secure-transfer.md](secure-transfer.md) for the trust model
and its limitations — this is a proof of concept and has had no cryptographic
review.

**There is deliberately no plaintext column and no private-key column anywhere in
this section.** That is not an oversight to be corrected later by an "encrypted
payload plus key" convenience column; it is the property the whole design exists
to demonstrate. Encrypting data and then storing the decryption key in the same
database would make the exercise theatre.

| Held in these tables | Not held, anywhere |
| --- | --- |
| Ciphertext, IV, GCM tag, ephemeral public key | The plaintext payload |
| The recipient's X25519 **public** key | The recipient's X25519 **private** key |
| SHA-256 of the `rk_...` delivery credential | The delivery credential itself |
| SHA-256 and byte length of the ciphertext | The derived per-transfer AES key |

### `DataRecipient`

A target fiduciary a source organisation is permitted to send data to.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, FK → `organisations.id` (cascade) |
| `code` | `code` | `String` | not null |
| `name` | `name` | `String` | not null |
| `publicKey` | `public_key` | `String` | not null |
| `algorithm` | `algorithm` | `String` | not null |
| `deliveryKeyHash` | `delivery_key_hash` | `String` | not null, **unique** |
| `isActive` | `is_active` | `Boolean` | not null, default `true` |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@unique([organisationId, code])`, `@@unique([id, organisationId])`,
unique index on `delivery_key_hash`.

Notes:
- `public_key` is a base64 SPKI X25519 key, stored in plaintext because it *is*
  public. The matching private key exists only inside the target fiduciary and
  is never sent to, requested by, or stored by Rift.
- `algorithm` is recorded per recipient rather than assumed globally, so the
  construction can change without guessing how existing envelopes were sealed.
  Today every row is `X25519-HKDF-SHA256-AES256GCM`, the value of
  `TRANSFER_ALGORITHM` in `secure-transfer/envelope.ts`.
- `delivery_key_hash` is the SHA-256 digest of the `rk_...` credential, following
  the same hashed-token pattern as `organisations.secret_key_hash`. The plaintext
  credential is returned once at registration and never stored. Its uniqueness is
  what makes delivery authentication a single indexed equality match.
- `is_active` switches a recipient off without deleting transfer history. It does
  not re-key or revoke envelopes already sealed for that recipient.
- The source organisation owns the row: it registers who it may send to.

### `TransferAuthorisation`

Permission to make one specific transfer. Single use, time bounded, and tied to
the exact consent decision it relied on.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, part of composite FKs below |
| `siteId` | `site_id` | `String` | not null, part of composite FKs below |
| `principalId` | `principal_id` | `String` | not null, part of composite FK below |
| `purposeId` | `purpose_id` | `String` | not null, part of composite FK below |
| `recipientId` | `recipient_id` | `String` | not null, part of composite FK below |
| `consentRecordId` | `consent_record_id` | `String` | not null, part of composite FK below |
| `nonce` | `nonce` | `String` | not null, **unique** |
| `status` | `status` | `String` | not null, default `'AUTHORISED'` |
| `expiresAt` | `expires_at` | `DateTime` | not null |
| `createdAt` | `created_at` | `DateTime` | not null, default `now()` |

Indexes and keys: `@@index([organisationId, createdAt])`, `@@index([siteId, status])`,
unique index on `nonce`.

**Composite foreign keys** — each one keeps a reference inside a single tenant,
the same technique used on `consent_records`:

| Foreign key | References | On delete |
| --- | --- | --- |
| `(site_id, organisation_id)` | `websites (id, organisation_id)` | cascade |
| `(principal_id, site_id)` | `principals (id, site_id)` | cascade |
| `(purpose_id, organisation_id)` | `purposes (id, organisation_id)` | no action |
| `(recipient_id, organisation_id)` | `data_recipients (id, organisation_id)` | no action |
| `(consent_record_id, organisation_id)` | `consent_records (id, organisation_id)` | no action |

Notes:
- `consent_record_id` points at **the decision relied upon, not a boolean**. An
  auditor can therefore see precisely which decision justified a transfer, and
  because `consent_records` is append-only that decision can never be rewritten
  underneath the authorisation. A `consent_granted` flag would have been a copy
  that could drift from the log meant to justify it.
- `nonce` is a high-entropy single-use value (24 random bytes, base64url). It is
  also part of the envelope's authenticated data, so an envelope sealed under one
  authorisation cannot be reused under another.
- `status` is `AUTHORISED`, `CONSUMED` or `EXPIRED`. A string rather than a DB
  enum, following the `event_type` and consent `status` convention; the API
  validates against `TRANSFER_AUTHORISATION_STATUSES` in `shared/transfer.ts`.
- `expires_at` is set from a TTL at creation — 15 minutes by default, overridable
  per request between 30 and 3600 seconds. Expiry is checked on submission, and a
  lapsed row is moved to `EXPIRED` when it is next touched; there is no sweeper
  job.
- Reference-data edges use `NO ACTION` for the reason given under
  `ConsentRecord`: it is checked at the end of the statement, so a cascading
  tenant delete succeeds while deleting a purpose or recipient that still has
  transfer history on its own still fails.

### `TransferRecord`

What actually happened, plus the sealed payload while it is in transit.

| Prisma field | DB column | Type | Constraints |
| --- | --- | --- | --- |
| `id` | `id` | `String` | PK, generated UUID |
| `organisationId` | `organisation_id` | `String` | not null, no FK (see note) |
| `authorisationId` | `authorisation_id` | `String` | not null, **unique**, FK → `transfer_authorisations.id` (cascade) |
| `ciphertext` | `ciphertext` | `String` | not null |
| `iv` | `iv` | `String` | not null |
| `authTag` | `auth_tag` | `String` | not null |
| `ephemeralPublicKey` | `ephemeral_public_key` | `String` | not null |
| `ciphertextSha256` | `ciphertext_sha256` | `String` | not null |
| `payloadBytes` | `payload_bytes` | `Int` | not null |
| `status` | `status` | `String` | not null, default `'RECORDED'` |
| `failureReason` | `failure_reason` | `String?` | nullable |
| `recordedAt` | `recorded_at` | `DateTime` | not null, default `now()` |
| `deliveredAt` | `delivered_at` | `DateTime?` | nullable |

Indexes and keys: `@@index([organisationId, recordedAt])`, unique index on
`authorisation_id`.

Notes:
- **`authorisation_id` is unique.** This is the database-level half of replay
  prevention: two concurrent submissions cannot both succeed even if both passed
  the application's status check, because PostgreSQL refuses the second row. The
  service layer writes the record and flips the authorisation to `CONSUMED` in
  one transaction.
- `ciphertext`, `iv`, `auth_tag` and `ephemeral_public_key` are the sealed
  envelope, base64 and opaque to Rift. The ephemeral public key is one half of a
  Diffie-Hellman pair; the other half was discarded by the source after sealing,
  and the recipient's private half was never here.
- `ciphertext_sha256` and `payload_bytes` give integrity and accounting without
  inspecting content. Ciphertext is capped at 256 KiB
  (`MAX_CIPHERTEXT_BYTES`), because a relay with an unbounded body is a trivial
  denial of service.
- `status` is `RECORDED`, `DELIVERED` or `FAILED`; `delivered_at` is stamped when
  the recipient collects the envelope on the delivery plane.
- `organisation_id` is denormalised and carries **no** foreign key of its own. It
  is copied from the authenticated caller so a source organisation's own
  transfers can be listed without joining through the authorisation. Tenancy is
  still constrained: the row cascades from `transfer_authorisations`, whose
  composite keys are tenant-bound.
- There is no `plaintext` column, no `private_key` column, and no column that
  could hold either. `api/tests/transfer-boundary.test.ts` dumps every row of
  every table after a completed transfer and asserts the payload does not appear
  in it, then tries every string Rift stores as a decryption key and asserts that
  none of them works.

## Indexing rationale

The event table supports the access patterns the analytics side needs, all of
which are tenant-scoped by design:

- filtering by `site_id` + `event_time` → `events_site_id_event_time_idx`
- filtering by `site_id` + `event_type` → `events_site_id_event_type_idx`
- joining on `session_id` → `events_session_id_idx`
- listing a tenant's sites → `websites_organisation_id_idx`
- session recency per site → `sessions_site_id_last_activity_idx`

Leading every event index with `site_id` means a tenant-scoped query never has to
scan another tenant's rows.

The consent indexes follow the same principle, one per access pattern:

- deriving effective consent for one person →
  `consent_records_principal_id_purpose_id_decided_at_idx`
- a site's decision stream → `consent_records_site_id_decided_at_idx`
- the tenant audit trail → `consent_records_organisation_id_decided_at_idx`
- "does this purpose have history" before deletion → `consent_records_purpose_id_idx`
- listing the notices that disclosed a purpose → `notice_purposes_purpose_id_idx`

The transfer indexes are the same shape again — leading with the tenant, or with
the unique credential/identifier the lookup actually keys on:

- authenticating a delivery credential →
  `data_recipients_delivery_key_hash_key` (a single indexed equality match on the
  digest, exactly as for an organisation secret)
- resolving a recipient by code within a tenant →
  `data_recipients_organisation_id_code_key`
- a tenant's authorisation history →
  `transfer_authorisations_organisation_id_created_at_idx`
- outstanding authorisations for a site →
  `transfer_authorisations_site_id_status_idx`
- one transfer per authorisation, enforced not merely indexed →
  `transfer_records_authorisation_id_key`
- a source organisation's own transfer log →
  `transfer_records_organisation_id_recorded_at_idx`

## Retention

The MVP does not yet specify a retention policy. This will be added when the first
production storage strategy is defined. Note that the append-only trigger on
`consent_records` blocks `UPDATE` only, so a future retention job can still
delete rows; immutability and retention are separate concerns.

The same gap applies to `transfer_records`: a collected envelope stays in the
table after delivery. It is unreadable to Rift either way, but "unreadable" is
not "deleted", and a retention policy for delivered envelopes is outstanding
work — see the known limitations in [secure-transfer.md](secure-transfer.md).

## Migrations

- Prisma schema lives in `database/prisma/schema.prisma`.
- Migrations are created and applied from `database/`; run them from that
  directory so `prisma.config.ts` picks up `.env.local`.
- `20260830160540_init` creates the original three tables.
- `20260831120000_add_organisation_tenancy` adds organisations, the ownership FK,
  key uniqueness, the composite session FK, and the tenant-scoped indexes. It is
  hand-written so that existing `websites` rows are backfilled into a placeholder
  organisation rather than dropped; the seed then adopts them and removes the
  placeholder.
- `20260831180000_add_consent_domain` adds the seven consent tables, their
  tenant-scoped unique keys and indexes, the composite foreign keys listed above,
  and the `consent_records_append_only` trigger. It adds nothing to the analytics
  tables — no consent column is written onto `sessions` or `events`.
- `20260901090000_add_secure_transfer` adds `data_recipients`,
  `transfer_authorisations` and `transfer_records`, their unique keys and
  indexes, the five composite foreign keys on `transfer_authorisations`, and the
  unique index on `transfer_records.authorisation_id`. It also adds
  `consent_records_id_organisation_id_key`, which the authorisation's
  consent-record FK needs as a target. It changes no existing column, writes no
  transfer state onto consent or analytics rows, and adds no column capable of
  holding plaintext or a private key.
- Never edit a migration that has been applied — add a new one.
