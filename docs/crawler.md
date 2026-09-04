# Website Scanner (Crawler)

A Playwright crawler that visits a customer's website and reports what it
observes: pages, cookies, scripts, network destinations, browser storage and the
technologies behind them.

> **Scanner observations are evidence about what was observed during a scan.
> They are not themselves legal determinations.**
>
> Nothing the scanner produces says a cookie requires consent, that a site is
> compliant, or that a transfer is lawful. Those are questions for the
> compliance layer, working from the requirement matrix in
> [`regulations/`](regulations/). The scanner's job ends at "this is what is
> running, and here is why we think so".

## Why a crawler exists alongside in-page discovery

[`discovery.md`](discovery.md) argues, correctly, that a crawler cannot produce
the evidence that matters most: it is never on the page when a real person is,
so it can never witness that a tracker fired while consent was withdrawn. That
argument has not changed, and this does not replace it.

It also says the thing that motivates this phase:

> **this cannot be a pre-signup scan.** A crawler can inspect any URL from a
> marketing page; this cannot, because it requires the tag to be installed
> first. The two approaches answer different questions and a complete product
> would eventually want both.

So the two are complements with opposite blind spots, and both are kept:

| | In-page discovery | Scanner |
| --- | --- | --- |
| Needs the tag installed | Yes | No |
| Works during onboarding, before signup | No | **Yes** |
| Sees logged-in and checkout pages | Yes | No |
| Sees pages nobody has visited | No | **Yes** |
| Sees what a real browser actually did | **Yes** | No |
| Can evidence a consent violation | **Yes** | No |
| Observes continuously | **Yes** | One moment |

They are deliberately not merged into one table. Collapsing "observed in
production" and "observed by a robot" would destroy the distinction that makes
the first evidentiary.

## Architecture

```text
POST /api/v1/sites/{siteId}/scans      (management plane, sk_)
        ↓  row in `scans`, status = queued
   crawler worker  (crawler/src/worker.ts)
        ↓  claimNextScan()  → status = running
   crawl()  (crawler/src/crawl.ts)
        ↓  Playwright, one isolated context
   observations: pages, cookies, scripts, requests, storage
        ↓  detectTechnologies()
   findings with evidence and confidence
        ↓  persistScanResult()  → status = completed
GET /api/v1/scans/{scanId}/results
        ↓
   onboarding UI → consent configuration (Person 2)
```

| Piece | Where |
| --- | --- |
| Crawler package | `crawler/` |
| SSRF guard | `crawler/src/ssrf.ts` |
| URL normalisation and scope | `crawler/src/url.ts` |
| robots.txt | `crawler/src/robots.ts` |
| Detectors | `crawler/src/detectors.ts` |
| Playwright orchestration | `crawler/src/crawl.ts` |
| Worker | `crawler/src/worker.ts` |
| Persistence | `database/scans.ts` |
| Wire contract | `shared/scan.ts` |
| HTTP surface | [`scan-api.md`](scan-api.md) |

### Background execution

A crawl takes minutes, so it never runs inside an HTTP request. The API writes a
`queued` row; the worker claims it with a conditional
`UPDATE ... WHERE status = 'queued'`, so two workers racing for one row means one
updates nothing and moves on.

There is deliberately **no job broker**. This repository runs one Next.js
process against one Postgres; adding Redis or BullMQ would introduce a service to
operate and a second source of truth about what work exists, in exchange for
throughput nobody needs yet. The boundary is what matters: replacing
`worker.ts` with a real queue consumer later changes nothing else.

Run it with:

```bash
npm -w @rift-cmp/crawler run worker
```

## Crawl boundaries

| Limit | Default | Why |
| --- | --- | --- |
| `maxPages` | 100 | Enough to characterise a site; small enough to finish |
| `maxDepth` | 3 | Beyond this is usually pagination, not new technology |
| `maxDurationMs` | 10 min | A hard stop regardless of what the site does |
| `concurrency` | 2 | Polite; a scan is not a load test |
| `navigationTimeoutMs` | 30 s | Per page |
| `stabilisationMs` | 2.5 s | Ceiling on waiting for the page to settle |
| `maxRedirects` | 5 | Redirect loops |
| `maxRequests` | 5 000 | Per scan |
| `maxCookies` | 500 | Per scan |
| `maxScripts` | 1 000 | Per scan |
| `maxStorageItems` | 500 | Per scan |
| `maxEvidencePerFinding` | 5 | Evidence is for explaining, not archiving |

Scope is **same-origin only**. A subdomain is a different origin and is not
crawled: `blog.example.com` may be a different application owned by a different
team, and following it would scan something the customer did not ask us to.

