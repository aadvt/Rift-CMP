# Rift-CMP

Rift-CMP is the ingestion and consent-record side of a privacy-first analytics platform: a browser SDK, a Next.js API, shared event and consent contracts, and a PostgreSQL/Prisma data layer.

It is multi-tenant: every website belongs to an **organisation**, and one tenant can never reach another tenant's data. See [docs/tenancy.md](docs/tenancy.md).

It also owns the **consent domain** — principals, purposes, policies, notices and an append-only record of every decision. That domain is deliberately generic: it encodes structure and no legal rules, so a compliance engine can sit above it later rather than being baked into the schema. See [docs/consent.md](docs/consent.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `docs/` | Architecture, event schema, consent model, API contract, database model, and integration docs |
| `sdk/` | Browser SDK that emits page/session/custom events, batches them before sending, and records consent decisions |
| `api/` | Next.js App Router API for ingestion, consent, site management, and health checks; test suite in `api/tests/` |
| `shared/` | Shared TypeScript event, tenancy, consent, and API contract types |
| `database/` | Prisma schema, generated client, migrations, credential/tenancy helpers, and seed data |

## What this repo owns

- Browser SDK emission for `page_view`, `session_start`, and `track(name, properties)`
- Ingestion endpoint `POST /api/v1/events`, authenticated by a site public key
- Site management endpoints under `/api/v1/organisation` and `/api/v1/sites`,
  authenticated by an organisation secret key
- The organisation/website ownership model and its enforcement
- The consent domain: `POST|GET /api/v1/consent` on the browser plane, and
  `/api/v1/consent/history`, `/api/v1/purposes`, `/api/v1/policies` and
  `/api/v1/notices` on the management plane
- A headless `analytics.consent` SDK client — identity, transport and caching, no UI
- An append-only consent record whose immutability is enforced by a PostgreSQL
  trigger, with current state derived rather than stored
- Prisma model and PostgreSQL storage for `organisations`, `websites`, `sessions`,
  `events`, and the seven consent tables
- Shared event and consent contracts to prevent SDK/API drift

It does **not** own the compliance engine or any consent UI. Those belong to the
other side of the platform; see [docs/integration-contract.md](docs/integration-contract.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Tenancy and Ownership Model](docs/tenancy.md)
- [Consent Domain](docs/consent.md)
- [Event Schema](docs/event-schema.md)
- [API Spec](docs/api-spec.md)
- [Database Schema](docs/database-schema.md)
- [Integration Contract](docs/integration-contract.md)

## Local development

This is the shortest path for a fresh clone to a working local event pipeline.

### 1) Install dependencies

From the repo root:

```bash
npm install
```

### 2) Set up `.env.local` in both app folders

Use the pooled Neon connection string from your Neon project dashboard. The SDK and API both need the same `DATABASE_URL` value.

Create `api/.env.local`:

```bash
DATABASE_URL="postgresql://<user>:<password>@<pool-host>.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

Create `database/.env.local`:

```bash
DATABASE_URL="postgresql://<user>:<password>@<pool-host>.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

Notes:
- Use the pooled Neon connection string, not the direct connection URI if you plan to run local Prisma/dev work reliably.
- The value is the same one used by Prisma and the Next.js app.
- Keep the credentials in `.env.local`; do not commit them.

Prisma reads `.env.local` via `database/prisma.config.ts`, so no manual export is
needed - but run Prisma commands from `database/`.

> **Note:** Neon's *pooled* endpoint can carry a `search_path` over between
> sessions, which makes migrations occasionally target the wrong schema. If a
> migration reports "no pending migrations" against a database that is clearly out
> of date, pin the schema explicitly (`...&schema=public`) or use Neon's direct
> (non-pooled) connection string for migration commands.

### 3) Prepare the database

From `database/`:

```bash
cd database
npm run generate
npx prisma migrate deploy
```

If you want to rebuild a clean local DB:

```bash
npx prisma migrate reset
```

### 4) Seed organisations and sites

```bash
cd database
npm run seed
```

The seed provisions this ownership tree and prints it:

```text
Organisation Acme Analytics (acme)
 |-- site_demo          pk_demo_12345          active
 |-- site_acme_blog     pk_acme_blog_67890     active
 |-- site_inactive      pk_inactive_999        INACTIVE
     purposes: analytics, marketing
     notice  : notice-1 -> privacy-policy@1.0.0 (<uuid>)
Organisation Globex Media (globex)
 |-- site_globex_shop   pk_globex_shop_24680   active
     purposes: analytics, marketing
     notice  : notice-1 -> privacy-policy@1.0.0 (<uuid>)
```

`site_demo` / `pk_demo_12345` is the site the browser demo uses.

The seed also provisions consent reference data per organisation — the two
purposes above, a `privacy-policy` at version `1.0.0`, and a notice disclosing
both — so a decision can be recorded against a real purpose immediately. It is
idempotent: re-seeding leaves existing rows alone, so it never duplicates
reference data or invalidates recorded consent.

The seed also prints one **organisation secret key** (`sk_...`) per organisation,
the first time each is created. That is the only time it is shown - only its
SHA-256 digest is stored. Use it for the management API:

```bash
curl -H "Authorization: Bearer sk_..." http://127.0.0.1:3000/api/v1/sites
```

Re-running the seed leaves existing organisations' secrets unchanged. Public keys
are fixed and committed on purpose: they ship in browser code and are not secrets.

### 5) Run the API locally

From the repo root:

```bash
cd api
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The API routes are:
- `GET http://127.0.0.1:3000/api/healthz`
- `POST http://127.0.0.1:3000/api/v1/events`
- `POST|GET http://127.0.0.1:3000/api/v1/consent`
- `GET http://127.0.0.1:3000/api/v1/consent/history` (secret key)
- `GET|POST http://127.0.0.1:3000/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices` (secret key)

The API validates the request with `Authorization: Bearer <public_key>` and rejects bad keys with `401`. The management routes above require the organisation secret key (`sk_...`) instead; presenting either credential on the other plane is a `401`.

### 6) Open the SDK demo page

Serve the static page from the repo root:

```bash
cd ..
python -m http.server 8080
```

Then open:

`http://127.0.0.1:8080/sdk/examples/demo.html`

The demo script initializes the SDK with:

```js
analyticsClient.init("site_demo", "pk_demo_12345", { apiUrl: "http://127.0.0.1:3000" });
```

When the page loads, it sends its automatic `page_view` and `session_start` events. Clicking the demo button sends a custom event through the same batched pipeline.

### 7) If you change the SDK bundle

After making SDK changes, rebuild the browser bundle:

```bash
cd sdk
npm run build
```

### 8) Running the checks

From the repo root:

```bash
npm test        # vitest: 113 tests covering tenancy, auth, isolation and consent
npm run typecheck
npm run lint
npm run build
```

Tests run against a dedicated `rift_cmp_test` schema in the same database, so they
never touch development data. The suite applies migrations itself before running,
which doubles as migration validation.

Expect roughly 10-12 minutes against a remote Neon instance. Almost all of that is
network round trips, not computation - the tests exercise real foreign keys,
cascades and the append-only trigger, which a mocked database could not verify.
Run a single file while iterating:

```bash
cd api && npx vitest run tests/consent-decisions.test.ts
```

SDK checks live in `sdk/`:

```bash
cd sdk && npm run typecheck && npm run build
```

### 9) Vercel note

If you eventually deploy `api/` to Vercel, set the same `DATABASE_URL` in the Vercel project environment variables. Use the Neon pooled connection string there as well; do not create a deployment config in this repo unless it is explicitly requested.

## Shared contract to keep in sync

Keep the following aligned when making changes:

- [docs/event-schema.md](docs/event-schema.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/tenancy.md](docs/tenancy.md)
- [docs/consent.md](docs/consent.md)
- [shared/event.ts](shared/event.ts), [shared/tenancy.ts](shared/tenancy.ts) and [shared/consent.ts](shared/consent.ts)
- [database/prisma/schema.prisma](database/prisma/schema.prisma)
- [database/consent.ts](database/consent.ts)
- [api/app/api/v1/events/route.ts](api/app/api/v1/events/route.ts)
- [api/app/api/v1/consent/route.ts](api/app/api/v1/consent/route.ts)
- [api/lib/auth.ts](api/lib/auth.ts)

This project intentionally keeps the API focused on ingestion and the consent record, while the analytics/dashboard side reads the database directly and builds the compliance engine on top of the consent vocabulary.
