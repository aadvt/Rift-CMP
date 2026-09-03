# Security Model

This document owns one question: **what does Rift-CMP actually enforce, and what
merely raises the cost of an attack?** It was written in Phase 6A, alongside the
changes it describes, and it is deliberately organised around that distinction
rather than around features.

Three words are used precisely throughout, and nowhere loosely:

| | Means |
| --- | --- |
| **Enforced** | The property holds against a caller who controls the client entirely. Breaking it requires breaking a credential, the database, or the code. |
| **Defence in depth** | The property holds against a realistic attacker, and does not hold against a determined one who simply declines to behave like a browser. It is worth having and must never be relied on alone. |
| **Limitation** | The MVP does not do this. Stated so nobody has to discover it. |

Everything in [mvp.md](mvp.md) about credentials, tenancy and the transfer trust
boundary still applies. This document adds the Phase 6A layer on top and does not
restate it.

## The threat this phase was about

The site public key ships in page source. That is by design and is safe for
*ingestion* — appending analytics events for a site anyone can already visit is
not a privileged act. It stopped being safe the moment the same credential was
the only thing standing in front of two other things:

1. **Recording a consent decision.** The decision log is append-only, so a
   forged `GRANTED` for a named principal was permanent and unremovable. A
   compliance record that can be fabricated by anyone who views page source is
   worse than no record: it is evidence of a decision that never happened.
2. **Deciding what analytics may be collected.** The SDK gated events
   client-side. The gate ran in code the caller controls, so it stopped honest
   integrators and nobody else.

Both are closed below. Neither is closed by trusting the browser more.

---

## 1. Consent decision authenticity — **enforced**

`POST /api/v1/consent` now requires a **consent session** in addition to the site
public key. This is a breaking change to the documented contract, made
deliberately, because the previous contract did not hold up.

### The mechanism

```text
   Browser                                   Rift
   -------                                   ----
   first visit
     POST /api/v1/consent/session  ------->  mints a Principal and a
       Authorization: Bearer pk_             256-bit principal secret;
       {}                                    stores only sha256(secret)
                                <---------   { principal_external_id,
                                               principal_secret,      <- once
                                               session_token,         <- 30 min
                                               expires_at, max_decisions }

   later visits
     POST /api/v1/consent/session  ------->  looks the principal up on this
       { principal_external_id,              site, compares sha256(secret)
         principal_secret }                  in constant time
                                <---------   { session_token, ... }
                                               principal_secret: null

   recording a decision
     POST /api/v1/consent        ------->    resolves the session on *this*
       Authorization: Bearer pk_             site, checks the body's principal
       X-Rift-Consent-Session: cs_...        matches the session's, charges one
       { principal_external_id, ... }        decision against the cap, appends
```

Implementation: [`../database/consent-sessions.ts`](../database/consent-sessions.ts).
Storage: `principals.secret_hash` and the `consent_sessions` table.

### What is enforced

- **A decision can only be recorded against a principal whose secret the caller
  holds.** Knowing a principal identifier — from an audit export, a log line, a
  shared device, a screenshot — is no longer sufficient. This is the property
  that did not exist before.
- **The client cannot choose its own principal identifier.** The server mints it.
  A client that picked its own could collide with, or squat on, an identifier it
  expected to see later.
- **A session is bound to one site.** The site is taken from the credential, so a
  session minted on site A is refused on site B even inside one organisation.
- **A session expires** (30 minutes) **and caps how many decisions it may
  record** (50). Both bound replay of a stolen token.
- **Only digests are stored.** Neither the principal secret nor the session token
  is recoverable from a database dump.
- **The cap is charged before the write.** The log is append-only, so a decision
  that turned out to exceed the cap could not be undone.

Tests: [`../api/tests/consent-authenticity.test.ts`](../api/tests/consent-authenticity.test.ts),
written from the attacker's side.

### What this does **not** prove

Read this part. It is the honest boundary of the mechanism.

- **It does not prove a human was involved.** A scripted client can open a
  session, mint a principal, and record decisions about that principal all day.
  Nothing observable from a server distinguishes that from a real browser, and
  no comparable mechanism — proof of work, a CAPTCHA, a signed challenge —
  changes that; they raise cost, they do not establish intent. What the
  mechanism closes is speaking for *somebody else's* principal.
- **It is not a signature over the decision.** There is no per-decision
  cryptographic proof a third party could verify offline. The session is a
  bearer credential resolved server-side, like every other credential here. A
  signature scheme would need key management in the browser and a verification
  story for auditors; both are real work and neither is in this MVP. **No new
  cryptographic protocol was invented for this phase**, which was a design
  constraint, not an accident.
