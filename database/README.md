# Database

Schema, migrations, seed data, and credential/tenancy helpers for the store
backing the API.

## Responsibilities

- Own the migration history (forward-only).
- Match [`../docs/database-schema.md`](../docs/database-schema.md) and enforce the
  ownership rules in [`../docs/tenancy.md`](../docs/tenancy.md).
- Mint and hash credentials (`keys.ts`) — the single place key material is created.
- Provision tenants and sites (`tenancy.ts`), and map rows onto shared API types.
- Own consent-domain data access (`consent.ts`) and the append-only guarantee on
  `consent_records`, per [`../docs/consent.md`](../docs/consent.md).
- Own secure-routing data access (`transfers.ts`): recipient registration, the
  consent-gated transfer authorisation, recording a sealed envelope, and handing
  it to the recipient it was addressed to, per
  [`../docs/secure-transfer.md`](../docs/secure-transfer.md).
- Provide seed data for local development.

## Structure

```
database/
├── prisma/
│   ├── schema.prisma      # analytics + consent + secure routing models
│   ├── migrations/        # ordered, forward-only
│   └── seed.ts            # local organisations, sites, and consent reference data
├── generated/client/      # generated Prisma client
├── keys.ts                # public/secret/delivery key generation and hashing
├── tenancy.ts             # createOrganisation / createWebsite, row -> API mapping
├── consent.ts             # purposes/policies/notices, recordConsentDecision,
│                          # getConsentHistory, getEffectiveConsent
├── transfers.ts           # createRecipient, authoriseTransfer, recordTransfer,
│                          # collectTransfer, listTransfers
└── index.ts               # PrismaClient singleton + re-exports
```

Every function in `consent.ts` takes the tenant it operates in as an explicit
argument (`organisationId` and/or `siteId`, both derived by the caller from an
authenticated credential) and scopes its queries to it. Nothing in that module
can be asked to "just look up a purpose by id" without saying whose it is. It
never touches `Session` or `Event`: the two domains are kept apart.

`transfers.ts` follows the same rule and adds one of its own. It imports only
`@rift-cmp/secure-transfer` — the Rift-safe half — and never
`@rift-cmp/secure-transfer/fiduciary`. It can hash an envelope, measure it and
validate its shape; it cannot open one, and a test in `api/tests/` asserts that
the import is absent rather than trusting the comment saying so. It reuses
`getEffectiveConsent` from `consent.ts` rather than reimplementing the rule, so a
transfer can never be authorised against a definition of "current consent" the
consent API would disagree with.

## Commands

Run these from this directory; `prisma.config.ts` loads `.env.local` for them.

```bash
npm run generate          # regenerate the Prisma client
npx prisma migrate deploy # apply migrations
npm run seed              # provision demo organisations and sites
npm run validate          # validate schema.prisma
```

## Conventions

- One logical change per migration.
- Never edit a migration that has been applied — add a new one.
- Organisations are created through `createOrganisation()`, never by inserting a
  row directly, so a secret key is always hashed and never stored in plaintext.
- `consent_records` is append-only. A `BEFORE UPDATE` trigger
  (`consent_records_append_only`) rejects any `UPDATE` with SQLSTATE `23001`, so
  changing a decision means appending a new row. `DELETE` stays permitted, because
  tenant offboarding cascades from `organisations` and retention is a separate
  concern from immutability.
- The seed's consent reference data is idempotent: existing purposes, policies and
  notices are left alone, so re-seeding never duplicates them or invalidates
  recorded consent. The seed provisions no recipients: a delivery key is shown
  once and a target's public key comes from that target, so both are supplied per
  environment rather than committed.
- No table in the secure routing domain has a column for plaintext or for a
  private key, and none should be added. `transfer_records.authorisation_id` is
  unique on purpose — it is the database-level half of replay prevention, so
  dropping it to "allow retries" would silently remove a guarantee the
  integration contract makes.

## Notes

- Neon's pooled endpoint can carry a `search_path` between sessions. If a Prisma
  command appears to target the wrong schema, pin it explicitly
  (`...&schema=public`) or use the direct, non-pooled connection string.
- `generated/client/` is committed and currently contains a Windows-specific query
  engine binary. Regenerate with `npm run generate` on other platforms.

## Status

Implemented.
