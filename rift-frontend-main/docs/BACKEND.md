# What the frontend needs from the backend

> **Answered.** This was the request; the platform now serves it and the
> dashboard reads live. How each endpoint below maps onto the real
> `/api/v1` surface is in
> [`docs/frontend-integration.md`](../../docs/frontend-integration.md). Paths
> and field names differ from what was asked for here — the translation lives in
> `apps/dashboard/lib/api/adapters.ts`, which is exactly the one file this
> document said would have to change. Kept as written, because it records what
> the frontend needs and why, which is still the thing to check a change
> against.

Every call the Rift dashboard makes, in the order that unblocks the most
screens. All of it lives behind one file — `apps/dashboard/lib/api/endpoints.ts`
— so if a path or field name differs on your side, that is the only file that
changes and TypeScript will point at every affected call site.

The frontend implements no regulation logic, no consent enforcement and no
policy decisions. It renders what you return. Where a screen shows a sentence
about consent behaviour, that sentence comes from you — the UI never composes
one from the parts.

## Conventions

- Base URL comes from `RIFT_API_URL`. Everything below is relative to it.
- `Authorization: Bearer <token>` on every request. The token stays server-side;
  the browser never sees it.
- JSON in, JSON out. `204` for writes with no body.
- Timestamps are ISO 8601 with timezone.
- Errors: any non-2xx returns `{ "code": "snake_case_code", "message": "..." }`.
  `code` is what the UI branches on; `message` is never shown raw to a user.
  Codes the UI already handles specially: `site_unreachable`, `not_found`,
  `timeout`. Anything else falls back to a generic recovered-state message.

## Phase 1 — the golden journey

Without these, nothing works. With them, a company can go from a URL to a
verified install.

| Method | Path | Returns |
|---|---|---|
| `POST` | `/v1/sites` | `{ siteId, scanId }` — body `{ url }` |
| `GET` | `/v1/sites` | `Site[]` |
| `GET` | `/v1/sites/:siteId` | `Site` |
| `GET` | `/v1/scans/:scanId` | `Scan` |
| `GET` | `/v1/scans/:scanId/findings` | `Finding[]` |
| `GET` | `/v1/sites/:siteId/configuration` | `RiftConfiguration` |
| `POST` | `/v1/sites/:siteId/configuration/accept` | `{ version }` |
| `GET` | `/v1/sites/:siteId/install/snippet` | `InstallSnippet` |
| `GET` | `/v1/sites/:siteId/install/verify` | `Verification` |

### The one that needs a decision: scan progress

`GET /v1/scans/:scanId/stream` — server-sent events, one `data:` frame per
stage transition, each frame a complete `Scan` object:

```
data: {"scanId":"scn_8841","status":"running","stages":[...],"counts":{...}}

```

**If a stream is more than you want to build, say so and I will switch the hook
to polling `GET /v1/scans/:scanId`.** That is a one-file change on my side
(`hooks/useScanProgress.ts`) and the fallback is already written — it currently
activates on its own if the stream drops. A stream is nicer; it is not a
blocker.

## Phase 2 — after install

| Method | Path | Returns |
|---|---|---|
| `GET` | `/v1/sites/:siteId/scans` | `ScanSummary[]` |
| `GET` | `/v1/scans/:scanId/diff?baseline=:scanId` | `ScanDiff` |
| `GET` | `/v1/sites/:siteId/changes` | `ChangeEntry[]` |
| `GET` | `/v1/sites/:siteId/consent/overview?days=14` | `ConsentOverview` |
| `GET` | `/v1/sites/:siteId/consent/records?limit=25` | `ConsentRecord[]` |
| `GET` | `/v1/sites/:siteId/analytics?days=14` | `AnalyticsOverview` |

## Phase 3 — manual configuration

| Method | Path | Returns |
|---|---|---|
| `PATCH` | `/v1/sites/:siteId/configuration/technologies/:technologyId` | `204` — body `{ category }`, `null` to unclassify |
| `POST` | `/v1/sites/:siteId/configuration/technologies/:technologyId/restore` | `204` |

## Shapes

Authoritative definitions are in `apps/dashboard/lib/api/types.ts`. The fields
that carry product meaning, and are easy to get subtly wrong:

**`Finding.confidence`** — `"confirmed" | "likely" | "unresolved"`.
`unresolved` means *you could not classify it*, not that anything is wrong.
The UI renders it neutrally and never as a warning, so please don't use it as
a catch-all for errors.

**`Finding.category`** — `null` when unresolved. Do not send a guess, and do
not send `"Unknown"`; the UI shows "Not classified" and suppresses consent
behaviour entirely for null.

**`Finding.recommendation`** vs **`Finding.decision`** — these must stay
separate. `recommendation` is what Rift concluded; `decision` is what the
company chose, with `overridesRecommendation` telling the UI whether to render
the override treatment and offer a restore path. This split is what makes the
trail auditable, and it is the one thing the frontend cannot reconstruct.

**`Finding.consentBehaviour`** — `{ summary, detail }`, written by you.
The frontend deliberately does not build these sentences from the category.

**`Scan.status`** — `completed_with_limitations` is a first-class success, not
a failure. Send `limitations: { pagesReached, pagesTotal, unreachable[] }` with
it and the partial results screen renders itself. Partial findings are never
discarded.

**`RegionConfiguration.reasoning`** — optional, but it powers the privacy
assessment screen: `{ factors[], source, knowledgeBaseVersion, appliedAt }`.
Without it the region still renders, just without the "why".

**`Verification.status`** — `checking | connected | not_activated | not_detected`.
For anything other than `connected`, send `causes[]` as
`{ title, detail, remedy }` ordered most-likely-first. The UI renders them as
numbered troubleshooting steps and never says "installation failed".

## Not needed from you

- Auth UI — the dashboard assumes a session and reads the token server-side.
- Anything the SDK owns: consent persistence, cookie writes, tracking
  enforcement. The dashboard only ever displays what the SDK recorded.
- Copy for consent categories or region behaviour beyond the fields above.

## Fastest way to unblock me

An OpenAPI document at any URL. Then:

```bash
RIFT_OPENAPI_URL=https://your-api/openapi.json npm run api:types
```

generates `schema.d.ts` and I replace the hand-written contract with it. Short
of that, a sample JSON response for each Phase 1 endpoint is enough — I can
align the types from real payloads faster than from prose.
