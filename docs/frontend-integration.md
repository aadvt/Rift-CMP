# The dashboard, and how it talks to the platform

`rift-frontend-main/` is the product UI. It is a separate Next.js workspace with
its own lockfile, and it consumes the platform over HTTP exactly the way an
external integrator would — no Prisma, no policy engine, no crawler internals.
That boundary is the point: if a screen needs something the API cannot express,
the API is what changes.

```
rift-frontend-main/apps/dashboard      the product          :3100
rift-frontend-main/apps/marketing      the public site      :3200
api/                                   the platform + SDK   :3000
crawler/                               performs queued scans
```

## Running it

```bash
npm run dev          # all three: platform, worker, dashboard
```

Open **http://localhost:3100/dashboard**.

The worker is not optional. Scans are queued by the API and performed by a
separate process; without it a scan sits at `queued` for ever and the progress
screen waits on something that is never coming. `npm run dev` starts it, and
restarts it if it falls over.

Individually:

```bash
npm run dev:api          # platform on :3000
npm run dev:worker       # scan worker
npm run dev:dashboard    # dashboard on :3100
npm run dev:marketing    # marketing site on :3200
```

## Configuration

`rift-frontend-main/apps/dashboard/.env.local`:

| Variable | What it is |
|---|---|
| `RIFT_API_URL` | Origin of the platform API. The `/api/v1` prefix is added in code, so this stays an origin. Unset it and the whole app runs on fixtures with an amber banner saying so. |
| `RIFT_API_TOKEN` | An organisation secret (`sk_…`). Server-side only; it never reaches the browser. |
| `RIFT_MARKETS` | Region codes the organisation says it serves, e.g. `DE,IN,US-CA`. **ISO 3166 codes, not jurisdiction names** — `EU` is a jurisdiction the engine *resolves to*, not a market you assert. With none set the engine resolves nothing and the privacy screen says so rather than guessing. |
| `RIFT_API_TIMEOUT` | Request timeout in ms. Generating a policy evaluates the whole requirement matrix and takes seconds on a large site. |

There is no login screen. The platform authenticates an *organisation*, not a
person, and the dashboard holds the credential server-side — so the shell shows
the organisation's name and does not invent a user account.

## The three layers

| File | Responsibility |
|---|---|
| `lib/api/backend.ts` | The platform's wire shapes, snake_case, exactly as they are. Nothing here is shaped for a screen. |
| `lib/api/adapters.ts` | Pure functions: wire shape → the product contract in `types.ts`. No I/O, so every one is testable on a literal. |
| `lib/api/endpoints.ts` | The I/O: which calls a screen needs, in what order, cached under which tags. |

A component never sees a platform response. Renaming a backend field is a
one-file change in `backend.ts` plus wherever `adapters.ts` reads it.

### The rule the adapter is written under

**It never invents a judgement.** Where the platform has decided something —
which purpose covers a vendor, whether consent is required, and why — that
decision is carried across verbatim, and the sentence the policy layer wrote is
the sentence the screen shows. Where the platform has no answer, the answer is
`null`.

Two kinds of sentence *are* composed in the adapter, and the distinction
matters: statements about **what Rift's own runtime will do** ("held until the
visitor decides") are facts about our software. Statements about **what the law
requires** are quoted from the obligation the engine raised, never assembled
from parts.

### Caching

Reads carry a short `revalidate` window and a cache tag; every write calls
`revalidateTag` on the tags its reads were fetched under. Staleness is bounded
by the tag, not by the timer — an accepted configuration is visible immediately.

Gathering helpers are wrapped in React's `cache`, which deduplicates them within
one render. Without it the shell, the current-site resolver and the screen each
fetched the site list separately, and the per-site fan-out happened three times.

## What the platform gained for this

All additive. Nothing existing changed shape.

| Addition | Why |
|---|---|
| `GET /api/v1/sites/:siteId/install` | The snippet for a site, and whether it has ever reported. The snippet is built by `lib/install-snippet.ts` rather than assembled by the caller, so the dashboard cannot hold a second opinion about what a customer pastes. |
| `GET /api/v1/scans/:scanId/diff` | What changed between two scans, using the crawler's own `diffScans`. Defaults to the previous completed scan of the same site. |
| `database.getScanTechnologies` | The autopilot and the proposal read technologies and nothing else; both were loading every observation to do it, which was seconds per call on the slowest endpoint the dashboard has. |
| `database.recordScanProgress` | Page counters for a running scan. A crawl writes its observations once at the end — correct, but it left a progress screen with nothing true to show for minutes. Counters are safe to move early because they say how far the crawl got, not what it found. |
| Worker: retry on claim failure | A managed Postgres drops connections routinely, and the worker exited when it happened. Every queued scan then waited for ever on a process that was gone. |
| Worker: `scripts/worker.mjs` | `DATABASE_URL` has to be in the environment before `database` is imported, and a static import cannot be preceded by anything. |

## Things worth knowing before changing a screen

- **`Finding.confidence: 'unresolved'` is not a warning.** It means Rift could
  not classify the item. It is not blocked, not flagged as unlawful, and does
  not require consent because of it. The design system gives it the neutral
  surface for exactly this reason.

- **A scan that stopped at a budget is not a failed scan.** `Scan.limitations`
  carries a `kind` — `budget`, `unreachable` or `cancelled` — because telling a
  customer their website stopped responding when Rift simply reached its own
  page limit sends someone to debug a healthy server.

- **One visitor's single choice is one decision.** The runtime writes one
  consent record per purpose, seconds apart, so the adapter sessionises them
  with a 30-second gap. Counting rows reports a site's decisions as a multiple
  of its category count.

- **The category preview must equal what acceptance declares.** Accepting takes
  the union of the proposal's purposes and the purposes the recommendations
  name; the configuration screen previews that same union. They were computed
  differently once, and the screen promised two categories then created three.

- **Analytics reports sessions, not unique visitors.** There is no durable
  visitor identifier in the analytics domain, and the platform says so in
  `shared/analytics.ts`. The screens say "sessions".

- **A write sends a category's id, never its label.** The platform matches a
  purpose by code, so posting `"Analytics"` where `analytics` belongs attaches
  the vendor to a purpose that does not exist — accepted, stored, and with no
  effect on any banner. `TechnologyConfiguration` and `Finding.recommendation`
  each carry both: the label to render and the `…Id` to send. The category
  choices a screen offers come from `config.consent.categories`, never a
  hard-coded list.

- **A finding's id is the policy's key, not the scanner's.** The policy layer
  keys a recommendation on a slug of the vendor's display name and the scanner
  keys a detection on its detector id. They agree for most vendors and not all —
  `linkedin-insight` against `linkedin-insight-tag`. `toFindings` resolves the
  recommendation by trying both and reports the matched key, so an override is
  written where the recommendation will look for it.

## Scan progress

`hooks/useScanProgress.ts` prefers SSE and falls back to polling on its own.
The platform has no event stream, so `app/api/scans/[scanId]/stream/route.ts`
polls it server-side and emits complete `Scan` frames — one long-lived
connection per client instead of a tab full of timers, with the token staying on
the server. `app/api/scans/[scanId]/route.ts` serves the polling fallback in the
same shape, so the two transports are interchangeable.
