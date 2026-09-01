# The MVP

This is the whole product in one document: what Rift-CMP is, how the pieces fit,
what it assumes to be true, and what it does not do. The other documents in
`docs/` each own one domain in depth. This one owns the seams between them and
the honest account of the result.

## What the product is

Rift-CMP is a consent management platform with an analytics pipeline attached.
A customer website embeds a browser SDK; the SDK reports page and session
activity, and separately records the decisions a person makes about what their
data may be used for. Those decisions are kept as an append-only log, and they
are the thing that permits action: when a Data Fiduciary wants to move a
person's data to a third party, Rift evaluates the decision currently in force,
mints a single-use authorisation naming the exact consent record it relied on,
and relays a payload it cannot read — the source seals it, the target holds the
only decryption key. Everything that happened reads back as one timeline, and an
operator dashboard renders that timeline, the decision log, the transfer log and
the SDK's activity counts. The platform records structure and enforces one rule:
the decision in force must be `GRANTED`. It encodes no legal rules at all.

## The rule the whole system exists to make true

> A recorded consent decision is what permits an action. Nothing may act on a
> Data Principal's data without one, and the record of what happened must always
> name the exact decision it relied upon.

[lifecycle.md](lifecycle.md) is where that sentence is worked out end to end.

## Architecture

```text
   Browser (customer site)              Rift-CMP (this repo)                Other systems
   ----------------------               --------------------                -------------

   +-----------------+   pk_   +--------------------------------------+
   | SDK             | ------> | Ingestion plane                      |
   |  page_view      |  events |   POST /api/v1/events                | --> sessions, events
   |  session_start  |         |                                      |
   |  track()        |   pk_   |                                      |
   |  consent client | ------> |   POST|GET /api/v1/consent           | --> consent_records
   +-----------------+ consent +--------------------------------------+     (append-only)
                                                  |
                                                  | getEffectiveConsent
                                                  v
   +-----------------+   sk_   +--------------------------------------+
   | Source          | ------> | Orchestration                        |
   | Fiduciary       |         |   evaluateAuthorisation (no writes)  |
   | holds the       |         |   POST /api/v1/authorisations        | --> transfer_
   | plaintext       | <------ |   POST /api/v1/authorisations/       |     authorisations
   |                 | pubkey  |        decision                      |
   | seals locally:  | binding +--------------------------------------+
   | ECDH -> HKDF    |                          |
   |      -> AES-GCM |   sk_                    v
   |                 | ------> +--------------------------------------+
   +-----------------+envelope | Secure transfer                      | --> transfer_records
                               |   POST /api/v1/transfers             |     (ciphertext,
                               |   GET  /api/v1/transfers/pending     |      digest, size)
                               |   GET  .../{id}/envelope   <-- rk_ ----- Target Fiduciary
                               +--------------------------------------+    holds the X25519
                                                  |                        private key;
                                                  v                        opens it
                               +--------------------------------------+
                               | Read models                          |
                               |   GET /api/v1/audit                  |
                               |   GET /api/v1/analytics/summary      |
                               |   GET /api/v1/analytics/overview     |
                               |   GET /api/v1/consent/effective      |
                               +--------------------------------------+
                                                  ^
                                                  | HTTP, sk_ read from an
                                                  | httpOnly cookie on the server
                               +--------------------------------------+
                               | Dashboard (api/app/dashboard)        |
                               |   Overview | Consent | Transfers     |
                               |   Analytics | Integration            |
                               +--------------------------------------+
```

Two things in that picture are load-bearing and easy to miss. The sealing and
opening happen **outside** the boxes labelled Rift: the plaintext exists only in
the two fiduciaries. And the dashboard is drawn below the read models, not beside
the database, because it reaches its data the same way any other integrator
would — over HTTP, with a credential.

### Workspace layout

```text
rift-cmp/
  sdk/              browser SDK: batched event capture and a headless consent
                    client. Authenticates with a site public key only.
  shared/           the contracts neither side may drift from: event, tenancy,
                    consent, transfer, authorisation, audit, analytics, api
  secure-transfer/  envelope.ts   Rift-safe: canonical AAD, digest, shape checks
                    fiduciary.ts  key generation, seal, open - fiduciaries only,
                                  and never imported by api/ or database/
  database/         Prisma schema and the service layers: keys, tenancy, consent,
                    transfers, authorisation (orchestration), audit and analytics
                    (read models). Every function takes its tenant explicitly.
  api/              Next.js App Router. Three API planes under app/api/, and the
                    operator dashboard under app/dashboard/.
  docs/             this document and the ones it links to
```

