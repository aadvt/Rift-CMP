# Enforcement

Acting on an approved policy rather than only recording what a visitor chose.

Research artifact, not legal advice.

```text
Approved policy  +  recorded decision
        ↓
   enforcement decision
        ↓
   ALLOW   /   BLOCK
```

## The enforcement boundary

The brief says not to claim browser enforcement blocks every possible data
transfer. It does not, and these are structural limits rather than bugs awaiting
a fix. Read this section before telling a customer what Rift does.

**What browser enforcement can stop**

| | |
| --- | --- |
| `fetch` | Rejected with a network error |
| `XMLHttpRequest` | Redirected to an unresolvable URL |
| `navigator.sendBeacon` | Returns `false` |
| `Image.src` (pixels) | The assignment is dropped |
| Script insertion | `appendChild` / `insertBefore` return the node unattached, so it never fetches |

**What it cannot stop, and why**

1. **Anything that already ran.** A tag that executed before
   `analytics.enforcement.start()` has already run. A `<script src>` in the
   served HTML is fetched by the parser *before any JavaScript executes at all*
   — nothing in a page can prevent that. Only a Content-Security-Policy header,
   a tag manager, or not putting the tag in the HTML can.
2. **Server-to-server transfers.** If the customer's own backend forwards data
   to a vendor, no browser code sees it.
3. **A determined script.** These are ordinary patches on a page the customer
   controls. Another script can capture the originals first or restore them from
   an iframe. This is a control against ordinary tags behaving ordinarily, not
   against a hostile one.
4. **Beacons during unload**, depending on how the browser tears the page down.
5. **Data already sent.** Blocking a request is not deleting what a tag
   transmitted before the visitor withdrew consent.

**This is why the API re-derives consent from the log.** Browser enforcement
raises the cost of a leak and gives an operator a real control; the server
boundary is what is actually load bearing. Both are needed and neither is
sufficient.

## Observe before you enforce

The default mode is `observe`, and that default is deliberate. Turning
enforcement on is the most dangerous thing an operator can do to their own site:
a mis-scoped rule breaks a checkout and they find out from customers.

In `observe`, the runtime decides exactly as it would in `enforce`, records what
it *would* have blocked, and blocks nothing.

```js
await analytics.enforcement.start();                  // observe
console.table(analytics.enforcement.explain());       // look
await analytics.enforcement.start({ mode: "enforce" }); // then commit
```

## The decision

| Situation | Decision | Why |
| --- | --- | --- |
| Purpose granted | allow | |
| Purpose denied or withdrawn | block | Neither is a granted purpose |
| Purpose never decided | **block** | Silence is not consent |
| Policy says `allow` | allow | No gate on this vendor |
| Policy says `block` | block | Blocked outright, whatever the visitor chose |
| `require_consent` with no purpose | block | No decision could ever satisfy it, so allowing would leave a control that does nothing |
| Host matches no rule | `unknown_host` | `allow` by default — see below |
| Not an http(s) URL | allow | No rule can apply to it |

**Unmatched hosts are allowed by default**, and that is a stated choice rather
than an oversight. Blocking every unrecognised host would break the site being
protected — fonts, CDNs, payment providers and the customer's own API are all
unmatched — and a consent tool that takes a site down gets removed. The
scanner's job is to shrink that set by naming what is actually there.
`unknown_host: "block"` is available for an operator who has done that work and
wants a default-deny posture.

## Where the rules come from

```text
approved policy version   (Phase 9A)
        ↓  vendor → hosts, via the catalogue, SERVER-SIDE
GET /api/v1/consent/config
        ↓  hosts + purposes + actions. No regime, citation or requirement.
   analytics.enforcement.start()
```

Vendor-to-host resolution happens on the server, using the same catalogue that
classified the vendor in the first place. Two different matching rules would
mean a vendor classified one way and enforced another — a discrepancy nobody
would notice until a tag that should have been gated was not. It also keeps the
catalogue out of every customer's page.

`ignore` and `review` produce no rule. `ignore` is the operator saying the vendor
is out of scope; `review` is the autopilot saying it does not know, and acting on
"I do not know" by blocking would take a site down on the strength of an absence.

Rules exist **only after a policy version is approved**. Enforcing a
recommendation nobody approved is exactly what Phase 9A refused to do.

## The test mode

`analytics.enforcement.explain()` returns the columns the brief asks for, for
every decision taken — allowed and blocked alike. Showing only the blocks would
answer "what did you stop" and not the question an operator actually has, which
is *"what did you let through, and why"*.

| Column | Field |
| --- | --- |
| Tracker | `vendor`, `resource` |
| Purpose | `purpose` |
| User state | `user_state` — granted, denied_or_withdrawn, undecided |
| Policy | `policy` — the matched rule |
| Decision | `decision` |
| Reason | `reason`, in words |

`analytics.enforcement.preview(url)` decides about one URL without touching the
page or adding a row.

## The server boundary

A request must not rely solely on a client-side flag, and does not.

A site opts in by setting `analytics_consent_purpose`. From then on
`POST /api/v1/events` **re-derives the decision from the append-only log** on
every batch. It does not believe a flag, a header, or a claim in the payload —
the request supplies only *which principal to look up*, and the answer comes
from `consent_records`. That mechanism is Phase 6A's and is unchanged; 9B tests
it from the bypass direction.

Two things worth being precise about:

- **Approving a policy is not a server-side gate.** The gate is
  `analytics_consent_purpose`. Conflating them would make approving a policy
  silently start refusing traffic, which is not what an operator pressed the
  button for. A regression test pins this.
- **Approving is a management-plane action.** A site public key — which ships in
  page source — cannot approve a policy or set an override, because either would
  change what every visitor's banner enforces.

## A bug in enforcement must not take a site down

Every patch falls through to the original on error, `shouldBlock` returns
`false` on any exception, and `stop()` restores every global exactly. There is a
test that breaks the consent client on purpose and asserts that requests still
succeed. Degrading to "not enforcing" is acceptable; degrading to "site down" is
not.

## Limitations

- **No cookie or storage blocking.** `document.cookie` and `localStorage` are
  observed by in-page discovery but not blocked here. A vendor that only writes
  a cookie is unaffected.
- **No CSP generation.** The most effective control against a `<script src>` in
  served HTML is a Content-Security-Policy header, which Rift does not emit.
- **First-match-wins on rules**, ordered by host. A vendor matching two rules
  gets the alphabetically first, which is stable but arbitrary.
- **Decisions read the cached consent state**, because a patched `fetch` has to
  decide synchronously. The cache is refreshed once at `start()`; a decision made
  in another tab reaches this one on the next load.
- **`explain()` is in-memory and bounded** (500 decisions by default). It is a
  debugging aid, not an audit trail — the audit trail is the consent log.
- **Enforcement is opt-in and never starts itself.** A tag that patched five
  globals unasked would be indistinguishable from the trackers this exists to
  control.

## Verification

```bash
npm run test:unit         # 541 tests; 38 are enforcement
npm run test:integration  # includes enforcement-boundary.test.ts (23 tests)
```

The boundary tests — direct API bypass, cross-tenant, and the analytics and
secure-transfer regressions — run against a real Postgres.
