# The Consent Experience

The banner a visitor sees, the preference centre they change their mind in, and
the one snippet a customer pastes to get both.

Research artifact, not legal advice.

## The flow

```text
Company adds a website
        ↓
Rift scans it                          → docs/crawler.md
        ↓
Rift resolves the legal context        → docs/jurisdiction-resolution.md
        ↓
Rift evaluates what applies            → docs/policy-engine.md
        ↓
Rift PROPOSES a configuration          ← a person reads this
        ↓
Company declares purposes              ← a person does this
        ↓
One snippet, pasted once
        ↓
The runtime fetches its config and renders
```

Two of those steps are done by a person, and that is the design rather than a
missing feature. See [What Rift will not decide](#what-rift-will-not-decide).

## Where it lives

| Path | What it is |
| --- | --- |
| `shared/consent-config.ts` | The contract: runtime config, and the proposal |
| `api/lib/consent-config.ts` | Builds both. The **only** module in `api/` that imports the policy engine |
| `api/lib/install-snippet.ts` | The snippet, as a pure function so it can be tested |
| `api/app/api/v1/consent/config/route.ts` | `GET`, browser plane — what the banner fetches |
| `api/app/api/v1/sites/{siteId}/consent-proposal/route.ts` | `GET`, management plane — the review artifact |
| `api/app/dashboard/onboarding/page.tsx` | The six-part screen the brief describes |
| `sdk/src/ui.ts` | Banner and preference centre |
| `api/tests/consent-experience.test.ts` | 51 tests |

No migration. No new table.

## Two artifacts, deliberately unalike

| | Runtime config | Proposal |
| --- | --- | --- |
| Served to | Browsers, under `pk_` | Operators, under `sk_` |
| Contains reasoning | **No** | Yes, with citations |
| Contains a regime or jurisdiction | **No** | Yes |
| Applied automatically | It *is* the config | **Never** |
| Stored | Derived on read | Computed on demand, stored nowhere |

### The browser does no legal reasoning

`ConsentRuntimeConfig` carries labels, purpose codes and display order. It
carries no regime, no citation, no requirement and no jurisdiction rule — and a
test greps the serialised payload for each of those words to keep it that way.

That is not tidiness. A bundle carrying legal reasoning would ship it to every
visitor of every customer site, where it can be read, modified, blocked, or run
in a browser nobody tested; and whatever it concluded would be unauditable
afterwards. The server reasons. The browser renders and records.

### The proposal is a starting point, not a setting

`app/dashboard/configure/page.tsx` already argued that Rift cannot know which of
an operator's purposes covers a detected vendor — a purpose is operator-declared
free text, and a guessed mapping would be *"confident, unauditable and often
wrong"*. That argument stands and this phase does not overturn it.

What it adds is the half that was missing. Rift **can** say which technologies
were observed, which regimes appear to be in play, and what a reasonable
starting point looks like — provided every line carries the evidence behind it,
the whole thing is marked `requires_review`, and nothing is written. A
suggestion a person can disagree with *specifically* is useful; a mapping applied
silently is not.

So the onboarding screen's action is a link to Configure, not a button that
writes.

## Configuration is derived, not stored

There is no `consent_configurations` table. The runtime config is computed on
read from the purposes and notice the operator already declared, which means
"activate" is not a new concept with its own row and its own opportunity to
disagree with the consent domain — it is the act of declaring a purpose, which
already existed.

Consequences worth knowing:

- **Only purposes the current notice discloses are offered.** A purpose the
  notice does not mention has not been explained to the visitor, and offering a
  toggle for it would collect a choice about something they were never told
  about.
- **`config_version` hashes the rendered content**, never a timestamp. An
  unchanged site keeps one version across deploys; a timestamp would invalidate
  every cache and re-prompt every visitor, and re-prompting looks like a fresh
  consent request.
- **Cached for 60 seconds** with `stale-while-revalidate`. A purpose change
  reaches live banners in about a minute; not caching at all would put a
  database read on every page view of every customer site.

## The banner

Rendered inside a **shadow root**, so a customer's stylesheet cannot accidentally
hide the reject button and this stylesheet cannot leak into their page. It is the
only structural guarantee available to a script running on a site whose CSS
nobody here has seen.

| Requirement | How |
| --- | --- |
| Accept all / reject all / manage | Three buttons, always all three |
| Purpose-level choices | Preference centre, one checkbox per purpose |
| Region-aware | Server-side: the proposal is jurisdiction-aware; the banner is not |
| Accessible | `role="dialog"`, `aria-modal`, `aria-labelledby`, focus moved in and trapped, real `<button>`/`<input>` elements, `prefers-reduced-motion` |
| Mobile-friendly | Bottom sheet under 640px, 44px targets, centred dialog above |

### There is no dismiss button

No "×", no "close", no click-outside. A dismissal that silently means *no* is a
decision made on the visitor's behalf; one that silently means *yes* is worse. A
test asserts no such control exists.

### Reject all still grants essential purposes

A purpose the operator declared essential renders locked-on and is granted by
"reject all", because offering a reject that does nothing to a row shown as
locked would be a control that lies. Essential purposes are **shown** rather than
hidden — a visitor is entitled to see everything running, including what they
cannot switch off.

Note what `essential` means here: **the operator claims it**, and Rift reports
the claim. The platform has no basis to decide a purpose is strictly necessary,
and that claim is exactly the one a regulator would question.

### Deny and withdraw are different

Turning a purpose off records `deny` when it was never decided and `withdraw`
when it was previously granted. That distinction is why the consent log is
append-only: *declined* and *changed their mind* are different facts, and a
preference centre that wrote both as `DENIED` would destroy the second.

## No invented legal text

Every string the banner can render is either operator-authored or comes from
`CONSENT_FALLBACK_TEXT`, which is deliberately dull: it says what the buttons do
and that the site stores information. It asserts no legal basis, names no
regulation, and never tells a visitor they are required to choose. A test checks
the rendered output for "gdpr", "required by law" and similar.

Where the operator has authored nothing, the config's `text` fields are `null` —
not a default string dressed up as their words.

## Installation

```html
<!-- Rift consent + analytics. Paste once, before </head>. -->
<script src="https://app.example.com/js/rift-cmp.js"></script>
<script>
  analytics.init("site_demo", "pk_demo_12345", { apiUrl: "https://app.example.com" });
  analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));
  analytics.banner.show();
</script>
```

The only values baked in are the site id, the public key and the origin — the
three things that say *which site this is*, none of which is a policy. Purposes,
copy, order and the notice are fetched at runtime, so adding a purpose is a
dashboard action rather than a redeploy of somebody else's website. A snippet
that hard-coded the purpose list would guarantee the banner and the consent log
disagree the first time either changed.

A separate snippet is offered for a "Cookie settings" control, because a
withdrawal control a visitor cannot find is one they do not have.

## What Rift will not decide

- **Which purpose covers which vendor.** Suggested, with evidence; never applied.
- **Whether a purpose is essential.** The operator claims it.
- **Whether a banner is legally required.** The engine annotates; nothing gates.
- **What a banner must say.** Fallback copy makes no legal claim.
- **Where the visitor is.** No geolocation; markets are an operator declaration.

## Limitations

- **Region-awareness is at proposal time, not render time.** The banner shows
  the same purposes to every visitor. Serving different configurations by
  detected region would need geolocation on the config endpoint — deliberately
  absent, since that endpoint is public, cacheable and currently sees nothing
  about anybody.
- **No vendor-level toggles.** `ConsentPurposeConfig.vendors` is display-only.
  Per-vendor consent is a bigger data model than this phase has.
- **One locale.** The notice carries a locale and the config reports it; nothing
  selects between translations.
- **The proposal's category mapping is coarse** — a handful of scanner
  categories to a handful of suggested purposes. Anything unmatched is reported
  as unmapped rather than guessed.
- **"Activate" is not a single button.** It is declaring purposes and pasting the
  snippet. A one-click activate would have to declare purposes on the operator's
  behalf, which is the one thing this phase refuses to do.
- **No consent-mode signalling** (Google Consent Mode, IAB TCF). Neither is
  implemented, and neither should be assumed.
- **The banner is not shown automatically.** `analytics.banner.show()` is an
  explicit call. A tag that drew a dialog over a customer's page the moment it
  loaded would be a surprising thing to do unasked.

## Verification

```bash
npm run test:unit    # 460 tests; 51 are the consent experience
npm run typecheck
npm run lint
```
