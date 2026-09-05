# Rift — frontend

Website privacy control plane. This repository is the **frontend only**: a
presentation and consumption layer over the Rift public API.

It does not implement regulation logic, consent enforcement or policy
decisions, and it holds no second representation of consent semantics. It
renders the explicit configuration objects the API returns.

## Run it

```bash
npm install
npm run dev -w @rift/dashboard   # http://localhost:3100  the product
npm run dev -w @rift/marketing   # http://localhost:3200  the public site
```

The marketing site's hero field hands the URL to the dashboard at
`/dashboard/sites/new?url=…`, so the scan flow works end to end across both
apps in development. Point `NEXT_PUBLIC_APP_URL` elsewhere for deployed
environments.

With no backend configured it runs entirely on fixtures, and an amber banner
across the top says so. Every screen, chart and table is populated.

## Connect the backend

**It is connected.** This workspace now runs against the Rift platform in
`../api`, and the wiring is documented in
[docs/frontend-integration.md](../docs/frontend-integration.md) — start
everything with `npm run dev` from the repository root and open
http://localhost:3100/dashboard.

What follows describes the seam that made it possible, and is still how you
point this at a different deployment.

```bash
# apps/dashboard/.env.local
RIFT_API_URL=https://api.your-backend.example
RIFT_API_TOKEN=…        # only if the API wants a static dev key
```

Restart, the banner disappears, and every screen reads live. The API layer is
the only thing that changes:

| File | What it holds |
|---|---|
| `apps/dashboard/lib/api/types.ts` | The product contract — what a screen is allowed to know. |
| `apps/dashboard/lib/api/backend.ts` | The platform's wire shapes, snake_case, exactly as they are. |
| `apps/dashboard/lib/api/adapters.ts` | Pure wire→product mappings. No I/O, so each is testable on a literal. |
| `apps/dashboard/lib/api/endpoints.ts` | Every read and write, one function each: which calls a screen needs, in what order, under which cache tags. |
| `apps/dashboard/lib/api/client.ts` | Base URL, auth header, timeout, cache tags, error normalisation. |
| `apps/dashboard/lib/api/fixtures.ts` | Development data, used whenever `RIFT_API_URL` is unset. |

`RIFT_MARKETS` also matters: ISO 3166 region codes (`DE,IN,US-CA`) telling the
policy engine which markets the organisation serves. They are an assertion the
business makes about itself — nothing geolocates a visitor.

TypeScript will point at every call site that needs attention when the real
shapes land.

## Architecture

**Next.js is the BFF, not a client of the API.** Server Components call the
Rift API server-side; the access token never reaches the browser. Client
components that must call out go through `app/api/rift/[...path]/route.ts`.
Site scoping is attached per request on the server, so tenant authorization is
structural rather than a rule people have to remember.

**Tokens are CSS custom properties, not Tailwind config.**
`packages/tokens/src/tokens.css` is the source of truth; Tailwind v4's `@theme`
consumes it. A marketing site can import the same file and inherit the system
without forking it.

## Design system — Material Design 3

Seeded from `#6750A4`. Class names mirror the MD3 colour roles exactly
(`bg-md-primary`, `text-md-on-surface-variant`, `bg-md-secondary-container`),
so a Material spec reads straight across into markup.

Three rules carry the whole look, and breaking any one of them is what makes
an MD3 interface look generic:

1. **Depth is tonal, not shadowed.** The ladder is
   `md-surface` → `md-surface-low` → `md-surface-container` → `md-surface-high`.
   Never use pure white for a background; `#FFFBFE` is the page.
2. **Interaction is a state layer, never a colour swap.** Hover on a filled
   button is the base colour at 90%; on a transparent one it is the accent at
   10%. Every clickable element also takes `active:scale-95`.
3. **Every button is a pill.** `rounded-full`, no exceptions — except FABs,
   which use the 28px squircle.

Shape: cards 24px, panels 32px, hero containers 48px. Motion: 200/300/400ms on
`cubic-bezier(0.2, 0, 0, 1)`. Type: Roboto 400/500/700 on the MD3 scale, where
hierarchy comes from size rather than weight — headlines are `font-normal`.