- **A compromised browser is a compromised principal.** Anything that can read
  `localStorage` on the site's origin — an XSS, a malicious extension, a shared
  machine — gets the secret and can record decisions as that person. The secret
  is exactly as protected as the browser storage it lives in.
- **Trust on first use for pre-existing principals.** A principal with
  `secret_hash = null` — created before Phase 6A, by the seed script, or by a
  bulk import — has its secret bound by whoever presents one first. If an
  attacker knows such an identifier and gets there first, they own it, and the
  real browser is locked out. Refusing these outright would instead lock every
  returning visitor out of changing their own mind, which is worse. It is
  time-limited by nature: every principal created from now on is bound at
  creation.
- **`GET /api/v1/consent` is unchanged.** It still answers for one principal
  whose high-entropy identifier the caller already knows. A read cannot forge a
  decision, and requiring a session there would break integrators that read
  state without writing. The exposure is the same one
  [consent.md](consent.md) has always described.

### Losing the secret

Clearing browser storage makes that browser a new principal. This was already
true — the identifier lived in `localStorage` — and the server now agrees rather
than accepting whatever identifier the browser presents. The old decisions remain
in the log, correctly attributed to the principal that made them.

---

## 2. Server-side consent enforcement for analytics — **enforced, per site**

`POST /api/v1/events` gains a server-side gate, controlled by one column:
`websites.analytics_consent_purpose`.

| Value | Behaviour |
| --- | --- |
| `null` (default) | No gate. Exactly the pre-6A behaviour. |
| a purpose code | The batch is refused unless the request presents a consent session **and** that principal's effective consent for that purpose is currently `GRANTED`. |

Set it with `POST /api/v1/sites` or `PATCH /api/v1/sites/{siteId}`.

### Why it is opt-in

Because the platform "encodes no legal rules at all" — that is the standing
commitment in [consent.md](consent.md), and it is why the SDK's consent check has
always defaulted to permissive. Whether analytics on a given site requires
consent is a question about a jurisdiction and a purpose, and Rift is not the
thing that answers it. What Rift can do, and now does, is enforce the answer the
fiduciary gives instead of leaving it to a browser.

Defaulting the gate *on* would also have silently broken every existing
integration, which is not an acceptable way to ship a security fix.

### What is enforced when it is on

- **The decision is re-derived from the log on every batch.** The session names a
  principal; `consent_records` says whether that principal permits the purpose.
  A withdrawal therefore takes effect on the *next request*, not when a cached
  token happens to expire.
- **Absence of a decision is not permission.** A valid session with no decision
  behind it is refused, the same rule `isPurposeGranted` applies everywhere else.
- **The purpose the site named is the purpose checked.** Consent for a different
  purpose does not unlock ingestion.
- **A session from another site does not work**, even if consent was genuinely
  granted there.
- **Nothing is persisted.** The principal is resolved in-request to answer "may
  these events be stored", and never written onto a session or event row. The
  architectural rule that analytics carries no consent state and no persistent
  person identifier — [mvp.md](mvp.md), "The five domains" — is intact, and there
  is a test asserting the identifier does not appear on the stored rows.

The SDK attaches the session token when it already has one and **never mints a
principal in order to send analytics**: creating an identity for a visitor who
has decided nothing would manufacture exactly the durable identifier the
analytics domain exists without. On a `403` it drops the batch rather than
retrying, because "these events may not be stored" is a final answer.

Tests: [`../api/tests/ingest-consent-enforcement.test.ts`](../api/tests/ingest-consent-enforcement.test.ts).

### Discovery is deliberately not gated

`POST /api/v1/discovery` is rate limited and origin checked but never
consent-gated. Its entire value is recording that something fired *when consent
said it should not*; a consent gate would drop precisely the evidence the domain
exists to capture. Discovery is already not joined to `Principal` and stores
hosts and names, never values — see [discovery.md](discovery.md).

---

## 3. Origin validation — **defence in depth**

Implemented in [`../api/lib/origin.ts`](../api/lib/origin.ts) and applied to all
four browser-facing routes.

