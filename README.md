# Rift-CMP

Rift-CMP is the ingestion and consent-record side of a privacy-first analytics platform: a browser SDK, a Next.js API, shared event and consent contracts, and a PostgreSQL/Prisma data layer.

It is multi-tenant: every website belongs to an **organisation**, and one tenant can never reach another tenant's data. See [docs/tenancy.md](docs/tenancy.md).

It also owns the **consent domain** — principals, purposes, policies, notices and an append-only record of every decision. That domain is deliberately generic: it encodes structure and no legal rules, so a compliance engine can sit above it later rather than being baked into the schema. See [docs/consent.md](docs/consent.md).

Phase 3 adds a **secure data routing proof of concept**: Rift authorises a personal-data transfer against a recorded consent decision, relays the sealed payload, and cannot read it. The source seals the plaintext before it is sent; the target fiduciary holds the only decryption key; Rift holds ciphertext, routing metadata and public keys. It invents no cryptography and adds no dependency — X25519 ECDH, HKDF-SHA256 and AES-256-GCM, all from Node's built-in `node:crypto`. It has had **no cryptographic review** and is not production-secure. See [docs/secure-transfer.md](docs/secure-transfer.md).

Phase 4 connects those two halves into **one end-to-end flow**: a principal decides, a fiduciary asks whether an action is permitted, is granted a single-use authorisation, seals and submits the payload, and the whole story reads back as one timeline —

```text
consent  ->  authorisation  ->  secure transfer  ->  audit
```

A single side-effect-free orchestration layer answers "is this action currently authorised for this Data Principal, Fiduciary and purpose?". It is the only place the consent and routing domains meet: consent knows nothing about transfers, transfers know nothing about how consent is evaluated, and asking is deliberately separate from committing. A withdrawal stops future authorisations and never rewrites past ones. See [docs/lifecycle.md](docs/lifecycle.md).

Phase 5 adds an **aggregate analytics read API** and an **operator dashboard**. The dashboard is a pure consumer of the platform API — every page fetches over HTTP with the organisation secret, and no page imports `database` — so if a screen needs something the API cannot express, the API is what changes. It adds no table and no migration. The complete picture, including the MVP's security assumptions and an honest list of what it does not do, is in [docs/mvp.md](docs/mvp.md).

