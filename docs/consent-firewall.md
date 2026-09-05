# The consent firewall

One evaluator, two planes, and a clear line between what each can actually do.

## The decision

Every enforcement decision in Rift — in a visitor's browser, and on a request
path the customer routes through us — comes from one function:
`evaluateFirewall` in `shared/consent-firewall.ts`. That function wraps
`decide()`, the pure allow/block evaluator that used to live in the SDK and now
lives beside it in the same file.

There is deliberately no second evaluator. Two implementations of "is this
allowed" drift, and the drift shows up as a vendor classified one way and
enforced another — which nobody notices until a tag that should have been gated
was not.

```
REQUEST
  → identify destination host
  → match against the approved rules      (derived by enforcementFrom)
  → identify vendor and gating purpose
  → read the visitor's recorded decisions
  → ALLOW | BLOCK | REDACT | REQUIRE_CONSENT | REVIEW
```

### Five classifications, two effects

Only two things can happen to a request: it goes, or it does not. Every decision
therefore carries both a `decision` (what an operator reads) and an `effect`
(what the request does).

| decision | effect | means |
| --- | --- | --- |
| `ALLOW` | allow | An approved rule permits it. |
| `BLOCK` | block | An approved rule forbids it. |
| `REQUIRE_CONSENT` | block | A gate exists and is unsatisfied. |
| `REDACT` | allow | Permitted, with configured fields removed first. |
| `REVIEW` | allow | **No rule matches. Nobody has looked at this.** |

`REVIEW` is the one worth dwelling on. Under the default policy an unmatched host
is allowed — deliberately, because blocking every unrecognised host takes down
fonts, payment providers and the customer's own API, and a consent tool that
breaks a site gets removed. What changed in Phase 11B is that such an allow is no
longer indistinguishable from a reviewed one. An operator can now see the
difference between "we approved this" and "nobody has looked at this yet".

An operator who has done the work can set `unknown_host: "block"` for a
default-deny posture.

### Failing safe

* An unmatched host is `REVIEW`, never a silent `ALLOW`.
* A consent gate that names no purpose blocks: no decision could satisfy it, so
  allowing it would make the rule decorative while looking like a control.
* A server-side request with **no principal whose decision can be read** treats a
  consent gate as unsatisfied. A server job with no visitor is not a visitor who
  agreed.
* A destination that is not an absolute `http(s)` URL has no host and matches no
  rule. It is not resolved against a base — doing so would turn a malformed
  string into a real hostname that might match a rule that was never about it.
* Redaction rules that fail validation block the request rather than sending it
  unredacted.

## Client enforcement

`sdk/src/enforce.ts`, running in the visitor's browser. Opt-in, `observe` by
default.

**Covered:** `fetch`, `XMLHttpRequest`, `sendBeacon`, `Image.src`,
`HTMLIFrameElement.src`, `Element.setAttribute` for every URL-bearing attribute,
and insertion through `appendChild`, `insertBefore`, `replaceChild`, `append`,
`prepend`, `after`, `before` and `replaceWith` — including a blocked resource
nested inside an inserted subtree. Element types covered are `script`, `iframe`,
`img`, `link`, `embed`, `object`, `source`, `video`, `audio` and `track`.

Cookies are refused **only** when the write names a `domain=` that a rule
matches.

### What client enforcement cannot do

These are structural, not bugs awaiting a fix.

1. **Anything that ran before the SDK did.** A `<script src>` in the served HTML
   is fetched by the parser before any JavaScript executes. Nothing on the page
   can stop that. Only a `Content-Security-Policy` header, a tag manager, or not
   shipping the tag can.
2. **Server-to-server transfers.** If the customer's backend forwards data to a
   vendor, no browser code sees it.
3. **A determined script can undo it.** The patches are ordinary JavaScript on a
   page the customer controls. Another script can capture the originals first or
   restore them from an iframe. This is a control against ordinary tags behaving
   ordinarily, not against a hostile one.
4. **First-party cookies written by a third-party script.** Indistinguishable
   from the site's own session cookie. Blocking by name would be guesswork, and
   guessing wrong logs real customers out. The control for this is
   `require_consent` on the script itself: a vendor that never loads writes
   nothing.