When a limit stops a crawl, `summary.limit_reached` names it, so a count can be
read as the floor it is rather than as a total. A queue bound
(`maxPages × 4`) also caps discovery itself, because a link farm can exhaust
memory long before the page limit is reached.

### Stabilisation

`networkidle` alone is unusable: a site with a poll, a websocket or an ad refresh
never reaches it, and one page would consume the whole duration budget. The
crawler races idleness against a fixed ceiling and takes whichever comes first.
A page that never settles is observed as it was at the ceiling.

## URL normalisation

Two failure modes, in opposite directions. Normalise too little and `/`, `/?`,
`/#top` and `/index.html?utm_source=x` are four pages. Normalise too much and
`/product?id=1` and `/product?id=2` silently become one, and the inventory is
missing whatever only loaded on the other. The second is invisible in the
output, which is why every rule is written down.

Applied in order:

1. resolve against the page the link was found on
2. reject non-navigable schemes — `javascript:`, `mailto:`, `tel:`, `data:`, …
3. lower-case scheme and host; the path keeps its case, because paths are
   case-sensitive
4. drop the fragment: never sent to a server, so it cannot change the response
5. drop the default port
6. drop tracking parameters, then sort the rest
7. collapse `/index.html` to `/` and duplicate slashes to one

**Dropped parameters** are attribution-only: `utm_*`, `gclid`, `fbclid`,
`msclkid`, `mc_cid`, `_hsenc` and similar. Anything that might select content —
`id`, `q`, `page`, `lang` — is kept even though keeping it costs budget.

**Crawl explosions** are bounded by refusing a URL with more than 8 query
parameters. That is cruder than modelling facets properly and is documented
rather than emergent.

**Non-page extensions** (`.pdf`, `.jpg`, `.zip`, `.mp4`, …) are not queued as
pages. Resources loaded *by* a page are still observed as network requests, so a
tracking pixel is not missed by this.

### First-party vs third-party

A host is first-party when it equals the page host or is a subdomain of it. This
is a suffix test, not a Public Suffix List lookup, so it is **wrong for hosts
under a multi-party suffix** such as `github.io`, where `a.github.io` and
`b.github.io` are different parties. The PSL is the obvious upgrade.

## robots.txt

The scanner **obeys robots.txt**. That is a choice, not an inevitability — the
customer owns the site and asked us to scan it — and it is made for three
reasons:

- We cannot verify at scan time that whoever typed the URL speaks for the site.
  Tenant ownership is checked against *our* records, not against the domain.
- `Disallow` often marks expensive or destructive endpoints: search, export,
  logout, cart mutation. Ignoring it is how a crawler logs a customer out of
  their own admin panel.
- It is the norm a well-behaved crawler follows, and being on the wrong side of
  it buys very little coverage.

| Situation | Behaviour |
| --- | --- |
| `robots.txt` fetched | Rules applied; `robots_source: "fetched"` |
| 404 | Everything allowed; `"absent"` |
| 5xx, timeout, network error | Everything allowed; `"unreachable"` |
| Larger than 512 KB | Everything allowed; `"malformed"` |
| `Crawl-delay` | Respected, capped at 10 s between pages |
| Disallowed page | Recorded as a page with `error: "disallowed_by_robots"`, counted in `robots.disallowedSkipped` |

Longest matching rule wins; `Allow` beats `Disallow` at equal length, so
`Disallow: /` + `Allow: /public/` means what its author intended.

The user-agent is stable and honest:

```text
RiftCMP-Scanner/1.0.0 (+https://rift-cmp.dev/scanner)
```

A crawler hiding behind a browser user-agent cannot be blocked by a site that
does not want it, cannot be recognised in a customer's access logs, and cannot be
matched by a `User-agent` group in their robots.txt.

A verified-ownership override — scanning a domain the customer has proved they
control, ignoring robots — is a reasonable future mode. It needs domain
verification, which does not exist yet.

## SSRF threat model

**This is the most important section in this document.**

The crawler fetches a URL a customer typed into a form, from inside our network,
with our egress identity. Unguarded, that is a request-forgery proxy anyone with
a signup can aim at
`http://169.254.169.254/latest/meta-data/iam/security-credentials/`.

### What is blocked

