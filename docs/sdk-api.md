# SDK API

The public interface of `@rift-cmp/sdk` — what a customer's developer may call,
what each call guarantees, and what is deliberately not exposed.

## Loading the SDK in a browser

The bundle publishes the callable SDK as `window.analytics`:

```html
<script src="https://cdn.example.com/rift-cmp.js"></script>
<script>
  analytics.init("site_demo", "pk_demo_12345");
</script>
```

The IIFE is built with an **internal** global name (`__riftCmpBundle`, see
`sdk/package.json`) rather than `analytics`. That matters: a bundler's
`--global-name` emits `var <name> = (() => { … })()` at script top level, and
under classic `<script>` semantics that `var` becomes a property of the global
object *after* the module body runs. When both used the name `analytics`, the
bundler's module namespace overwrote the callable object that
`sdk/src/index.ts` had just assigned, and `analytics.init` was `undefined` —
which broke the install snippet the dashboard hands operators, silently, for as
long as nothing tested the built bundle.

`sdk/scripts/verify-global.mjs` now runs on every `npm -w sdk run build` and
fails it if the collision returns. It loads the real bundle with `vm.Script` in a
context, which is the faithful model of a classic script; `eval()` is not, because
the bundle is strict-mode and a strict eval scopes top-level `var` locally, hiding
the bug.

## What the SDK is and is not

It creates events and sends them over the HTTP contract in
[api-spec.md](api-spec.md). That is the whole job.

