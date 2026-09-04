# Scan API

HTTP surface for the website scanner. Architecture, limits and the privacy and
SSRF model are in [`crawler.md`](crawler.md); this document is the wire contract.

Types are in [`../shared/scan.ts`](../shared/scan.ts).

> Scanner observations are evidence about what was observed during a scan. They
> are not legal determinations. No response below carries a "requires consent"
> or "compliant" field, and that absence is deliberate.

## Plane and credential

Every scan endpoint is on the **management plane** and takes the organisation
secret:

```http
Authorization: Bearer sk_...
```

**A site public key (`pk_...`) is refused with `401`**, and the reason is
specific rather than cautious. A public key ships in page source, so everyone who
can view a customer's HTML holds one. A public key that could start crawls would
turn every deployed tag into a button that spends our browser capacity, and —
because the caller supplies the start URL — into a request-forgery primitive
anyone on the internet could aim.

The management plane sends **no CORS headers**, like the rest of it. These are
server-to-server calls.

**The credential determines the tenant.** A scan belonging to another
organisation is reported as `404`, identical to one that does not exist. No
endpoint accepts an `organisation_id` in a URL or body.

---

## `POST /api/v1/sites/{siteId}/scans`

Queues a scan. It does **not** perform one: a crawl takes minutes and never runs
inside an HTTP request.

### Request

```json
{
  "start_url": "https://example.com/",
  "mode": "baseline",
  "max_pages": 50,
  "max_depth": 2,
  "max_duration_ms": 300000
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `start_url` | yes | 1–2048 chars. `http(s)` only. Checked against the SSRF guard before the scan is queued. |
| `mode` | no | Defaults to `baseline`. Any other declared mode is refused — see below. |
| `max_pages` | no | 1–500. Default 100. |
| `max_depth` | no | 0–10. Default 3. |
| `max_duration_ms` | no | 10 000–1 800 000. Default 600 000. |

Unknown fields are a `400`, not a silently ignored value.

### Response — `202 Accepted`

```json
{
  "scan": {
    "scan_id": "1f2e...",
    "site_id": "site_demo",
    "status": "queued",
    "mode": "baseline",
    "start_url": "https://example.com/",
    "crawler_version": null,
    "created_at": "2026-09-03T22:00:00.000Z",
    "started_at": null,
    "completed_at": null,
    "error": null
  }
}
```

`202` rather than `201`: the resource exists, but the work it represents has not
been done.

### Errors

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | Missing, malformed, unknown, or a `pk_`/`rk_` key on this plane |
| `404` | `not_found` | No such site **in the caller's organisation** |
| `400` | `invalid_json` | Body is not valid JSON |
| `400` | `invalid_request` | Schema failure, unknown field, unimplemented mode, or a `start_url` the SSRF guard refused |

A refused `start_url` names the reason:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "start_url was rejected: blocked_hostname (hostname localhost is not publicly routable)",
    "details": []
  }
}
```

Reasons: `unsupported_scheme`, `url_too_long`, `malformed_url`,
`credentials_in_url`, `blocked_port`, `blocked_hostname`, `private_address`.

**This is only the cheap half of the check.** The API validates shape
synchronously so an obviously hostile URL fails fast with a clear message; the
authoritative check, including DNS resolution of every returned address, runs
again in the crawler immediately before navigation, because what a hostname
resolves to can change in between.

### Unimplemented modes

