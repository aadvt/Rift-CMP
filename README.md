# Rift-CMP

Rift-CMP is the ingestion side of a privacy-first analytics platform: a browser SDK, a Next.js API, a shared event contract, and a PostgreSQL/Prisma data layer.

## Repository layout

| Path | Purpose |
| --- | --- |
| `docs/` | Architecture, event schema, API contract, database model, and integration docs |
| `sdk/` | Browser SDK that emits page/session/custom events and batches them before sending |
| `api/` | Next.js App Router API for ingestion and health checks |
| `shared/` | Shared TypeScript event definitions used by the SDK and API |
| `database/` | Prisma schema, generated client, migrations, and seed data |

## What this repo owns

- Browser SDK emission for `page_view`, `session_start`, and `track(name, properties)`
- Ingestion endpoints under `api/app/api` for `POST /api/v1/events` and `GET /api/healthz`
- Prisma model and PostgreSQL storage for `websites`, `sessions`, and `events`
- A shared event contract to prevent SDK/API drift

## Documentation

- [Architecture](docs/architecture.md)
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

### 3) Prepare the database

From `database/`:

```bash
cd database
npm run generate
npx prisma migrate dev --name init
```

If you want to reseed a clean local DB:

```bash
npx prisma migrate reset
```

### 4) Seed a test website

This repo includes a demo website in the seed script.

```bash
cd database
npm run seed
```

The seed creates a demo site with:
- `site_id`: `site_demo`
- `public_key`: `pk_demo_12345`
- `is_active`: `true`

That is the key the browser demo uses.

### 5) Run the API locally

From the repo root:

```bash
cd api
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The API routes are:
- `GET http://127.0.0.1:3000/api/healthz`
- `POST http://127.0.0.1:3000/api/v1/events`

The API validates the request with `Authorization: Bearer <public_key>` and rejects bad keys with `401`.

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

### 8) Vercel note

If you eventually deploy `api/` to Vercel, set the same `DATABASE_URL` in the Vercel project environment variables. Use the Neon pooled connection string there as well; do not create a deployment config in this repo unless it is explicitly requested.

## Shared contract to keep in sync

Keep the following aligned when making changes:

- [docs/event-schema.md](docs/event-schema.md)
- [docs/api-spec.md](docs/api-spec.md)
- [shared/event.ts](shared/event.ts)
- [database/prisma/schema.prisma](database/prisma/schema.prisma)
- [api/app/api/v1/events/route.ts](api/app/api/v1/events/route.ts)

This project intentionally keeps the API focused on ingestion, while the analytics/dashboard side reads the database directly.