It holds **no** database knowledge, computes **no** analytics, and contains
**no** legal rules. It does not decide that analytics requires consent — an
integrator decides that and tells the SDK, see [Consent](#consent). Anything the
SDK appears to know about compliance is something the host page configured.

## Stability

The stable surface is `analytics.init`, `analytics.track`,
`analytics.setConsentCheck`, `analytics.consent` and `analytics.discovery`, plus
the event envelope those produce. Everything else — class names, file layout,
the queue, the storage keys, retry timing — is internal and may change without
notice. See [integration-contract.md](integration-contract.md) for the split.

---

## `analytics.init(siteId, publicKey, options?)`

Initialises the SDK and starts a session.

```js
analytics.init("site_demo", "pk_demo_12345");
```

```js
analytics.init("site_demo", "pk_demo_12345", { apiUrl: "https://ingest.example.com" });
```

The key may also be passed in the options object, which suits build systems that
assemble configuration as one value:

```js
analytics.init("site_demo", { publicKey: "pk_demo_12345" });
```

### Arguments

| Argument | Type | Required | Meaning |
| --- | --- | --- | --- |
| `siteId` | string | yes | The site this page belongs to. Sent as `site_id` in the envelope, where the API **validates it against the key** rather than trusting it. |
| `publicKey` | string | yes | The site's public key (`pk_...`). Safe to embed: it authorises appending events to one site and nothing else. |
| `options.apiUrl` | string | no | Base URL of the API. Defaults to `http://127.0.0.1:3000` (`sdk/src/constants.ts`), which is a development default and must be set for any real deployment. |
| `options.publicKey` | string | no | Alternative to the positional `publicKey`. |

### Returns

An object describing what was initialised, or `null` if initialisation threw:

```js
{ siteId: "site_demo", publicKey: "pk_demo_12345", sessionId: "…", apiUrl: "…" }
```

### Side effects

On success `init()` emits `session_start` (only when a new session begins) and
then `page_view`, and drains anything left in the queue from a previous page.

### Errors

`init()` **does not throw.** A missing `siteId` or `publicKey` is reported with
`console.warn` and returns a result whose `sessionId` may be `null`. This is
deliberate: the SDK runs inside someone else's page, and an analytics tag must
never be able to take that page down. Every public method follows the same rule.

### Re-initialising

Calling `init()` again with a **different** `siteId` or `publicKey` tears down
the analytics, consent and discovery clients and rebuilds them, so events cannot
continue to be sent under the previous site's credentials. Calling it again with
the same credentials is effectively a no-op beyond emitting a new `page_view`.

---

## `analytics.track(name, properties?)`

Queues a custom event.

```js
analytics.track("signup");
```

```js
analytics.track("purchase", {
  product_id: "123",
  value: 499,
  currency: "INR",
});
```

### Arguments

| Argument | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Custom event name. Becomes `name` in the envelope, with `event_type: "custom"`. Max `EVENT_LIMITS.name` (120) characters. |
| `properties` | object | no | Arbitrary JSON, stored in the `properties` JSONB column and preserved exactly. Defaults to `{}`. Bounded — see [Limits](#limits). |

### Returns

Two shapes, and the difference is load-bearing:

| Outcome | Return |
| --- | --- |
| Refused before the event is built — the consent gate denied it, or it failed local validation | `false`, **synchronously** |
| Queued | `Promise<boolean>` resolving `true` |
| `init()` has not run, or something threw | `false`, synchronously |

`await analytics.track(...)` handles both, since `await false` is `false`. The
split is pre-existing — the consent gate has always returned a bare `false` — and
is preserved rather than smoothed over, because normalising it would break every
caller that branches on the result today.

**A `true` does not mean the event was delivered.** It means it reached the
queue. Delivery is asynchronous and its outcome is never reported back. See
[Delivery](#delivery-and-retries).

### Local validation

Before queueing, `track()` checks its input against `EVENT_LIMITS`:

- `name` is a non-empty string within `EVENT_LIMITS.name`
- `properties`, if given, is a plain object (not an array, not a class instance)
- its key count, key lengths and serialised byte size are within their bounds
- it is JSON-serialisable at all — a `BigInt` or circular reference fails here
  rather than throwing later in the database layer

A failure returns `false`, logs one `console.warn` naming the field and the
limit, and **does not queue the event** — so it is not persisted to
`localStorage`, not retried, and not counted in a batch.

Three things this is not:

- **It is not enforcement.** It runs in the caller's browser and can be skipped.
  The API re-checks every one of these bounds and is the authority; this is a
  diagnostic that saves a round trip and names the problem at the call site.
- **It never truncates.** An over-limit event is refused whole. Silently
  shortening a value would send data the caller did not write.
- **It holds no numbers of its own.** Every bound is read from `EVENT_LIMITS` in
  `shared/event.ts`, the same constant the API validates against.

Automatic `page_view` and `session_start` events are not pre-validated: their
fields come from the browser, not from a developer, so there is no call site to
report back to. The API still bounds them.

### Errors

Does not throw. Failures are `console.warn` plus a `false` return.

---

## `analytics.setConsentCheck(fn)`

Registers the gate that decides whether events may be created.

```js
analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
```

`fn` receives a purpose code — currently always `"analytics"` — and returns a
boolean. Returning `false` discards the event before it is queued.

It may be called **before** `init()`, in which case it also gates the automatic
`session_start` and `page_view` that `init()` emits. That ordering matters: a
gate registered afterwards would let the first two events of every page through.

The default is `() => true`. The SDK ships with no opinion about whether
analytics needs consent, because that is a legal question and the SDK is not
where legal questions are answered.

> **This gate is a convenience, not enforcement.** It runs in the visitor's
> browser, in code the caller controls, so it can simply be skipped. A site that
> needs consent actually enforced sets `analytics_consent_purpose` and the API
> re-derives the decision from the append-only log on every batch. See
> [security.md](security.md).

---

## Consent

`analytics.consent` is the headless consent client — identity, transport and
caching, no UI. It is documented in full in [consent.md](consent.md); it is
listed here only so the boundary is visible from the SDK surface.

It is deliberately **not** wired into the event gate by default. Connecting them
is one line, and it is the integrator's line to write:

```js
analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
```

Before `init()`, every method on `analytics.consent` degrades safely: it warns,
denies, and carries on. `isGranted()` returns `false` rather than throwing,
because a consent check that throws during first paint takes the host page with
it.

## Discovery

`analytics.discovery` observes what else runs on the page. It is **off by
default** and must be started explicitly, because it wraps `fetch`,
`XMLHttpRequest`, `sendBeacon`, `Image.src`, `document.cookie` and
`Storage.setItem`. See [discovery.md](discovery.md).

---

## Identity model

| Identifier | Generated by | When | Lifetime | Authoritative |
| --- | --- | --- | --- | --- |
| `site_id` | Server, at site creation | Once | Permanent | **Server.** The SDK sends it; the API validates it against the public key and rejects a mismatch with `site_mismatch`. |
| `session_id` | SDK, `crypto.randomUUID()` | First event of a session | 30 minutes of inactivity, or until the tab's `sessionStorage` is cleared | **Client.** The API accepts it, creating the session row on first sight, but refuses a `session_id` already owned by another site (`session_conflict`). |
| `event_id` | SDK, `crypto.randomUUID()` | At event creation | Permanent | **Client**, and unique forever. Ingestion is idempotent on it. |

There is **no visitor identifier.** No cookie, no device id, nothing that
survives the session. A `session_id` lives in `sessionStorage` and is scoped to
one tab, so it cannot be used to follow someone between visits. This is a design
constraint, not an unfinished feature: adding a persistent visitor id would
change what the platform collects, and that is a decision for both sides plus a
legal review, not an SDK change.

The consent client mints a `principal_external_id` separately, server-side, and
it is **never** written onto a session or event row. Analytics carries no
consent state and no principal identifier.

## Timestamps

The SDK stamps `event_time` with `new Date().toISOString()` — RFC 3339, UTC,
millisecond precision — at the moment the event is **created**, not when it is
sent. That is the honest value: an event queued during an outage and flushed
twenty minutes later happened twenty minutes ago.

The client clock is therefore trusted for `event_time`, and it is not
trustworthy — it can be wrong, skewed, or deliberately set. The database keeps
its own `received_at` (server clock, `DEFAULT now()`) on every row, so any
analysis that cannot tolerate a bad client clock has a server-side timestamp
available. A malformed or missing `event_time` is rejected by the API rather
than substituted; see [api-spec.md](api-spec.md).

## Delivery and retries

Events are queued, not sent immediately:

- flushed every **2 s**, or as soon as **10** events are queued
- sent as `POST /api/v1/events` with `{ "events": [...] }`
- the queue is mirrored into `localStorage` (max 50 events) so a page unload does
  not lose it
- failures retry up to **3** times with exponential backoff from 250 ms
- a `403` is **not** retried — it means consent is refused, which retrying cannot
  change — and the batch is dropped with a warning

Because retries and unload flushes can replay a batch, ingestion is idempotent on
`event_id`: the first write wins and later copies are ignored. This is what makes
retrying safe.

All of these numbers are internal and may change.

## Collected automatically

Every event carries, without the developer supplying anything:

| Field | Source |
| --- | --- |
| `payload.page.url` | `window.location.href` |
| `payload.page.title` | `document.title` |
| `payload.device.type` | `desktop` / `mobile` / `tablet`, from the user agent |
| `payload.device.browser` | Browser family, from the user agent |
| `payload.device.os` | OS family, from the user agent |
| `payload.referrer` | The **first** referrer seen in the session, held in `sessionStorage` so internal navigation does not overwrite it. `null` when there is none. |

The user agent is parsed into three coarse buckets and the raw string is never
sent. No IP address, no screen fingerprint, no font or canvas probing.

## Limits

Bounds are defined once in `shared/event.ts` (`EVENT_LIMITS`) and enforced by the
API, which is the authority. Exceeding one rejects that event with
`invalid_event`, or the request with `invalid_request` / `payload_too_large`.

`track()` also checks the subset it can see locally — see
[Local validation](#local-validation) — so an oversized custom event is refused
at the call site instead of failing silently on the wire.

| Limit | Value |
| --- | --- |
| Request body | 1 MiB |
| Events per batch | 100 (the SDK sends at most 10) |
| `site_id`, `session_id` | 200 characters |
| `name` | 120 |
| `source` | 80 |
| `page.url`, `referrer` | 2048 |
| `page.title` | 300 |
| `device.*` | 120 |
| `properties` keys | 100, each key ≤ 100 characters |
| `properties` serialised | 8192 bytes |

## Full example

```html
<script src="https://cdn.example.com/rift-cmp.js"></script>
<script>
  analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
  analytics.init("site_demo", "pk_demo_12345", { apiUrl: "https://ingest.example.com" });

  document.querySelector("#buy").addEventListener("click", () => {
    analytics.track("purchase", { product_id: "123", value: 499, currency: "INR" });
  });
</script>
```

`setConsentCheck` comes first so the gate is in place before `init()` emits
`session_start` and `page_view`.

## See also

- [event-schema.md](event-schema.md) — the envelope these calls produce
- [api-spec.md](api-spec.md) — the HTTP contract they use
- [consent.md](consent.md) — the consent client in full
- [discovery.md](discovery.md) — in-page discovery
- [integration-contract.md](integration-contract.md) — ownership split
