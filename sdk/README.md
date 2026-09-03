# SDK

Browser SDK that captures events, batches them, and delivers them to the
ingestion API.

## Responsibilities

- Provide an ergonomic API for integrators to record events.
- Emit `page_view` and `session_start` automatically, plus custom events via
  `track(name, properties)`.
- Produce events matching [`../docs/event-schema.md`](../docs/event-schema.md).
- Batch and transmit events with retry and backoff; buffer to `localStorage`
  during outages, capped at 50 events.
- Flush the queue on page hide/unload with `fetch(..., { keepalive: true })`.
- Record and read consent decisions for an anonymous browser principal via
  `analytics.consent`, with no UI of its own.

## Usage

```js
analytics.init("site_demo", "pk_demo_12345", { apiUrl: "https://api.example.com" });
analytics.track("signup_started", { plan: "pro" });
```

The second argument is the **site public key**. It is designed to be embedded in
page source and is not a secret — see [`../docs/tenancy.md`](../docs/tenancy.md).
The SDK never handles an organisation secret key (`sk_...`).

Re-calling `init()` with a different site or key rebuilds the client, so events
are never sent under a previous site's credentials.

The unload flush uses `fetch(..., { keepalive: true })` rather than
`navigator.sendBeacon`: it survives page unload but, unlike `sendBeacon`, can set
the `Authorization` header. It also does not report a success the SDK cannot
verify, so the persisted queue is kept and re-sent on the next load, where the
API deduplicates by `event_id`.

## Consent

`analytics.consent` records and reads consent decisions against
`/api/v1/consent`, authenticating with the same site public key. It is headless:
it owns identity, transport and caching, and renders nothing, so a banner is
free to be any framework — or absent entirely.

```js
await analytics.consent.grant("analytics");     // -> true on success
await analytics.consent.deny("marketing");
await analytics.consent.withdraw("analytics");
await analytics.consent.record("analytics", "GRANTED");

analytics.consent.isGranted("analytics");   // sync, from cache
await analytics.consent.getState();         // fetch and refresh the cache
analytics.consent.getCachedState();         // sync, never throws
analytics.consent.getPrincipalId();         // sync; null if none established yet
analytics.consent.getSessionToken();        // sync; null if no live session

const unsubscribe = analytics.consent.onChange((state) => renderBanner(state));
```

`status` is one of `GRANTED`, `DENIED`, `WITHDRAWN`. `WITHDRAWN` is distinct from
`DENIED` on purpose — refusing up front and revoking a previously given consent
are different events, and the server keeps both.

`grant`/`deny`/`withdraw`/`record` accept an options object:
`{ noticeId, policyVersionId, decidedAt, metadata }`, and resolve to a boolean —
`true` if the decision was recorded, `false` if it failed. They never throw. A
decision's response carries the recomputed effective state, so the cache is
refreshed without a second request.

`purposeCode` must name a purpose the site's **organisation** has already
declared. Purposes are reference data created on the management plane
(`POST /api/v1/purposes`, or the seed script) — a browser cannot invent one, so
`grant("undeclared")` resolves `false` and warns.

Nothing here is written on the analytics side: no consent flag is attached to
events. See [`../docs/consent.md`](../docs/consent.md).

### Consent sessions happen for you

Recording a decision needs more than the site public key. That key ships in page
source, so authenticating a permanent, append-only write with it alone let anyone
record a decision for anyone; `POST /api/v1/consent` now also requires a **consent
session**.

The SDK handles this. `grant()` may make two requests on a cold start — one to
open a session, one to record — and it is still a single `await` from your side.
An expired session is renewed transparently, once, before a call is reported as
failed, so nobody has to click Accept twice because a token aged out while they
were reading the banner.

What that means in practice:

- **The server mints the principal identifier**, when the session is opened, and
  returns a secret alongside it. The SDK stores both.
- **Clearing browser storage makes this browser a new principal.** That was
  already true; the server now agrees rather than accepting whatever identifier
  the browser presents.
- **You do not need to touch any of this.** `getSessionToken()` is exposed only
  because the analytics client attaches it on sites that enforce consent
  server-side.

The mechanism, and what it deliberately does not prove, is in
[`../docs/security.md`](../docs/security.md).

### Wiring consent to the event gate

This is **not** automatic. The SDK does not decide that analytics requires
consent — a regulation and an integrator do — so `setConsentCheck` keeps its
permissive default until you say otherwise:

```js
analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
```

Because `isGranted()` reads a `localStorage` cache, the gate answers correctly on
the first paint of a later page load, before any network call resolves. An
unknown purpose is never treated as permission — only `GRANTED` permits, and
absence of a decision is not consent. That rule lives once, in `isPurposeGranted`
in `@rift-cmp/shared`, which the API calls too, so the two cannot disagree.

`analytics.track()` checks the gate with the hard-coded purpose `"analytics"`; a
blocked call returns `false` rather than throwing. Until `setConsentCheck` is
called the default check is permissive.

**This gate is a courtesy, not enforcement.** It runs in the browser, in code the
caller controls. A site that wants the rule actually enforced sets
`analytics_consent_purpose` on the site (`PATCH /api/v1/sites/{siteId}`); the API
then re-derives the decision from the append-only log on every batch and refuses
the events outright. The SDK attaches its session token so the server knows which
principal to look up, never mints a principal just to send analytics, and drops a
batch the server refuses on consent grounds rather than retrying it.

If `getState()` cannot reach the API it returns the last known state rather than
an empty list: a dropped request is not evidence that consent was revoked.

### Identity and storage

A principal id is established the first time a consent session is opened — by
`record()` and its aliases — and persisted in `localStorage` under
`rift_cmp_principal_id`, alongside the secret that proves this browser owns it
(`rift_cmp_principal_secret`) and the current session token
(`rift_cmp_consent_session`). The server mints the first two; a client that chose
its own identifier could choose somebody else's.

`getState()` no longer mints anything: a browser that has never decided anything
has no state to read, and creating an identity for it would manufacture exactly
the durable identifier this product exists without.

All of that is independent of the analytics session id (`rift_cmp_session_id`,
`sessionStorage`): a session ends after inactivity, a principal persists across
visits. The last known effective state is cached under `rift_cmp_consent_state`.

The id is opaque to the server, and it is scoped to one site: the same value
presented on a different site is a different principal. There is no cross-site
identity.

`getPrincipalId()` is a pure read — it does not mint an id, so `clear()` genuinely
leaves no identifier behind until the next decision.

`analytics.consent.clear()` forgets the cached state, the principal id, its
secret and the session token, locally. It does not call the API — the server-side
decision log is append-only for audit, so this is "this browser forgets who it
was", not erasure. The next decision starts a new principal.

Every method is safe before `init()` and safe when `localStorage` is unavailable
(Safari private mode, disabled storage): it warns and returns an empty or falsy
value rather than throwing into the host page.

## Structure

```
sdk/
├── src/         # implementation (client.ts events, consent.ts consent,
│                #   index.ts the `analytics` facade)
└── examples/    # demo.html, a runnable integration with consent buttons
```

`examples/demo.html` is deliberately **not** a consent banner. Its buttons only
exercise the consent API by hand so the pipeline can be driven end to end;
building the real banner belongs to the other side of the platform.

## Checks

```bash
npm run typecheck
npm run build     # tsup -> dist/index.global.js (IIFE, global `analytics`)
```

Rebuild the bundle after changing anything under `src/`; `examples/demo.html`
loads `dist/index.global.js` directly.

## Where the built bundle is served

`api/scripts/copy-sdk.mjs` copies `dist/index.global.js` to
`api/public/js/rift-cmp.js`, so the API serves it at **`/js/rift-cmp.js`**. That
is the path the dashboard's install snippet tells an operator to paste:

```html
<script src="/js/rift-cmp.js"></script>
```

The copy runs from `api`'s `predev` and `prebuild` steps, and the repo-root
`npm run dev` and `npm run build` build this workspace first, so a normal start
publishes a current bundle. `api/public/js` is gitignored — the served file is
build output, not something committed. If the SDK has not been built, the copy
script warns and exits without failing the build, and that URL 404s until it has.

The published path is **unversioned and carries no integrity hash**: it is
whatever the last build produced. A real deployment wants a versioned URL and an
SRI hash so a customer page can verify what it loads. See the known limitations
in [`../docs/mvp.md`](../docs/mvp.md).

## Status

Implemented. There are no unit tests inside `sdk/`; the event contract it produces
is covered by the API test suite in `api/tests/`, and `api/tests/consent-sdk.test.ts`
drives the real `ConsentClient` — imported from source, not from the built
bundle — against the real consent route handlers.