The split between `secure-transfer/envelope.ts` and `secure-transfer/fiduciary.ts`
is the only place in the repo where a directory boundary is also a trust
boundary, and it is enforced by a test rather than by discipline:
`api/tests/transfer-boundary.test.ts` walks every `.ts`/`.tsx` file under `api/`
— excluding `tests/`, which plays both fiduciaries — and fails if one of them
contains a real import of the fiduciary half.

## Credentials

Three credentials authenticate the HTTP surface. They are never interchangeable,
and the check is on the prefix, before any database lookup, so no plane can be
probed with another plane's key.

| | Site public key | Organisation secret key | Recipient delivery key |
| --- | --- | --- | --- |
| Format | `pk_` + 32 hex | `sk_` + 64 hex | `rk_` + 64 hex |
| Identifies | one **website** | one **organisation** | one **recipient** |
| Lives in | browser code, page source | server-side config | the target fiduciary |
| Stored as | plaintext — it is not a secret | SHA-256 digest only | SHA-256 digest only |
| Shown | on every read of the site | once, at provisioning | once, at registration |
| **Can** | append events for that site; record one decision; read one principal's effective state | everything that organisation owns: sites, consent history, reference data, recipients, authorisations, transfers, audit, analytics | list and collect envelopes addressed to that one recipient |
| **Cannot** | enumerate principals, read history, reach the management plane at all | act on another organisation; decrypt anything | read what it collects, reach any other recipient's envelopes, or touch the other two planes |
| Plane | ingestion (CORS open) | management (no CORS) | delivery (no CORS) |

Each of the three is a `401` on either of the other two planes, and a `401` for a
missing, malformed or unknown key — the same response in every case, so no
endpoint can be used to test whether a key exists.

### The dashboard cookie

The dashboard has no fourth credential. It signs in with the **organisation
secret key** and stores it in a cookie:

| | |
| --- | --- |
| Name | `rift_dashboard_key` |
| Contents | the organisation secret key, verbatim |
| Flags | `httpOnly`, `sameSite: strict`, `path: /`, `secure` when `NODE_ENV=production` |
| Lifetime | 8 hours |
| Read by | server components only, through `readSessionKey()` in `api/lib/dashboard/session.ts` |

`httpOnly` means no page script can read it, so the secret never reaches the
browser as a value — it is attached to outgoing requests on the server, in
`apiGet`, and the browser only ever receives rendered HTML.

