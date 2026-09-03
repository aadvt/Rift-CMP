# Discovery

Discovery answers three questions a Data Fiduciary has to be able to answer
about its own website:

1. **What is running on my pages?**
2. **Where is it sending data?**
3. **Did any of it fire when consent said it should not?**

The third is the one that matters, and it is the reason this is built the way it
is.

## Why in-page, and not a crawler

Every mainstream consent tool discovers trackers by crawling: a robot visits a
URL, records what loads, and produces an inventory. That approach has three
structural blind spots.

- It sees the **logged-out** page. Tags that only load for signed-in users, in a
  checkout, or behind a paywall are invisible to it.
- It sees **one moment**. A tag added by a marketing team on Tuesday is not
  found until the next scheduled scan.
- Most importantly, it can only report **what it saw load**, not **what
  happened**. It cannot tell you that a tracker fired for a real person whose
  consent had been withdrawn, because it was never on the page when that person
  was.

Rift's SDK is already installed and already running when real people use the
site. So discovery here is an observation of production traffic rather than a
simulation of it. That is what makes a violation record possible: only code
present in the page can witness that a request genuinely left the browser.

The trade-off is honest and worth stating plainly: **this cannot be a
pre-signup scan.** A crawler can inspect any URL from a marketing page; this
cannot, because it requires the tag to be installed first. The two approaches
answer different questions and a complete product would eventually want both.

## What is collected, and what is deliberately not

| Collected | Never collected |
| --- | --- |
| Destination hostname | Full URLs |
| Path, with query and fragment stripped | Query strings, fragments |
| Storage **key** names | Storage **values** |
| The script that caused a request | Request or response bodies |
| Consent status at the moment of a request | Which person was on the page |

Stripping happens **at the point of capture**, not at the point of send, so a
query string is never held in memory as part of a report. The API then rejects a
payload that still contains one — a redundant check on purpose, so that an SDK
which stopped stripping correctly fails loudly instead of quietly filling the
database with identifiers.

Discovery is **not joined to `Principal`**. A violation records that a
destination was contacted under a non-granted purpose, never who was there.
Attributing violations to individuals would manufacture precisely the
behavioural profile the platform exists to prevent.

## How attribution works

`PerformanceResourceTiming` tells you a request happened and what kind it was,
but not which script caused it. To answer "which component", the SDK wraps the
four APIs a tag can use to reach the network and captures a stack trace at the
call site; the first frame that is not the SDK is the responsible script.

| Wrapped | Catches |
| --- | --- |
| `fetch` | Modern tag traffic |
| `XMLHttpRequest.open` | Older vendor SDKs |
| `navigator.sendBeacon` | Unload-time exfiltration |
| `HTMLImageElement.src` | Tracking pixels |
| `document.cookie` setter | Who set which cookie |
| `Storage.setItem` | Who wrote which key |
| `MutationObserver` | Tags injected by a tag manager |
| `PerformanceObserver` | Backstop for requests made by served markup |

Every wrapper calls through to the original and every callback is wrapped in
`try`/`catch`. A discovery bug must never break a customer's website, so failure
degrades to "we observed less", never to a thrown error on the host page.
`stop()` restores every wrapped API.

Requests issued by markup rather than script are recorded with a **null
initiator** and shown as "page markup" rather than being attributed to a guess.

## Classification, and the cross-border question

The SDK sends raw hostnames. Classification happens **server-side**, in
`database/tracker-catalogue.ts`, for two reasons: the catalogue changes far more
often than the tag does, and shipping it to the browser would mean customers
redeploying their websites whenever a vendor was added.

Each catalogue entry carries a **destination country**, because under DPDP the
consequential question is not only "what is this?" but "where does this data
end up?". `crosses_border` is derived from it against `HOME_COUNTRY` (`IN`).

Two deliberate choices in that logic:

- `country` is the **jurisdiction of the receiving organisation**, not a GeoIP
  result for an anycast edge. A CDN node in Mumbai serving a US company's tag
  does not make the recipient Indian.