| Situation | Result |
| --- | --- |
| No `Origin` header | **Allowed.** |
| `Origin` matches the site's `domain`, its `www.` form, or a subdomain | Allowed, and echoed in `Access-Control-Allow-Origin` |
| `Origin` is listed in `websites.allowed_origins` (exact origin match) | Allowed |
| Loopback (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`), any port, outside production | Allowed |
| Anything else, including the literal `null` origin | `403 origin_not_allowed` |

**The first row is the whole limitation, and it is why this is not a control.** A
browser cannot lie about its origin; anything that is not a browser simply does
not send one, and that is indistinguishable from a legitimate server-to-server
call. So this raises the cost of abusing a stolen public key *from a web page* —
the realistic attack, since the key is in page source — and proves nothing about
consent. There is a test named after exactly that
([`../api/tests/origin-validation.test.ts`](../api/tests/origin-validation.test.ts),
"an absent Origin is allowed, and that is the whole limitation").

Two implementation notes worth keeping:

- Matching is on the parsed hostname, not `endsWith`, so `notexample.com` does
  not match `example.com`.
- Authentication runs **before** the origin check, so a bad credential is a `401`
  and never a `403`. Otherwise the origin check would leak which keys exist.

Preflight `OPTIONS` still answers `*`. A browser sends no `Authorization` header
on a preflight, so the site — and therefore its allowed origins — is genuinely
unknown at that point. The real request is checked.

---

## 4. Rate limiting — **defence in depth**

A fixed-window counter in a `Map`:
[`../api/lib/rate-limit.ts`](../api/lib/rate-limit.ts).

| Bucket | Limit | Applies to |
| --- | --- | --- |
| client address, pre-authentication | 300 / min | every browser-facing route |
| site + client address | 120 / min | `POST /api/v1/events` |
| site | 6000 / min | `POST /api/v1/events` |
| site + client address | 30 / min | `POST /api/v1/consent` |
| site + client address | 120 / min | `GET /api/v1/consent` |
| site + client address | 20 / min | `POST /api/v1/consent/session` |
| site + client address | 60 / min | `POST /api/v1/discovery` |

Order matters: the pre-authentication limit is applied **first**, so an
unauthenticated flood cannot make the database perform a credential lookup per
request. Refusals carry `Retry-After` and `RateLimit-*` headers, and keep their
CORS headers so the SDK can read the status rather than seeing an opaque network
error.

The tightest limit is on session creation, because that is the only anonymous
endpoint that creates a row.

### What it does not do

- **It is per process.** Counters live in memory, reset on deploy, and are not
  shared between instances. Two instances mean twice the configured limit.
- **It is defeated by rotating `x-forwarded-for`.** That header is meaningful
  only behind a proxy that overwrites it, and forgeable by anyone talking to the
  app directly. The per-site ceilings do not depend on it, which is why they
  exist.
- **It is not a quota system.** There is no per-site plan, no billing, no
  backpressure signal.

A Redis-backed limiter would fix the first two and add a service to operate. That
trade is not worth making until this is deployed as more than one process, and
"do not introduce unnecessary infrastructure" was an explicit constraint of the
phase. Both limitations are asserted in the tests rather than only written here.

---

## 5. Immutable audit semantics — **enforced (database triggers)**

Before Phase 6A only `consent_records` was protected, and only against `UPDATE`.
The audit timeline is a projection over three tables; the other two — the routing
tables — were ordinary mutable rows. "This transfer was permitted by consent
record X" was a claim anything with database access could quietly rewrite.

Neither routing table can be strictly append-only: an authorisation is consumed,
a transfer is delivered. So the guarantee is narrower and more useful.

### `transfer_authorisations`

| | |
| --- | --- |
| Immutable | `id`, `organisation_id`, `site_id`, `principal_id`, `purpose_id`, `recipient_id`, `consent_record_id`, `nonce`, `expires_at`, `created_at` |
| Permitted transitions | `AUTHORISED → CONSUMED`, `AUTHORISED → EXPIRED` |

Re-arming a consumed single-use permission is refused, which is replay protection
the application layer alone could not promise.

### `transfer_records`

| | |
| --- | --- |
| Immutable | `id`, `organisation_id`, `authorisation_id`, `ciphertext`, `iv`, `auth_tag`, `ephemeral_public_key`, `ciphertext_sha256`, `payload_bytes`, `recorded_at` |
| Permitted transitions | `RECORDED → DELIVERED`, `RECORDED → FAILED` |
| Write-once | `delivered_at`, `failure_reason` |

### Deletion, and offboarding

`DELETE` on `consent_records`, `transfer_authorisations` and `transfer_records`
is refused **unless** the surrounding transaction has set
`rift.offboarding = 'on'`.

`deleteOrganisation()` in [`../database/tenancy.ts`](../database/tenancy.ts) is
the only thing in this repository that sets it, and it uses `SET LOCAL`, so the
permission expires with the transaction and cannot leak onto a pooled connection.
Offboarding a tenant therefore still works, in one call, and everything else that
would delete history — an ad-hoc `psql` session, a mistaken script, a cascade
nobody expected — fails loudly.

This is a change to what [consent.md](consent.md) previously documented, which
said `DELETE` was deliberately unguarded because offboarding cascades from
`organisations`. That reason is now handled by the explicit mechanism; the second
reason given there, that a future retention or erasure job will need to remove
rows, is handled by the same flag when such a job exists. None does today.

`TRUNCATE` does not fire row-level triggers. The test harness truncates between
tests and is unaffected; a production `TRUNCATE` is not a silent rewrite, it is
an obvious catastrophe.

Tests: [`../api/tests/audit-immutability.test.ts`](../api/tests/audit-immutability.test.ts),
which reach past the API and issue the statements through Prisma — a guarantee
that only holds while the application layer behaves is not a guarantee.

---

## 6. Dashboard credentials — **risk reduced, limitation remains**

### What it was

The dashboard signed in with the organisation secret and put that secret,
verbatim, into an eight-hour `httpOnly` cookie. Page script could not read it and
cross-site requests did not carry it, but the cookie **was** the credential:
anything that obtained it held the whole organisation, and there was no way to
revoke one session short of rotating a secret the API has no endpoint to rotate.

### What it is now

The cookie holds an opaque `ds_` token. The organisation secret is sealed at rest
in `dashboard_sessions` with AES-256-GCM, under a key derived with HKDF-SHA256
from that token, salted with the session id.
([`../database/dashboard-sessions.ts`](../database/dashboard-sessions.ts).)

| Property | Before | Now |
| --- | --- | --- |
| Cookie contents | the organisation secret | an opaque token |
| Database dump yields the secret | n/a — it was in the cookie | no: ciphertext only, and the key is not stored |
| Cookie alone yields the secret | yes | no: the row is needed too |
| Revoking one session | impossible | delete the row; sign-out does |
| Idle timeout | none | 60 minutes |
| Absolute lifetime | 8 hours | 8 hours (unchanged) |

Standard primitives used as intended: a fresh random 96-bit IV per seal, the GCM
tag stored beside the ciphertext, HKDF because the token is high-entropy random
material rather than a password. Nothing novel.

`api/lib/dashboard/session.ts` is now the one place in `api/` outside the route
handlers that imports `database`. The dashboard's "no page imports `database`"
rule is about **product data** — every screen still reads consent, transfers and
analytics over HTTP like any other integrator. A session store is infrastructure,
and routing it through the public API would mean publishing an endpoint that
hands out organisation secrets.

### The limitation that remains — stated plainly

**There are still no user accounts, no roles, and no per-user identity.** A
session is a container for the one shared organisation credential, not a
credential derived from a person. Every session speaks for the entire
organisation: every site, the whole consent history, the audit trail, the
analytics, and the ability to authorise transfers. The audit trail records what
the organisation did, never who did it. There is no read-only auditor, and no
separation between someone who may read the decision log and someone who may
move data.

Building that is a product, not a hardening pass, and it was explicitly out of
scope for this phase. The change above reduces the blast radius of a stolen
cookie and makes sessions revocable; it does not make the dashboard
multi-user-safe. There is a test asserting exactly this, so the limitation cannot
drift out of the documentation unnoticed.

Rotating an organisation secret still has no endpoint. `revokeAllDashboardSessions`
exists as the nearest available response to a suspected compromise.

---

## Summary table

| Concern | Status | Where |
| --- | --- | --- |
| Consent decision bound to a principal's secret | **Enforced** | `database/consent-sessions.ts` |
| Consent decision proves a human decided | **Not achieved** — see §1 | — |
| Analytics ingestion gated on the consent log | **Enforced**, per site, opt-in | `api/lib/ingest-guard.ts` |
| Discovery gated on consent | **Deliberately not** — see §2 | — |
| Origin validation | **Defence in depth** | `api/lib/origin.ts` |
| Rate limiting | **Defence in depth**, per process | `api/lib/rate-limit.ts` |
| Consent records not rewritten | **Enforced** (trigger) | migration `20260831180000` |
| Authorisations and transfers not rewritten | **Enforced** (trigger) | migration `20260903120000` |
| History not silently deleted | **Enforced** (trigger + explicit opt-in) | `database/tenancy.ts` |
| Dashboard cookie is not the credential | **Enforced** | `database/dashboard-sessions.ts` |
| Per-user accounts and roles | **Limitation** | — |

## Operational notes

- **Sessions accumulate.** `consent_sessions` and `dashboard_sessions` both grow
  until something removes them. `purgeExpiredConsentSessions` and
  `purgeExpiredDashboardSessions` exist; **nothing calls them**, because this MVP
  has no scheduler. An expired row is unusable, so this is a housekeeping
  problem, not a security one — but it is a real one.
- **Neither table is history.** No read model projects them and no audit entry
  references one, so deleting an expired session destroys no evidence. That is
  why they are exempt from §5's deletion guard.
- **TLS is still assumed, not provided.** Every credential in this document —
  the session token, the principal secret, the dashboard cookie — travels in
  plaintext without it. Unchanged from [mvp.md](mvp.md).