**This is an MVP compromise and should be read as one.** The cookie holds a
long-lived, all-or-nothing credential rather than a session token: anything that
can present it *is* the organisation, for every site the organisation owns. There
is no revocation short of rotating the organisation secret, and there is no
endpoint that rotates one. A production system needs user accounts, short-lived
sessions derived from them, and per-user roles — at which point the cookie holds
a session id and the organisation secret stops travelling anywhere near a
browser. See [Known limitations](#known-limitations).

## The five domains

Three of them own tables. Two own no storage at all, and that is the point: the
places where the domains meet are code, not foreign keys, so a join can be
changed or dropped without a migration.

| Domain | Where it lives | Tables | Knows about |
| --- | --- | --- | --- |
| Analytics | written by the ingestion route; read by `database/analytics.ts` | `sessions`, `events` | sites and sessions |
| Consent | `database/consent.ts` | `principals`, `purposes`, `policies`, `policy_versions`, `notices`, `notice_purposes`, `consent_records` | sites and people |
| Secure routing | `database/transfers.ts` | `data_recipients`, `transfer_authorisations`, `transfer_records` | recipients and envelopes |
| Orchestration | `database/authorisation.ts` | none | consent **and** routing — the only module that does |
| Read models | `database/audit.ts`, `database/analytics.ts` | none | all three, for reading only |

The rule that keeps them apart:

> Analytics, consent and secure routing never reference each other. Nothing in
> the consent schema references `Session` or `Event`; no consent flag is written
> onto an analytics row; consent has no foreign key to transfers. They are joined
> in exactly two places — the orchestration layer, which decides, and the read
> models, which report — and both are code.

The consequences are worth stating, because they are what the rule buys:

- **Analytics rows carry no consent state.** A decision that changed after an
  event was written would make a denormalised flag a lie, and events are
  immutable. The link, when one is needed, is `Principal`.
- **Analytics is never joined to `Principal`.** There is no persistent visitor
  identifier in the analytics domain at all — see the limitation on sessions
  below. This is deliberate rather than unfinished.
- **Routing depends on consent without duplicating it.** An authorisation is
  minted only if `getEffectiveConsent` — the same derivation the consent API and
  the SDK use — resolves to `GRANTED`, and the row then stores the exact
  `consent_records` id, never a copied boolean.
- **The audit trail is a projection.** `getAuditTrail` runs three queries and
  merges them in memory. A foreign key would tidy the query and couple two
  domains in a place that needs a migration to undo.
- **`getPlatformOverview` does the same thing again.** It counts each domain
  independently and assembles the result in TypeScript.

## The dashboard is a pure API consumer

Every screen under `api/app/dashboard/` reads through one function, `apiGet` in
[`../api/lib/dashboard/api.ts`](../api/lib/dashboard/api.ts), which makes a real
HTTP request to the platform API with the organisation secret from the session
cookie. **No page imports `database`, and no page touches Prisma.**

That is slower than querying directly, and it is the point: if a screen needs
something the API cannot express, **the API is what changes.** `/api/v1/consent/effective`
exists precisely because that rule was followed rather than worked around.

| Page | Reads |
| --- | --- |
| Overview | `GET /api/v1/analytics/overview`, `GET /api/v1/audit?limit=15` |
| Consent | `GET /api/v1/sites`, `GET /api/v1/consent/history`, `GET /api/v1/consent/effective` |
| Transfers | `GET /api/v1/sites`, `GET /api/v1/authorisations`, `GET /api/v1/transfers` |
| Analytics | `GET /api/v1/sites`, `GET /api/v1/analytics/summary` |
| Integration | `GET /api/v1/sites`, `/purposes`, `/recipients`, `/notices`, `GET /api/healthz` |

Each page issues its requests with `Promise.all` and renders each result
independently, so one failing endpoint degrades one panel instead of blanking the
screen.

The layout's redirect to `/signin` is **convenience, not security.** The API
authenticates every request on its own; a page reached without a valid key would
render nothing but errors. The guard exists so an operator sees a sign-in form
instead of a wall of `401`s.

### Why `/api/v1/consent/effective` exists

The dashboard needs the decisions currently in force for one principal. Two
routes to that answer were already in the codebase, and both are wrong here:

- `GET /api/v1/consent` answers exactly this question, but authenticates with a
  **site public key** — a credential an operator tool does not hold and should
  not be given.
- Re-deriving it from `GET /api/v1/consent/history` means reducing a **paginated**
  list. Past the `limit`, the derived answer is silently wrong: it would report
  the newest decision *on the page it happened to fetch*, not the newest decision
  that exists.

So the management plane got its own endpoint. Both planes reduce the same
append-only log through the same `resolveEffectiveConsent` in
[`../shared/consent.ts`](../shared/consent.ts), so they cannot disagree — the
same reasoning that keeps one definition of "current consent" behind the
authorisation gate.

## What Phase 5 added

| | |
| --- | --- |
| `GET /api/v1/analytics/summary` | Aggregate SDK activity for the organisation: totals, top pages, device/browser/OS breakdowns, per-site rows |
| `GET /api/v1/analytics/overview` | Counts across every domain: sites, consent decisions, authorisations, transfers, plus the activity totals |
| `GET /api/v1/consent/effective` | Effective consent for one principal, on the management plane |
| `limit` on `GET /api/v1/transfers` | Integer 1–500. It was the last unbounded list endpoint |
| The dashboard | Five pages, sign-in, and the httpOnly cookie above |
| The `unit` test project | 37 tests that need no database |

**No schema change.** There is no Phase 5 migration. The analytics read models
aggregate over tables that already existed, using indexes that already existed.
Full request and response shapes are in [api-spec.md](api-spec.md).

## Security assumptions

These are the things the MVP assumes to be true. Each is a real assumption, not a
guarantee this repo provides: if one of them is false, the property it supports
does not hold.

1. **The operator protects the organisation secret.** `sk_` is all-or-nothing
   over one tenant — every site, the whole consent history, the audit trail, the
   analytics, and the ability to authorise transfers. Only its SHA-256 digest is
   stored, so it cannot be re-read from the database; it also cannot be rotated
   over the API, so protection means never disclosing it in the first place.
2. **The target fiduciary protects its X25519 private key.** Rift never holds
   one, never requests one, and has no request shape that would accept one.
   Confidentiality of every payload rests entirely on that side's custody. Our
   inability to decrypt is worth exactly as much as their key management.
3. **TLS terminates in front of the API.** Nothing in this repo encrypts a
   connection. All three credentials travel as bearer tokens in a header, and
   the dashboard cookie is only marked `secure` when `NODE_ENV=production`. On a
   plaintext link every plane is exposed.
4. **Public keys are public, and nothing depends on hiding them.** A site's `pk_`
   ships in page source. A recipient's X25519 public key is what a source
   encrypts to, and is returned in plaintext. Neither is a secret, and no
   security property is claimed from their obscurity.
5. **The database is trusted for availability and integrity, but not for the
   confidentiality of payloads.** A full dump yields ciphertext, digests, sizes,
   routing metadata and key digests — and no plaintext, no private key, and no
   derived symmetric key. It *does* yield everything else: principal ids, the
   whole decision log, page URLs, and who transferred what to whom and when.
   Metadata is not private.
6. **The credential decides the tenant, and nothing bypasses that.** Every route
   derives the organisation from the presented key and scopes every query to it;
   no URL or body field selects a tenant. PostgreSQL enforces the same thing
   independently through composite foreign keys. The assumption is about code
   that does *not* go through the API — the analytics side reads the database
   directly, and is responsible for its own scoping.
7. **Whoever presents an `rk_` key is the recipient it was issued to.** It
   authorises collecting that recipient's envelopes and confers no ability to
   read them, so the blast radius of a leaked delivery key is availability and
   metadata, not confidentiality.
8. **The append-only migration has been applied.** The immutability of
   `consent_records` is a PostgreSQL trigger, not application logic. A database
   the migration never reached provides no such guarantee, and nothing at runtime
   checks that it is present.
9. **Clocks are roughly in sync.** An authorisation's `expires_at` and the
   five-minute future bound on `decided_at` are both wall-clock comparisons
   across two systems.
10. **The browser is not trusted, and does not need to be.** A `pk_` can append
    events and record or read decisions for one principal. It can do nothing
    else, which is why shipping the SDK to arbitrary pages is safe.
11. **The fiduciaries at both ends behave as specified.** They are outside this
    repo. In the tests they are mocks that run in the same process; in a real
    deployment they are systems Rift has no access to and cannot verify.

## Known limitations

The most useful section in this document. Nothing here is a to-do disguised as a
caveat — each one is a thing the MVP genuinely does not do.

### Security and identity

- **No cryptographic review.** The secure routing half is a proof of concept. No
  review, no formal threat model, no HSM, no key rotation story. It must not be
  described as production-secure. See [secure-transfer.md](secure-transfer.md).
- **No user accounts, no roles, no per-user identity.** One shared organisation
  secret is the only operator credential. There is no read-only auditor, no
  separation between someone who may read the consent log and someone who may
  authorise transfers, and no attribution: the audit trail records what the
  organisation did, never who did it.
- **The dashboard cookie holds a long-lived secret.** Eight hours of the
  organisation's full credential, in a cookie. It is `httpOnly` and `sameSite:
  strict`, so page scripts cannot read it and cross-site requests do not carry
  it, but it is the credential itself rather than a token derived from one — and
  there is no way to revoke a single session.
- **No rate limiting anywhere.** Ingestion accepts batches from any holder of a
  public key, which by design is anyone who views page source. There is no
  per-site quota, no per-IP limit, and no backpressure.
- **No origin or domain enforcement.** `websites.domain` is stored and never
  checked. Ingestion CORS is `Access-Control-Allow-Origin: *`, so a site's public
  key works from any page on the internet, not only the domain it was registered
  for.
- **Refused authorisation attempts are not persisted.** A refusal writes no row,
  so nothing records a fiduciary repeatedly probing withdrawn consent. Recording
  refusals means writing on a read path, and designing that — volume, retention,
  what an unauthenticated probe should produce — is separate work.
- **The audit trail is not itself append-only.** Only `consent_records` has the
  trigger. The routing tables do not, and no trigger guards the timeline as a
  whole; it is a projection over three tables, two of which are mutable.
- **No retention or erasure policy.** Events, sessions, consent records and
  delivered envelopes all accumulate indefinitely. A collected envelope stays in
  the table after delivery — unreadable to Rift, but "unreadable" is not
  "deleted". There is no erasure path for a principal who asks to be forgotten;
  `consent.clear()` in the SDK forgets a browser's local identifiers and calls no
  API.

### Analytics

- **Sessions, not unique visitors.** The analytics API reports session counts and
  says so on every screen that renders them. There is no persistent visitor
  identifier in the analytics domain: a session id lives in `sessionStorage` and
  expires after 30 minutes of inactivity, so one person across two days counts
  twice. The one durable per-person identifier in the system is `Principal`,
  which belongs to the consent domain and is deliberately never joined to
  analytics rows. Any number here that looked like "users" would be an
  overstatement of what the data supports.
- **`top_pages` groups by the full URL, query string included.**
  `/pricing` and `/pricing?utm_source=x` are two separate rows competing for the
  same ten slots. The dashboard trims the display to path plus query; the
  grouping underneath is unchanged.
- **`GET /api/v1/analytics/overview` applies `site_id`, `from` and `to` to the
  activity block only.** The sites, consent, authorisation and transfer counts
  are whole-organisation and all-time regardless of the filters. This is not
  signalled in the response.
- **A fixed metric set, not a query API.** Ten top pages, three breakdowns, one
  date range. No time series, no period-over-period comparison, no funnels, no
  custom-property drill-down, no export.

### API surface

- **`notice_id` and `policy_version_id` render as opaque ids.** Consent records
  cite them, and no endpoint resolves one to a notice version or a policy name,
  so the dashboard shows a truncated UUID with the full value in a tooltip. The
  data to do better exists; the API cannot express it yet.
- **`AuditEntry` has no stable id.** The projection carries `kind`, `at` and up to
  three cross-references but no identifier of its own, so a consumer cannot
  address a single timeline entry — the overview table builds a composite React
  key out of whatever fields happen to be present.
- **No pagination cursors.** Every list endpoint takes a `limit` and nothing else.
  There is no `next`, so past the cap there is no way to reach older rows.
- **The audit merge distorts under a small `limit`.** `getAuditTrail` takes
  `limit` rows from each of three tables and sorts in memory, so a very lopsided
  distribution can push older entries of one kind out of the window. A deliberate
  trade for keeping the domains unjoined.
- **No compliance rule engine.** The only rule applied is "the decision in force
  must be `GRANTED`". Whether a purpose requires consent at all, whether a
  decision has gone stale, and what any jurisdiction demands are outside this
  platform by design.
- **Recipients cannot be updated, rotated or removed.** There is no `PATCH`, no
  second active key, and no delete. Rotating a recipient's key means registering
  a new recipient.
- **Delivery is polled, not pushed.** A target fiduciary discovers work by
  calling `GET /api/v1/transfers/pending`. There is no webhook and no
  notification.

### Deployment and operations

- **The dashboard assumes the API is on its own origin.** `apiGet` builds its
  base URL from the incoming `host` header, so the dashboard and the API must be
  the same deployment. Each page render therefore issues HTTP requests to itself.
- **The SDK bundle is unversioned.** `api/scripts/copy-sdk.mjs` copies
  `sdk/dist/index.global.js` to `api/public/js/rift-cmp.js` at build time, which
  is what the install snippet points at. There is no version in the path, no
  integrity hash, and no cache-busting; if the build has not run, the snippet
  404s.
- **Mock fiduciaries run in-process.** Both ends of a transfer are test doubles in
  the same Node process. Nothing has been exercised across a real network
  boundary, a real key store, or a real operational failure.
- **The test suite needs a reachable Postgres.** The `integration` project applies
  migrations to a dedicated `rift_cmp_test` schema and runs single-threaded
  against it. It takes roughly 20–25 minutes against a remote Neon instance, almost
  all of it network round trips. The `unit` project exists so that crypto, key
  format and component tests do not pay for that.

## Beyond the MVP

In priority order. Each of these is pointed at by something in the current code,
not invented from a wishlist.

| # | Feature | Why it is next |
| --- | --- | --- |
| 1 | **User accounts and RBAC** | Removes the one compromise everything else inherits: the shared organisation secret, the cookie that holds it, the absence of attribution in the audit trail, and the impossibility of a read-only auditor all collapse into this |
| 2 | **Origin enforcement and per-site rate limiting** | `websites.domain` is already stored and never checked, and ingestion has no limit of any kind — together, the two gaps that make a public key more powerful than it was meant to be |
| 3 | **Retention and erasure** | The one gap that is also a legal obligation for a consent platform; the schema doc has recorded it since Phase 3, and the append-only trigger blocks `UPDATE` only, so a deletion job is already possible |
| 4 | **A compliance rule engine above the consent vocabulary** | The vocabulary was designed to be read by one and nothing reads it yet. It is the difference between recording decisions and enforcing them |
| 5 | **Name resolution in API responses** | The dashboard renders UUIDs for notices and policy versions because no endpoint turns one into a name. A small addition that makes the consent log readable |
| 6 | **Pagination cursors** | Every list is `limit`-only, so a tenant with real volume cannot reach its older rows at all — and the audit merge already misbehaves when the limit bites |
| 7 | **A served, versioned SDK bundle with SRI** | The install snippet points at an unversioned path filled in by a build step. A versioned URL plus an integrity hash makes what a customer page loads verifiable |
| 8 | **Key rotation for recipients** | Registering a new recipient is currently the only way to change a key, which orphans the transfer history under the old code |
| 9 | **Webhook delivery instead of polling** | `GET /api/v1/transfers/pending` makes latency a function of how often the target asks. A push removes both the delay and the wasted calls |
| 10 | **A read API for the analytics team** | They still query the database directly, outside our authorisation layer. `/api/v1/analytics/summary` is the first piece of the alternative; the rest of the contract is in [integration-contract.md](integration-contract.md) |

## Running the whole thing

From a fresh clone to a working dashboard.

```bash
# 1. Install every workspace from the repo root.
npm install

# 2. Point both apps at the same Postgres. Create api/.env.local and
#    database/.env.local, each containing:
#      DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# 3. Generate the client and apply migrations, from database/.
cd database
npm run generate
npx prisma migrate deploy

# 4. Seed organisations, sites and consent reference data. This prints one
#    organisation secret key (sk_...) per organisation, exactly once - it is
#    what you sign in to the dashboard with.
npm run seed

# 5. Build the SDK bundle and start the API. From the repo root, one command
#    does both; api's predev step copies the bundle to public/js/rift-cmp.js.
cd ..
npm run dev
```

Then:

| What | Where |
| --- | --- |
| Dashboard | `http://127.0.0.1:3000/dashboard` — sign in with the `sk_...` the seed printed |
| Install snippet | Dashboard → Integration, built from the real site id, public key and origin |
| SDK demo page | `python -m http.server 8080` at the repo root, then `http://127.0.0.1:8080/sdk/examples/demo.html` |
| Health check | `http://127.0.0.1:3000/api/healthz` |

The checks, from the repo root:

```bash
npm run test:unit   # 37 tests, no database, seconds
npm test            # all 215 tests; the integration half needs Postgres
npm run typecheck
npm run lint
npm run build
```

## What is proven

`api/tests/mvp-acceptance.test.ts` is one test with twelve steps. It uses the
real SDK, the real route handlers and the real cryptography; the only things
faked are the browser globals the SDK needs and the two fiduciaries, which stand
in for systems this repo does not operate.

| Steps | What they establish |
| --- | --- |
| 1 | An organisation and a site are provisioned, and the site's key is a `pk_` |
| 2–3 | The SDK's events reach ingestion under the site public key and are accepted |
| 4 | A Data Principal grants a purpose through the real `ConsentClient`, which mints its own principal id |
| 5 | A fiduciary registers a recipient and is granted a single-use authorisation |
| 6–7 | The payload is sealed outside Rift, submitted, collected on the delivery plane, and opened by the target — and **only** the target recovers the plaintext |
| 8 | Every dashboard read — overview, summary, audit, effective consent — returns the right counts, and none of the four bodies contains the payload |
| 9–11 | The principal withdraws; the identical request is now `409 consent_not_granted`, and no second authorisation exists |
| 12 | History reads `["WITHDRAWN", "GRANTED"]`, the completed transfer still cites the `GRANTED` record, and the audit trail still shows every step |

If it passes, the product works end to end. Step 8 is deliberately written the
way the dashboard reads: through the HTTP handlers, never the database.

The narrower guarantees — tenant isolation, the crypto boundary, the consent
gate, replay and concurrency — are covered by the rest of `api/tests/` and
described in [tenancy.md](tenancy.md), [consent.md](consent.md),
[secure-transfer.md](secure-transfer.md) and [lifecycle.md](lifecycle.md).