| Class | Examples |
| --- | --- |
| Schemes | anything but `http:`/`https:` — `file:`, `ftp:`, `gopher:`, `data:` |
| Credentials in URL | `http://user:pass@host/` |
| Hostnames | `localhost`, `metadata.google.internal`, `*.internal`, `*.local`, `*.corp`, any single-label name |
| IPv4 | `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `192.0.0/24`, TEST-NETs, multicast, reserved |
| IPv6 | `::`, `::1`, `fe80::/10`, `fc00::/7`, `ff00::/8`, `2001:db8::/32`, `64:ff9b::/96` |
| IPv4-mapped IPv6 | `::ffff:127.0.0.1`, `::ffff:10.0.0.1` — judged by the IPv4 rules |
| Ports | SSH, SMTP, databases, caches, Docker daemon, and other well-known internal services |
| Unparseable addresses | Refused rather than assumed safe |

### Why hostname checks are not enough

`https://example.com` looks public; what matters is what it **resolves to**, and
an attacker controls their own DNS. So every hostname is resolved and **every
returned address** is checked — a name with one public and one private answer is
refused, because which address the browser picks is not ours to control.

### DNS rebinding — the honest limitation

A name can resolve public when we check and private when the browser fetches it.
This is a genuine time-of-check/time-of-use gap that an application-level guard
**cannot fully close**.

What is done: the check is re-run before the initial navigation and before
**every** discovered URL, and again on the **landed URL after redirects**.

What is not done, stated precisely because the difference matters:

- **Redirect hops are validated after the fact, not before.** `page.goto()`
  follows redirects internally, and the landed-URL check runs once it returns.
  So a page that 302s to `http://169.254.169.254/` results in the browser
  **having already issued that request**; the check then refuses to record the
  page or crawl onward from it. Nothing is stored and no response body is read,
  but the request happened. This is blind SSRF via redirect, and it is a real
  gap, not a theoretical one. Closing it needs request interception
  (`page.route`) that validates and aborts each navigation hop before it is
  sent — see "Requires review" in the Phase 8A report.
- **The resolved address is not pinned** for the connection the browser actually
  makes, so a name that answers public at check time and private microseconds
  later is not stopped.

Properly closing both needs egress-level control — a network policy, a proxy
that pins the resolved address, or a dedicated egress VPC — which this
repository does not have. **The application half of this defence is
implemented; the network half is not.**

**The scanner is not fully SSRF-proof.** It should not be deployed anywhere it
can reach infrastructure that matters until the network half exists.

### Where the checks run

| Point | Check |
| --- | --- |
| `POST .../scans` | Shape only (scheme, port, hostname, literal address). Fast rejection with a clear error. |
| Before the first navigation | Shape **and** DNS. Fatal — the scan fails rather than starting. |
| Every discovered URL | Shape and DNS. Page-level: recorded and skipped. |
| After every redirect | Shape and DNS on the **landed** URL, i.e. after `goto()` has already followed the chain. Page-level: recorded and skipped. |

## Privacy

The scanner catalogues website technology. It is not a data-collection tool, and
the schema is built so that it cannot quietly become one.

| Collected | Never collected |
| --- | --- |
| Cookie name, domain, path, expiry, flags | **Cookie values** |
| Storage **key** names | **Storage values** |
| Request and script origin + path | **Query strings on resources, fragments** |
| Method, resource type, status | **Request/response headers** |
| Script URL, host | **Request/response bodies** |
| Page title, status, content type | **Form input, credentials, tokens** |
| Inline script **count** | **Inline script contents** |

Three structural guarantees rather than promises:

- **There is no cookie `value` column, and no header or body column anywhere in
  the scanner schema.** Playwright hands cookie values over whether we want them
  or not; they are dropped at the crawler boundary, and the absence of a
  destination means a later change cannot start persisting them without someone
  adding a column and explaining why.
- **Query strings are stripped at capture** for network requests and script
  URLs — both are recorded as origin + path — so an identifier in a resource URL
  is never held in memory as part of an observation.
- **Page URLs are the one exception, and deliberately so.** A page's identity
  depends on its query (`/product?id=1` is not `/product?id=2`), so the
  normalised query is kept after tracking parameters are dropped. A site that
  puts a token in a page URL would have it recorded. That is inherent to
  crawling rather than a choice this implementation makes, but it is a real
  exposure and is stated here rather than glossed over.
- **Storage is read by key name only.** The in-page `evaluate` enumerates keys
  and never calls `getItem`.

Logging follows the same rule: URLs are logged origin+path, and no cookie, header,
body or credential is ever logged. A crawler that leaked its findings into a log
aggregator would have moved the privacy problem, not solved it.

## Consent banner detection

The crawler **detects** consent interfaces and does not judge them. It reports
`consent_ui_detected` plus the signals behind it:

| Signal | Example |
| --- | --- |
| `known_cmp_script` | `cdn.cookielaw.org`, `consent.cookiebot.com`, `usercentrics` |
| `known_cmp_cookie` | `OptanonConsent`, `CookieConsent`, `euconsent-v2` |
| `dom_pattern` | `#onetrust-banner-sdk`, `[class*='cookie-banner']` |
| `button_text` | "accept all", "reject", "manage preferences" |

