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
- Flush the queue on page hide/unload with `navigator.sendBeacon`.
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

Because `sendBeacon` cannot set headers, the unload flush passes the public key as
a `?pk=` query parameter instead of an `Authorization` header.

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
analytics.consent.getPrincipalId();         // sync; null if none minted yet

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

If `getState()` cannot reach the API it returns the last known state rather than
an empty list: a dropped request is not evidence that consent was revoked.

### Identity and storage

A random `crypto.randomUUID()` principal id is minted the first time one is
needed — by `record()` or `getState()` — and persisted in `localStorage` under
`rift_cmp_principal_id`. It is independent of the analytics session id
(`rift_cmp_session_id`, `sessionStorage`): a session ends after inactivity, a
principal persists across visits. The last known effective state is cached under
`rift_cmp_consent_state`.

The id is opaque to the server, and it is scoped to one site: the same value
presented on a different site is a different principal. There is no cross-site
identity.

`getPrincipalId()` is a pure read — it does not mint an id, so `clear()` genuinely
leaves no identifier behind until the next decision.

`analytics.consent.clear()` forgets the cached state and the principal id
locally. It does not call the API — the server-side decision log is append-only
for audit, so this is "this browser forgets who it was", not erasure.

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

## Status

Implemented. There are no unit tests inside `sdk/`; the event contract it produces
is covered by the API test suite in `api/tests/`, and `api/tests/consent-sdk.test.ts`
drives the real `ConsentClient` — imported from source, not from the built
bundle — against the real consent route handlers.