`shared/scan.ts` declares `baseline`, `necessary_only`, `analytics`,
`advertising` and `all`. Only `baseline` runs. Asking for another is a `400`:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Scan mode \"advertising\" is declared in the contract but not implemented. Only \"baseline\" runs today.",
    "details": []
  }
}
```

Refusing is the point. Silently running a baseline scan and labelling it
`advertising` would produce observations that claim to be about a consent state
nobody scanned.

---

## `GET /api/v1/sites/{siteId}/scans`

Scans for one site, newest first.

| Query | Notes |
| --- | --- |
| `limit` | Integer 1–100, default 50. Out of range is a `400`, not silently clamped. |

```json
{
  "scans": [
    { "scan_id": "...", "status": "completed", "summary": { "pages_scanned": 42, "…": 0 } }
  ]
}
```

---

## `GET /api/v1/scans/{scanId}`

Status and counts. Separate from `/results` because an onboarding UI polls this
every couple of seconds while a crawl runs and should not drag several hundred
observation rows across the wire to render a progress number.

```json
{
  "scan": {
    "scan_id": "1f2e...",
    "site_id": "site_demo",
    "status": "running",
    "mode": "baseline",
    "start_url": "https://example.com/",
    "crawler_version": "1.0.0",
    "created_at": "2026-09-03T22:00:00.000Z",
    "started_at": "2026-09-03T22:00:04.000Z",
    "completed_at": null,
    "error": null
  },
  "summary": {
    "pages_discovered": 42,
    "pages_scanned": 17,
    "pages_failed": 1,
    "cookies_found": 8,
    "scripts_found": 22,
    "requests_observed": 310,
    "storage_items_found": 5,
    "third_party_domains": 17,
    "technologies_detected": 5,
    "consent_ui_detected": true,
    "limit_reached": null
  }
}
```

`limit_reached` is `null` when the crawl finished naturally. When it names a
limit — `maxPages`, `maxDepth`, `maxDuration`, `maxRequests`, `queueBound`,
`cancelled` — **every count above is a floor, not a total.**

A failed scan carries the reason:

```json
{ "status": "failed", "error": { "code": "ssrf_blocked", "message": "…" } }
```

| `error.code` | Meaning |
| --- | --- |
| `invalid_start_url` | Start URL is not a usable http(s) URL |
| `ssrf_blocked` | Start URL resolves into private address space |
| `browser_launch_failed` | Playwright could not start |
| `crawl_failed` | Unrecoverable error inside the crawl |

Page-level failures never appear here — they are rows in `pages` with an
`error`, and the scan still completes.

### Errors

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | Missing or wrong-plane credential |
| `404` | `not_found` | No such scan **in the caller's organisation** |

---

## `DELETE /api/v1/scans/{scanId}`

Cancels a `queued` or `running` scan. Cooperative: it marks the row, and a
running crawl notices at its next page boundary rather than being killed
mid-navigation.

Returns the updated scan, shaped like `GET`.

| Status | `code` | Cause |
| --- | --- | --- |
| `404` | `not_found` | No such scan in this organisation |
| `409` | `conflict` | Already `completed`, `failed` or `cancelled` |

---

## `GET /api/v1/scans/{scanId}/results`

Full observations. This is what onboarding reads when a scan completes, and what
the consent layer will read to seed a category configuration.

Readable in **any** state. A `running` scan simply has fewer rows; a `failed` one
may still carry the pages it managed before it stopped, which is more useful than
an empty response plus an error.

```json
{
  "scan": { "…": "as above" },
  "summary": { "…": "as above" },
  "consent_ui": {
    "detected": true,
    "signals": [
      { "kind": "known_cmp_script", "detail": "cdn.cookielaw.org" },
      { "kind": "button_text", "detail": "accept all" }
    ]
  },
  "pages": [
    {
      "url": "https://example.com/",
      "final_url": null,
      "status": 200,
      "title": "Home",
      "content_type": "text/html; charset=utf-8",
      "depth": 0,
      "rendered": true,
      "error": null,
      "duration_ms": 1840
    },
    {
      "url": "https://example.com/slow",
      "status": null,
      "rendered": false,
      "error": "timeout",
      "duration_ms": 30000
    }
  ],
  "cookies": [
    {
      "name": "_ga",
      "domain": ".example.com",
      "path": "/",
      "expires": "2027-03-01T00:00:00.000Z",
      "secure": true,
      "http_only": false,
      "same_site": "Lax",
      "third_party": false
    }
  ],
  "scripts": [
    {
      "url": "https://www.googletagmanager.com/gtag/js?id=G-X",
      "host": "www.googletagmanager.com",
      "inline": false,
      "third_party": true,
      "observed_on": "https://example.com/"
    }
  ],
  "requests": [
    {
      "host": "www.google-analytics.com",
      "resource_type": "xhr",
      "method": "POST",
      "sample_path": "https://www.google-analytics.com/collect",
      "third_party": true,
      "request_count": 14,
      "failed_count": 0,
      "status": 200
    }
  ],
  "storage": [
    { "kind": "local_storage", "name": "_hjSessionUser_123", "origin": "https://example.com" }
  ],
  "technologies": [
    {
      "detector_id": "google-analytics",
      "name": "Google Analytics",
      "category": "analytics",
      "confidence": "high",
      "evidence": [
        { "type": "script", "value": "https://www.googletagmanager.com/gtag/js?id=G-X" },
        { "type": "cookie", "value": "_ga" }
      ],
      "destination_country": "US",
      "crosses_border": true
    }
  ]
}
```

### What is not in this payload, and why

- **No cookie values.** There is no `value` field, and no column behind it.
- **No storage values.** Key names only.
- **No headers and no bodies.** `sample_path` and `scripts[].url` are origin +
  path, with the query stripped at capture. Page `url` keeps its normalised
  query, because a page's identity depends on it — see
  [crawler.md](crawler.md#privacy).
- **No legal determination.** No `requires_consent`, no `lawful`, no `gdpr`, no
  `legal_basis`. `category` is what a technology is normally used for, not a
  consent purpose, and mapping one to the other is a human decision made in the
  consent layer.

`requests` is aggregated per `(host, resource_type, method)` rather than one row
per request, so a page that makes four hundred calls to one host is one row with
`request_count: 400`.

### Caps

`pages` 200 · `cookies` 500 · `scripts` 500 · `requests` 500 · `storage` 500 ·
`technologies` 300. There is no cursor; a scan large enough to hit these is one
whose `limit_reached` already says the counts are a floor.

### Errors

| Status | `code` | Cause |
| --- | --- | --- |
| `401` | `unauthorized` | Missing or wrong-plane credential |
| `404` | `not_found` | No such scan in this organisation |

---

## Lifecycle

```text
POST .../scans ──► queued ──► running ──► completed
                     │           │
                     │           └──────► failed      (scan-level failure only)
                     └───────────────────► cancelled  (DELETE, cooperative)
```

`queued → running` is a conditional `UPDATE ... WHERE status = 'queued'`, so two
workers racing for one row means one updates nothing and moves on. A cancelled
scan is never claimed.