**The scanner never clicks "Accept All".** Granting consent in order to discover
more trackers would manufacture the very state the customer is trying to
document, and would make the resulting inventory a claim about a consent state
nobody chose. The default scan observes the site in its initial state.

Whether a detected banner is valid, sufficient, or lawful is not a question the
scanner answers.

## Scan modes: what one scan proves

A scan observes a site **in one state, at one moment, logged out**. It does not
prove what happens after consent is granted, for a signed-in user, or on a page
it never reached.

`shared/scan.ts` declares the full mode vocabulary — `baseline`,
`necessary_only`, `analytics`, `advertising`, `all` — but **only `baseline` is
implemented**, and the API refuses the others explicitly rather than silently
running a baseline scan under another name.

The vocabulary exists now so that every observation is stamped with the state it
was made under from the first row. Adding the field later would leave every
existing row ambiguous about what it actually witnessed.

## Detector architecture

Detectors classify raw observations. The interface is small:

```ts
interface TrackerDetector {
  id: string;
  name: string;
  category: string;
  matches(input: DetectionInput): DetectionResult | null;
}
```

**Host classification reuses `database/tracker-catalogue.ts`** — the same
catalogue in-page discovery already uses. A second catalogue here would drift
from the first within a release, and a site would then be told two different
things about the same vendor depending on which feature reported it. The
detectors add only what a crawler can see that the SDK cannot: script URLs,
cookie names and storage keys.

### Confidence

Derived from how many **independent kinds** of signal agree, not from how many
total matches were found — ten requests to one host is one fact observed ten
times.

| Confidence | Meaning |
| --- | --- |
| `high` | A script URL matched, or two different kinds of signal agreed |
| `medium` | One non-script signal, or a catalogue host match |
| `low` | An unknown third-party host, classified by nothing but its name |

An unmatched third-party host is reported as a `low`-confidence,
`unclassified` finding rather than dropped. An unknown third party is the row an
operator most needs to look at.

### Evidence

Every finding carries the evidence that produced it, so the onboarding UI can
answer "why did you detect this?". A classification a customer cannot
interrogate is one they cannot correct.

```json
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
```

`category` is what a technology is normally used for. It is **not** a legal
category and does not map onto a consent purpose without a human deciding that
it does.

## Failure handling

A scan survives individual page failures. Timeouts, DNS failures, 500s, redirect
loops and JavaScript errors are recorded on the page row and the crawl continues;
losing ninety-nine good pages to one timeout would be the wrong trade.

Only these fail the whole scan:

| Code | Cause |
| --- | --- |
| `invalid_start_url` | The start URL is not a usable http(s) URL |
| `ssrf_blocked` | The start URL resolves into private space |
| `browser_launch_failed` | Playwright could not start |
| `crawl_failed` | An unrecoverable error inside the crawl |

Cancellation is cooperative: `DELETE /api/v1/scans/{id}` marks the row, and a
running crawl notices at its next page boundary. It does not kill a browser
mid-navigation, because a half-torn-down context is a worse state than one extra
page.

## Resource limits and unbounded writes

Bounded twice, on purpose. The crawler caps what it collects; `persistScanResult`
caps again on the way in, so a crawler bug cannot become unbounded rows.

`scan_requests` is **aggregated per (host, resource_type, method)** rather than
one row per request — the same reasoning as `discovered_components`. One page can
issue hundreds of requests to one host, and storing each would let a hostile page
write unbounded rows while telling an operator nothing the count does not.

## Known limitations

- **DNS rebinding is narrowed, not closed.** See above. The network half of the
  defence is missing.
- **Logged-out only.** No authentication support, so checkout and account pages
  are invisible.
- **One moment.** A tag added tomorrow is not found until the next scan.
- **Same-origin only.** Subdomains are not crawled.
- **Third-party classification uses a suffix test, not the Public Suffix List.**
  Wrong for `*.github.io` and similar multi-party suffixes.
- **The catalogue is small and hand-written.** Unmatched hosts are common and are
  reported as unclassified. DuckDuckGo Tracker Radar, EasyPrivacy and Disconnect
  are the obvious upgrades.
- **Consent-state scans are not implemented.** Only `baseline`.
- **IndexedDB is declared in the storage vocabulary but not enumerated.** Only
  `localStorage` and `sessionStorage` are read.
- **The worker is a single in-process loop.** No retry, no backoff, no
  distributed claim beyond the conditional update.
- **No screenshots, no form interaction, no clicking.** Deliberate.

## What the scanner will never do

- Decide that a cookie or technology requires consent
- Grant consent in order to discover more
- Store cookie values, storage values, headers or bodies
- Build a profile of any person
- Crawl a site outside the tenant that asked for it
