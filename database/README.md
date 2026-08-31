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
- Provide seed data for local development.

## Structure

```
database/
├── prisma/
│   ├── schema.prisma      # analytics + consent models
│   ├── migrations/        # ordered, forward-only
│   └── seed.ts            # local organisations, sites, and consent reference data
├── generated/client/      # generated Prisma client
├── keys.ts                # public/secret key generation and hashing
├── tenancy.ts             # createOrganisation / createWebsite, row -> API mapping
├── consent.ts             # purposes/policies/notices, recordConsentDecision,
│                          # getConsentHistory, getEffectiveConsent
└── index.ts               # PrismaClient singleton + re-exports
```

Every function in `consent.ts` takes the tenant it operates in as an explicit
argument (`organisationId` and/or `siteId`, both derived by the caller from an
authenticated credential) and scopes its queries to it. Nothing in that module
can be asked to "just look up a purpose by id" without saying whose it is. It
never touches `Session` or `Event`: the two domains are kept apart.

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
  recorded consent.

## Notes

- Neon's pooled endpoint can carry a `search_path` between sessions. If a Prisma
  command appears to target the wrong schema, pin it explicitly
  (`...&schema=public`) or use the direct, non-pooled connection string.
- `generated/client/` is committed and currently contains a Windows-specific query
  engine binary. Regenerate with `npm run generate` on other platforms.

## Status

Implemented.