The atmospheric layer is `<BlurField />` in `@rift/ui`: large, heavily blurred,
multiply-blended shapes positioned partly off-canvas. It is decorative and
`aria-hidden`. Hero and major panels get one; ordinary cards do not.

Extended roles beyond the MD3 spec: `md-success` and `md-warning`, harmonised
toward the seed. `md-error` is reserved for hard failures only — an unreachable
site, an install that was never detected. **Uncertainty is never error**; an
unresolved finding takes the neutral surface variant, because it is not a
problem.

Chart series are `#6750A4 · #B3487A · #4C9A2A`, in that fixed order, validated
for lightness band, chroma floor, colour-vision separation and contrast.

**Writes are Server Actions.** `app/actions.ts` is the only write path, and each
action invalidates the cache tags its reads were fetched under.

**Live surfaces have one hook each.** `hooks/useScanProgress.ts` prefers SSE and
falls back to interval polling on its own. Swapping transport touches that file
alone. The stream route is `app/api/scans/[scanId]/stream/route.ts` — point its
proxy branch at your backend's stream, or delete it and let polling carry it.

## Packages

```
apps/dashboard        Next.js App Router — the authenticated dashboard
apps/marketing        The public site. Same tokens, same primitives.
packages/tokens       Design tokens. Zero dependencies, product-agnostic.
packages/ui           Product primitives on Radix, themed from tokens.
packages/consent-ui   Visitor banner + preference centre. Props in, callbacks
                      out; no persistence, no cookie writes, no Next.js —
                      the SDK consumes these directly.
```

Workspace packages ship as source and are compiled by Next (`transpilePackages`).
No build step, no watch mode.

> Tailwind does not discover files outside the app directory. If you add a new
> package with its own classes, add an `@source` line in
> `apps/dashboard/app/globals.css` or its styles will silently never be
> generated.

## Product rules the code holds

- The primary action is always the automated path — "Use Rift configuration",
  never "configure everything manually". Manual routes are `secondary`.
- Three-level confidence is a first-class component. `unresolved` wears the
  neutral surface variant: it never means illegal, blocked or consent-requiring.
- Rift's recommendation and the company's override are always visually
  distinct, and every override carries a restore path (`RecommendationPair`).
- Long async work is staged with completed steps visible. No bare spinners.
- Errors say what happened, whether Rift recovered, and what to do next
  (`lib/api/errors.ts` → `explainError`). The error role is for hard failures only.
- Partial scan results are shown, never discarded.

## Routes

```
/dashboard                                  Overview — multi-site
/dashboard/sites                            All websites
/dashboard/sites/new                        Enter a website URL
/dashboard/sites/:siteId                    Site overview + section tabs
/dashboard/sites/:siteId/privacy            Privacy assessment + reasoning chain
/dashboard/sites/:siteId/configuration      Generated configuration
/dashboard/sites/:siteId/configuration/review   Every decision, inspectable
/dashboard/sites/:siteId/changes            Review queue + change feed
/dashboard/scans                            Scan history
/dashboard/scans/:scanId                    Progress → results → findings drawer
/dashboard/scans/compare                    Scan-to-scan diff
/dashboard/configure                        Advanced configuration + overrides
/dashboard/install                          Install snippet
/dashboard/install/verify                   Verification  (?state=issue for the failure path)
/dashboard/consent                          Consent dashboard
/dashboard/analytics                        Analytics dashboard
/dashboard/settings                         Settings
/preview/banner                             Visitor banner + preference centre
```

Every screen has loading, empty, partial and error states. `scn_8455` is the
partial-scan fixture; `?state=issue` on verify is the not-activated path.

## What the backend has to provide

See **[docs/BACKEND.md](docs/BACKEND.md)** — every endpoint the frontend calls,
with request and response shapes, ordered by what unblocks the most screens.

## Switching to pnpm

```bash
rm -rf node_modules package-lock.json
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > pnpm-workspace.yaml
pnpm install
```