5. **Beacons on unload** may not be interceptable in time, depending on how the
   browser tears the page down.
6. **Blocking is not deletion.** A tag that fired once before a visitor withdrew
   consent has already transmitted.

### Where complete blocking needs infrastructure

| You need | Use |
| --- | --- |
| Stop a parser-loaded script | A `Content-Security-Policy` header on your own responses |
| Stop tags you do not control | A tag manager, or remove the tag |
| Stop your own backend's calls | `guardOutboundRequest` (below) |
| Stop a vendor calling another vendor | Nothing Rift offers. Rift is not on that path. |

Rift does not ship a CSP generator or a reverse proxy, and does not claim to.

## Server enforcement

`api/lib/firewall.ts`, `guardOutboundRequest`. This is the plane where a `BLOCK`
genuinely means the bytes did not leave, and the only plane where redaction is
possible at all — a browser patch can stop a request, but it cannot rewrite a
payload a tag assembled inside its own closure.

```ts
const outcome = await guardOutboundRequest({
  organisationId, siteId,
  request: { url: "https://vendor.example/collect", body: payload },
  principalExternalId: visitorId,
  redaction: { rules: [{ id: "email", field: "email", match: "name", strategy: "remove" }] },
});

if (outcome.send) await fetch(outcome.send.url, { method: "POST", body: JSON.stringify(outcome.send.body) });
```

It never dispatches the request itself. The caller does, with what comes back —
which keeps the decision testable without a network and separable from the
transport in a way an auditor can follow.

**It is a library, not a network proxy.** Code that calls `fetch` directly
bypasses it by construction. Presenting it as a network-level firewall would be
the "fake firewall that only logs a decision" this design set out to avoid.

## The audit trail

`enforcement_events` records what was decided. What it does **not** hold is the
point:

* **No request bodies.** This table would otherwise become a copy of every
  payload the firewall inspected, including the fields redaction exists to
  remove.
* **No full URLs** — hosts only. A URL carries a query string, and a tracking
  URL's query string is where the tracking data actually is.
* **No principal reference.** Linking an enforcement decision to a visitor would
  rebuild, on this side, the identity join that consent analytics deliberately
  does not have.
* **No header values, and no redacted values.** Redaction metadata is rule ids
  and paths.

Client-reported events are claims made by a browser, not measurements. The key is
site-scoped, the origin is checked and the rate limit applies, which bounds the
damage without changing its nature. That is why they are stored with
`source: "client"` and why the history endpoint ships a `coverage` block next to
the counts: "14 blocked" reads as completeness unless something says otherwise.

## Redaction

`shared/redaction.ts`. Operator-declared rules only — there is no list here of
fields that are "obviously" personal, because that list is wrong for somebody:
`location` is a warehouse on a logistics site and `phone` is a SKU on a phone
retailer's.

Matching covers nested objects, arrays, arrays of arrays, JSON string bodies,
query parameters (including repeated keys), and headers. Names match
case-insensitively by default; `match: "path"` targets one place when the same
name appears in several, with `[]` standing for any array index.

Strategies are `remove`, `mask` and `hash`. `hash` requires a salt and refuses to
run without one — an unsalted digest of a low-entropy value *is* the value.

A payload that cannot be fully walked (deeper than 24 levels, or more than 20,000
fields) is **refused**, not partially redacted. Something we could not finish
walking is something we cannot claim to have redacted.

Redaction metadata reports rule ids and paths, never values. Proving redaction
happened by logging what was redacted would defeat the exercise entirely.

## API

| Method | Path | Plane |
| --- | --- | --- |
| `POST` | `/api/v1/sites/{siteId}/firewall` | management — dry run, never recorded |
| `GET` | `/api/v1/sites/{siteId}/enforcement` | management — history and coverage |
| `POST` | `/api/v1/enforcement` | ingest — SDK reports its own decisions |

The dry run never echoes a payload back and never writes an event. An endpoint
that echoed the payload would be a way to launder sensitive data through the
audit surface.