- An **unknown** country is not reported as a crossing. Asserting a transfer we
  cannot evidence would be worse than reporting it as unknown.

An unmatched host is surfaced as **unclassified**, not as safe. An unknown third
party is the row an operator most needs to look at, so the inventory counts it
separately.

The shipped catalogue is small and hand-written. It is not a substitute for a
maintained tracker database; the open ones — DuckDuckGo Tracker Radar,
EasyPrivacy, Disconnect — are far more complete and are the obvious upgrade.

## Consent violations

A violation is recorded when a third-party host is contacted while consent for
its purpose is not granted.

The mapping from host to purpose belongs to the **operator**, not the SDK: only
the fiduciary knows which of its vendors serve which declared purpose.

```js
analytics.discovery.watchConsent(
  (purpose) => analytics.consent.isGranted(purpose),
  {
    "facebook.net": "advertising",
    "google-analytics.com": "analytics",
  },
);
```

Violations are **appended, never deduplicated**. Two observations are two pieces
of evidence. The check runs at observation time rather than later because
effective consent is "newest decision wins" — evaluating it afterwards would
test the wrong state.

## Using it

Discovery is **opt-in**. It wraps a meaningful amount of the browser's surface,
which is not something a tag should start doing on its own.

```js
analytics.init("site_demo", "pk_demo_12345");
analytics.discovery.start();
analytics.discovery.watchConsent((p) => analytics.consent.isGranted(p), hostPurposes);
```

| Method | Does |
| --- | --- |
| `start()` | Begins observing. Idempotent; no-op outside a browser. |
| `stop()` | Stops and restores every wrapped API. |
| `watchConsent(isGranted, hostPurposes)` | Enables violation detection. |
| `flush()` | Sends now. Normally automatic every 10s and on unload. |
| `snapshot()` | Current observations, without sending. |

## API

| Endpoint | Plane | Credential |
| --- | --- | --- |
| `POST /api/v1/discovery` | Ingestion | Site public key (`pk_...`) |
| `GET /api/v1/discovery/inventory?site_id=…` | Management | Organisation secret (`sk_...`) |

Reports are **write-only** on the public-key plane. The inventory names every
vendor a business uses, which is commercially sensitive; a key that ships in
page source must not be able to read it back. The report's `site_id` is ignored
in favour of the credential's site, so a report cannot be filed against a site
the caller does not hold a key for.

`POST /api/v1/discovery` is rate limited and origin checked like the other
browser-facing routes, and is **deliberately never consent-gated**. Phase 6A
added an opt-in consent gate to analytics ingestion; applying the same gate here
would drop precisely the reports that say a destination was contacted while
consent was withdrawn — the evidence this domain exists to capture. Discovery is
already not joined to `Principal` and records hosts and names, never values, so
there is no personal data to gate. See [security.md](security.md).

## Storage model

Three tables, all site-scoped, in
[`database-schema.md`](database-schema.md#discovery-domain).

`discovered_components` is upserted on `(site_id, host, kind)`, so a site with
steady traffic converges on one row per destination rather than one per page
view. `first_seen` never moves; `last_seen` and `request_count` advance. That is
what lets the SDK re-report its whole picture on every flush without the table
growing without bound.

`discovery_violations` is append-only by contrast, for the reason above.

## Known limits

- **Not a pre-signup scan.** Requires the tag to be installed.
- **Only observes pages people actually visit.** A page nobody loads is a page
  discovery never sees — the mirror image of a crawler's blind spot.
- **The catalogue is small.** Unmatched hosts are common and are reported as
  unclassified.
- **Attribution can be null.** Requests from served markup have no script to
  attribute, and some browsers format stack traces in ways the parser will not
  match. Null is reported honestly rather than guessed.
- **The violation mapping is manual.** Nothing infers which vendor serves which
  purpose; an operator has to say so.