Phase 6A is a **security hardening pass over that MVP**, and it changed one contract on purpose. A site public key ships in page source, so it was never evidence that a person decided anything — yet it was the only credential `POST /api/v1/consent` asked for, which meant anyone could append a permanent record claiming a named principal had consented. Recording a decision now also requires a **consent session**, bound to a principal whose secret the caller holds. Alongside it: opt-in server-side consent enforcement for analytics ingestion (the API re-derives the decision from the log instead of trusting a browser's gate), rate limiting, origin validation, immutability guards on the authorisation and transfer tables, and revocable dashboard sessions that no longer carry the organisation secret in a cookie. [docs/security.md](docs/security.md) sets all of it out as *enforced*, *defence in depth*, or *still a limitation* — including what a consent session deliberately does not prove.

Phase 7A turns that research into the **policy engine**. The 102 structured
requirements Phase 6B and 6C produced were read by nothing; `policy/` now reads
them and answers one question — *given this processing activity and this context,
what requirements apply?* It is generic by construction: the single table that
turns a requirement into a verdict is keyed on canonical topic and names no
regime, and a test fails the build if one appears in it. It is also deliberately
**not wired into any route**. The platform's existing gate is a fact about a
recorded decision; the engine is a statement about what a regime requires, and
joining them means refusing live traffic on the strength of a research artifact.
That is a product decision and a later phase. See [docs/policy-engine.md](docs/policy-engine.md).

Phase 7B adds **jurisdiction resolution** on top of that engine. It works out
whose law is in play without collapsing the three claims the question usually
conflates - an IP-derived country is not a residence, and neither is applicable
law. Jurisdictions accumulate rather than competing, so a visitor can be in the
EU and India at once; confidence is explicit and never removes a jurisdiction;
and the region-to-jurisdiction mapping is versioned configuration, which is why
`GB` is recognised and deliberately mapped to nothing. The resolver has no field
for an IP address and rejects one loudly if passed: geolocation happens on the
caller's side, before it. See [docs/jurisdiction-resolution.md](docs/jurisdiction-resolution.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `docs/` | The MVP overview, architecture, event schema, consent model, secure transfer trust model, the end-to-end lifecycle, API contract, database model, and integration docs |
| `sdk/` | Browser SDK that emits page/session/custom events, batches them before sending, and records consent decisions |
| `api/` | Next.js App Router app: the three API planes under `app/api/`, the operator dashboard under `app/dashboard/`, its server-only session and API client in `lib/dashboard/`, and the test suite in `tests/` |
| `shared/` | Shared TypeScript event, tenancy, consent, transfer, authorisation, audit, analytics, and API contract types |
| `secure-transfer/` | The crypto boundary: `envelope.ts` (types, canonical AAD, digest, shape validation) is Rift-safe; `fiduciary.ts` (key generation, seal, open) belongs to the fiduciaries and is never imported by `api/` |
| `policy/` | The policy engine and the jurisdiction resolver: the generic model, the topic disposition table, matrix compilation, the evaluator, and the versioned region-to-jurisdiction mapping. Reads the Phase 6B matrix; imports no route and no database |
| `database/` | Prisma schema, generated client, migrations, credential/tenancy helpers, the consent and transfer service layers, the orchestration layer (`authorisation.ts`), the audit and analytics read models (`audit.ts`, `analytics.ts`), and seed data |

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
- Secure data routing: `GET|POST /api/v1/recipients` and
  `GET|POST /api/v1/transfers` on the management plane, and
  `GET /api/v1/transfers/{transferId}/envelope` on a third **delivery plane**
  authenticated by a recipient delivery key (`rk_...`)
- The orchestration layer that joins consent to routing —
  `GET|POST /api/v1/authorisations` and `POST /api/v1/authorisations/decision`
  (evaluate only, no side effect) on the management plane. **`POST /api/v1/transfers/authorisations`
  moved to `POST /api/v1/authorisations` in Phase 4**: authorisation is its own
  concern, not a sub-resource of transfers
- The unified audit trail, `GET /api/v1/audit`: consent decisions, authorisations
  and transfers interleaved into one timeline, cross-referenced but **not** joined
  in the database
- The aggregate analytics read API — `GET /api/v1/analytics/summary` and
  `GET /api/v1/analytics/overview` — plus `GET /api/v1/consent/effective`, which
  answers the browser plane's question with an organisation secret instead of a
  site public key. Counts only, tenant-scoped by the credential, and **sessions
  rather than unique visitors**
- The operator dashboard at `/dashboard`: five server-rendered pages that read
  the endpoints above over HTTP and nothing else
- The crypto boundary in `secure-transfer/`, split so that Rift's inability to
  decrypt is structural: the sealing and opening code is not in its dependency
  graph, and a test fails the build if it ever is
- Prisma model and PostgreSQL storage for `organisations`, `websites`, `sessions`,
  `events`, the seven consent tables, and the three secure routing tables
- The policy engine in `policy/`: a deterministic, side-effect-free evaluator
  over the Phase 6B requirement matrix, answering what a set of regimes requires
  of a processing activity. Cites every rule it relies on, resolves conflicts
  conservatively, and never returns `ALLOW` from absence of evidence
- Jurisdiction resolution in the same package: dated location *observations*
  with an explicit source and confidence, resolved into an accumulating set of
  jurisdictions under a versioned mapping. It never treats an observation as a
  residence, never drops a jurisdiction for weak evidence, and refuses to accept
  an IP address at all
- Shared event, consent and transfer contracts to prevent SDK/API drift

It does **not** own the compliance engine or any consent UI. Nor does it own
either fiduciary in a transfer — in particular, the target's X25519 private key is
generated and held on that side and never reaches this repo. Those belong to the
other side of the platform; see [docs/integration-contract.md](docs/integration-contract.md).

## Documentation

Start with the first one; it is the entry point and links to the rest.

- [The MVP](docs/mvp.md) — the whole product in one document: architecture, the
  credential planes, the five domains, the security assumptions, the known
  limitations, and what comes next
- [Architecture](docs/architecture.md)
- [Tenancy and Ownership Model](docs/tenancy.md)
- [Consent Domain](docs/consent.md)
- [Secure Data Routing](docs/secure-transfer.md)
- [Lifecycle: Consent to Transfer to Audit](docs/lifecycle.md)
- [Event Schema](docs/event-schema.md)
- [API Spec](docs/api-spec.md)
- [SDK API](docs/sdk-api.md) — the public interface a customer's developer calls
- [Database Schema](docs/database-schema.md)
- [Discovery](docs/discovery.md)
- [Policy Engine](docs/policy-engine.md) - what a regime requires of an activity, and why it is not wired into a route
- [Jurisdiction Resolution](docs/jurisdiction-resolution.md) - whose law is in play, and why an IP address never reaches it
- [Website Scanner](docs/crawler.md) — the Playwright crawler used during onboarding
- [Scan API](docs/scan-api.md)
- [Security Model](docs/security.md) — what is enforced, what is defence in depth, what is not done
- [Integration Contract](docs/integration-contract.md)

## Local development

This is the shortest path for a fresh clone to a working local event pipeline and
a dashboard you can sign in to.

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

From the repo root, one command builds the SDK bundle and starts the app:

```bash
npm run dev
```

Or from `api/` alone, if the bundle is already built:

```bash
cd api
npm run dev -- --hostname 127.0.0.1 --port 3000
```

`api`'s `predev` and `prebuild` steps run `scripts/copy-sdk.mjs`, which publishes
`sdk/dist/index.global.js` to `api/public/js/rift-cmp.js` — the path the
dashboard's install snippet points at. If the SDK has not been built, the script
warns and exits cleanly, and that URL 404s until it has.

The API routes are:
- `GET http://127.0.0.1:3000/api/healthz`
- `POST http://127.0.0.1:3000/api/v1/events`
- `POST|GET http://127.0.0.1:3000/api/v1/consent` — `POST` also needs `X-Rift-Consent-Session`
- `POST http://127.0.0.1:3000/api/v1/consent/session` (public key) — opens a consent session
- `GET http://127.0.0.1:3000/api/v1/consent/history` (secret key)
- `GET http://127.0.0.1:3000/api/v1/consent/effective` (secret key) — effective consent for one principal on one site
- `GET http://127.0.0.1:3000/api/v1/organisation`, `GET|POST /api/v1/sites`, `GET|PATCH /api/v1/sites/{siteId}` (secret key)
- `GET|POST http://127.0.0.1:3000/api/v1/purposes`, `/api/v1/policies`, `/api/v1/notices` (secret key)
- `POST http://127.0.0.1:3000/api/v1/policies/{policyId}/versions` (secret key)
- `GET|POST http://127.0.0.1:3000/api/v1/recipients` (secret key)
- `GET|POST http://127.0.0.1:3000/api/v1/authorisations` (secret key) — was `/api/v1/transfers/authorisations` before Phase 4
- `POST http://127.0.0.1:3000/api/v1/authorisations/decision` (secret key) — evaluate only, creates nothing
- `GET|POST http://127.0.0.1:3000/api/v1/transfers` (secret key) — `GET` takes `site_id` and `limit` (1–500, default 200)
- `POST http://127.0.0.1:3000/api/v1/discovery` (public key) — in-page discovery report
- `GET http://127.0.0.1:3000/api/v1/discovery/inventory` (secret key) — what runs on a site, where it sends data, and what fired without consent
- `GET http://127.0.0.1:3000/api/v1/audit` (secret key)
- `GET http://127.0.0.1:3000/api/v1/analytics/summary` (secret key) — aggregate SDK activity
- `GET http://127.0.0.1:3000/api/v1/analytics/overview` (secret key) — counts across every domain
- `GET http://127.0.0.1:3000/api/v1/transfers/pending` (**delivery key**, `rk_...`)
- `GET http://127.0.0.1:3000/api/v1/transfers/{transferId}/envelope` (**delivery key**, `rk_...`)

Both analytics endpoints take the same optional filters: `site_id`, `from` and
`to`, defaulting to the last 30 days.

The API validates the request with `Authorization: Bearer <public_key>` and rejects bad keys with `401`. The management routes above require the organisation secret key (`sk_...`) instead, and the delivery routes require a recipient delivery key (`rk_...`); presenting any of the three credentials on another plane is a `401`, decided on the key prefix before any database lookup.

### 6) Open the dashboard

`http://127.0.0.1:3000/dashboard` — the app's root redirects here, and here
redirects to `/signin` when there is no session.

Sign in with an **organisation secret key** (`sk_...`), the one `npm run seed`
printed in step 4. It is validated against `GET /api/v1/organisation` and then
exchanged for a revocable session: the cookie (`rift_dashboard_session`,
`httpOnly`, `sameSite: strict`, 60-minute idle timeout inside an eight-hour
lifetime) holds an opaque token, and the secret is sealed at rest in
`dashboard_sessions` under a key derived from it. Neither the cookie nor the
database is enough on its own, signing out ends the session immediately, and the
secret never reaches page scripts.

This is still an **MVP compromise**: there are no user accounts and no roles, so
one shared organisation secret stands behind every session, and anything holding
a live one speaks for the whole organisation. See
[docs/security.md](docs/security.md) and the known limitations in
[docs/mvp.md](docs/mvp.md).

| Page | What it shows |
| --- | --- |
| **Overview** | Counts for sites, consent decisions, authorisations, transfers and SDK activity, then the 15 most recent audit entries as one timeline |
| **Consent** | The decision log — who agreed to what, under which notice, when — filterable by site, principal and purpose, plus the decisions currently in force for a named principal on a named site |
| **Transfers** | Authorisations and the sealed transfers that spent them, each naming the consent record it relied on. Sizes and digests only: the payload is never shown, because Rift cannot read it |
| **Analytics** | Totals, top pages, device/browser/OS breakdowns and per-site activity for a date range. **Sessions, not unique visitors** — the page says so |
| **Integration** | Site ids and public keys, a copy-ready install snippet built from this deployment's origin, an API reachability check, and the purposes, notices and recipients already declared |

Every page reads through `api/lib/dashboard/api.ts`, which makes real HTTP calls
to the API above. No page imports `database`. The sign-in guard in the layout is
convenience, not security — the API authenticates every request independently.

### 7) Open the SDK demo page

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

### 8) If you change the SDK bundle

After making SDK changes, rebuild the browser bundle:

```bash
cd sdk
npm run build
```

Then restart the API, or run `npm run dev` from the repo root, so the copy step
republishes it to `api/public/js/rift-cmp.js`.

### 9) Running the checks

From the repo root:

```bash
npm run test:unit   # vitest: 270 tests, no database, a few seconds
npm test            # vitest: all 355 tests; the integration half needs Postgres
npm run typecheck   # tsc --noEmit across the api workspace
npm run lint        # eslint
npm run build       # builds the SDK bundle, then next build
```

The suite is split into two vitest projects, configured in `api/vitest.config.ts`:

| Project | Files | Tests | Needs a database |
| --- | --- | --- | --- |
| `unit` | `keys.test.ts`, `secure-transfer-crypto.test.ts`, `dashboard-components.test.tsx`, `discovery-classification.test.ts`, `rate-limit.test.ts`, `origin-validation.test.ts`, `sdk-limits.test.ts`, `policy-rules.test.ts`, `policy-engine.test.ts`, `policy-boundary.test.ts`, `jurisdiction-resolution.test.ts` | 270 | no |
| `integration` | everything else under `api/tests/` | 178 | yes |

The split exists because crypto, key-format and component tests have no business
requiring Postgres. Before it, a database outage failed even the formatting
tests, which was both slow and misleading. `npm run test:unit` is the fast loop;
`npm run test:integration` (from `api/`) runs only the other half.

Integration tests run against a dedicated `rift_cmp_test` schema in the same
database, so they never touch development data. They apply migrations themselves
before running, which doubles as migration validation, and run single-file,
single-fork: every file shares one schema and truncates between tests, so two
files at once would let one file's `resetDatabase()` delete rows another is
asserting on.

Fifty of those tests cover secure routing, across three files:
`secure-transfer-crypto.test.ts` (the construction and the attacks it must
reject — the only one of the three in the `unit` project, since cryptography
needs no database), `transfer-flow.test.ts` (end to end, plus the consent gate),
and `transfer-boundary.test.ts` (attempts to falsify the claim from Rift's own
position — dumping the whole database looking for the payload, trying every
stored string as a decryption key, and scanning the source tree for an import of
the fiduciary module).

A further 21 are in `lifecycle.test.ts`, which walks the product flow through the
HTTP surface rather than the service functions underneath it: scenarios A–G (no
consent, granted, withdrawn, wrong purpose, wrong fiduciary, cross-tenant, and
the secure payload boundary), plus the failure modes — replay, a duplicate
request, a failed transfer leaving its authorisation reusable, and two concurrent
submissions resolving to exactly one transfer.

`analytics-api.test.ts` covers the two analytics endpoints — the arithmetic, the
date range, and the isolation, which matters more here than anywhere else because
these are the only endpoints that aggregate across a whole tenant.

Six files cover Phase 6A, and five of them are written from the attacker's side:
`consent-authenticity.test.ts` (forged, absent, replayed, cross-site and
cross-tenant sessions, and the trust-on-first-use path),
`ingest-consent-enforcement.test.ts` (forged, absent, revoked and valid consent
at ingestion, plus proof that no principal identifier lands on an analytics row),
`browser-plane-guard.test.ts` (origin and rate limiting as the routes apply
them), `audit-immutability.test.ts` (which reaches past the API and issues the
`UPDATE`s and `DELETE`s through Prisma), `dashboard-session.test.ts`, and the two
unit files `rate-limit.test.ts` and `origin-validation.test.ts` — both of which
also assert the limitations, so a defence cannot quietly be described as more
than it is.

`mvp-acceptance.test.ts` is a single test with twelve steps: register a site,
instrument it with the real SDK, record consent, authorise, seal, transfer,
collect, read every dashboard endpoint, withdraw, be refused, and confirm the
history survived. It uses the real SDK, the real route handlers and the real
cryptography. If it passes, the product works end to end.

Expect roughly 20–25 minutes for the integration project against a remote Neon
instance. Almost all of that is network round trips, not computation — the tests
exercise real foreign keys, cascades and the append-only trigger, which a mocked
database could not verify. The `unit` project finishes in seconds, which is the
whole reason it was split out.

Run a single file while iterating:

```bash
cd api && npx vitest run tests/consent-decisions.test.ts
```

SDK checks live in `sdk/`:

```bash
cd sdk && npm run typecheck && npm run build
```

### 10) Vercel note

If you eventually deploy `api/` to Vercel, set the same `DATABASE_URL` in the Vercel project environment variables. Use the Neon pooled connection string there as well; do not create a deployment config in this repo unless it is explicitly requested.

## Shared contract to keep in sync

Keep the following aligned when making changes:

- [docs/event-schema.md](docs/event-schema.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/sdk-api.md](docs/sdk-api.md)
- [docs/tenancy.md](docs/tenancy.md)
- [docs/consent.md](docs/consent.md)
- [docs/crawler.md](docs/crawler.md), [docs/scan-api.md](docs/scan-api.md)
- [docs/secure-transfer.md](docs/secure-transfer.md)
- [docs/lifecycle.md](docs/lifecycle.md)
- [docs/mvp.md](docs/mvp.md)
- [shared/event.ts](shared/event.ts), [shared/tenancy.ts](shared/tenancy.ts), [shared/consent.ts](shared/consent.ts), [shared/transfer.ts](shared/transfer.ts), [shared/authorisation.ts](shared/authorisation.ts), [shared/audit.ts](shared/audit.ts) and [shared/analytics.ts](shared/analytics.ts)
- [secure-transfer/envelope.ts](secure-transfer/envelope.ts) — the AAD definition in particular, since both fiduciaries must rebuild it byte-identically
- [database/prisma/schema.prisma](database/prisma/schema.prisma)
- [database/consent.ts](database/consent.ts), [database/transfers.ts](database/transfers.ts), [database/authorisation.ts](database/authorisation.ts), [database/audit.ts](database/audit.ts) and [database/analytics.ts](database/analytics.ts)
- [api/app/api/v1/events/route.ts](api/app/api/v1/events/route.ts)
- [api/app/api/v1/consent/route.ts](api/app/api/v1/consent/route.ts)
- [api/lib/auth.ts](api/lib/auth.ts)
- [docs/policy-engine.md](docs/policy-engine.md), [policy/disposition.ts](policy/disposition.ts) and [policy/model.ts](policy/model.ts) - the engine reads `docs/regulations/generated/`, so a matrix rebuild is a change to its input
- [docs/jurisdiction-resolution.md](docs/jurisdiction-resolution.md) and [policy/jurisdiction-rules.ts](policy/jurisdiction-rules.ts) - the region mapping is versioned configuration; changing it changes which law a visitor is read under

This project intentionally keeps the API focused on ingestion, the consent record and authorised data movement. The analytics/dashboard side still reads the database directly for its own reporting and builds the compliance engine on top of the consent vocabulary; `/api/v1/analytics/*` is a narrow, tenant-scoped alternative for aggregate activity, not a replacement for that access.
