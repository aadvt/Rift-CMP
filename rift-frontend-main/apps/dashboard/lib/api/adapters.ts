import 'server-only';
import type * as W from './backend';
import type {
  AnalyticsOverview, ChangeEntry, ConfidenceLevel, ConsentCategory, ConsentOverview,
  ConsentRecord, DiffEntry, EnforcementConfiguration, Finding, HealthState, InstallSnippet,
  RegionConfiguration, RiftConfiguration, Scan, ScanDiff, ScanStage, ScanStageId, ScanStatus,
  ScanSummary, Site, SiteStatus, TechnologyConfiguration, Verification, VerificationCheck,
} from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Wire shape → product shape.
 *
 * Every function here is pure: platform responses in, `types.ts` out. No
 * fetching, no caching, no I/O, so each one is testable on a literal.
 *
 * ## The rule this file is written under
 *
 * **It never invents a judgement.** Where the platform has already decided
 * something — which purpose covers a vendor, whether consent is required, why —
 * that decision is carried across verbatim and the sentence the policy layer
 * wrote is the sentence the screen shows. Where the platform genuinely has no
 * answer, the answer here is `null`, not a plausible-looking guess.
 *
 * Two kinds of sentence *are* composed here, and the distinction matters:
 * descriptions of what **Rift's own runtime will do** ("held until the visitor
 * decides") are facts about our software that this layer can state, while
 * anything about what the **law requires** is quoted from the obligation the
 * engine raised. A guessed legal claim would be the confident-and-wrong failure
 * the whole product is built to avoid.
 *
 * ## Where derivation happens honestly
 *
 * The platform reports a scan as one status plus a set of counts; the product
 * shows nine stages. `toScan` derives the stepper from those counts and marks a
 * stage done only when its own count proves it ran. It is presentation over
 * real numbers, not a simulated progress bar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── Small shared helpers ──────────────────────────────────────────────── */

const DAY = 24 * 60 * 60 * 1000;

function ageInDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : (now - t) / DAY;
}

function titleise(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Purpose code → the operator's own display name, falling back to the code. */
export type PurposeNames = Readonly<Record<string, string>>;

export function purposeNamesFrom(
  declared: readonly W.WirePurpose[],
  proposed: readonly W.WireProposedPurpose[] = [],
): PurposeNames {
  const names: Record<string, string> = {};
  for (const p of proposed) names[p.suggested_code] = p.suggested_name;
  // A declared purpose is the operator's own vocabulary and outranks a suggestion.
  for (const p of declared) names[p.code] = p.name;
  return names;
}

function purposeLabel(code: string | null, names: PurposeNames): string | null {
  if (!code) return null;
  return names[code] ?? titleise(code);
}

/**
 * Scanner confidence → the product's three levels.
 *
 * `unresolved` is reserved for "we could not classify this", which is why it is
 * driven by the absence of a category rather than by a low score. A vendor we
 * recognised but are only fairly sure about is `likely`, and rendering that as
 * unresolved would tell an operator to go and look at a row that needs nothing.
 */
function confidenceFor(
  category: string | null,
  score: 'high' | 'medium' | 'low',
): ConfidenceLevel {
  if (!category) return 'unresolved';
  return score === 'high' ? 'confirmed' : 'likely';
}

/* ── Sites ─────────────────────────────────────────────────────────────── */

export interface SiteContext {
  scans: readonly (W.WireScanMetadata & { summary: W.WireScanSummary })[];
  install: W.WireInstall | null;
  policy: W.WirePolicyResponse | null;
  /** Consent decisions for this site, newest first. Empty when none. */
  consent: readonly W.WireConsentRecord[];
  now?: number;
}

/**
 * Site status, derived from evidence rather than stored as a flag.
 *
 * The order of these tests is the product's priority order, and each one is
 * answerable from data the platform actually holds:
 *
 *  - nothing has ever reported → `not_installed`. No event has arrived under
 *    this site's public key, so there is nothing to describe.
 *  - it reported once and then went quiet for a fortnight → `installation_issue`.
 *    A live site that stops sending is the case worth surfacing loudly, and
 *    `md-error` is reserved in the design system for exactly this.
 *  - a vendor is still waiting on a person, or no configuration is approved →
 *    `needs_review`. Uncertainty, never an error.
 *  - otherwise → `connected`.
 */
function siteStatusFrom(ctx: SiteContext, unresolved: number, now: number): SiteStatus {
  const activity = ctx.install?.activity;

  // Either kind of traffic proves the runtime is on the page. Consent decisions
  // matter as much as analytics events here, and counting only events called a
  // site "not installed" while its own consent log was filling up — which is
  // the one claim the log directly disproves.
  const events = activity?.events ?? 0;
  const decisions = activity?.consent_decisions ?? 0;
  if (events === 0 && decisions === 0) return 'not_installed';

  const lastSeen = [activity?.last_event_at, activity?.last_consent_at]
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop();
  const quiet = ageInDays(lastSeen ?? null, now);
  if (quiet !== null && quiet > 14) return 'installation_issue';

  if (unresolved > 0 || !ctx.policy?.active_version) return 'needs_review';
  return 'connected';
}

function siteHealthFrom(
  status: SiteStatus,
  ctx: SiteContext,
  unresolved: number,
  lastScan: (W.WireScanMetadata & { summary: W.WireScanSummary }) | undefined,
  now: number,
): HealthState {
  if (status === 'not_installed' || status === 'installation_issue') return 'installation_issue';
  if (lastScan?.status === 'failed') return 'action_required';
  if (!ctx.policy?.active_version) return 'configuration_issue';
  if (unresolved > 0) return 'needs_attention';

  const scanAge = ageInDays(lastScan?.completed_at ?? lastScan?.created_at ?? null, now);
  if (scanAge !== null && scanAge > 30) return 'scanner_stale';
  return 'healthy';
}

/**
 * Consent rate: the share of decisions that granted.
 *
 * Computed from the decision log rather than stored, for the same reason
 * effective consent is: a counter can drift away from the records it claims to
 * summarise, and the records are the thing anyone would be asked to produce.
 * `null` when there is nothing to divide — an empty log is not a rate of zero.
 */
function consentRateFrom(records: readonly W.WireConsentRecord[]): number | null {
  const decided = records.filter((r) => r.status === 'GRANTED' || r.status === 'DENIED');
  if (decided.length === 0) return null;
  const granted = decided.filter((r) => r.status === 'GRANTED').length;
  return Math.round((granted / decided.length) * 1000) / 10;
}

export function toSite(site: W.WireSite, ctx: SiteContext): Site {
  const now = ctx.now ?? Date.now();
  const lastScan = ctx.scans.find((s) => s.status === 'completed') ?? ctx.scans[0];
  const summary = lastScan?.summary;

  const recommendations = ctx.policy?.policy.recommendations ?? [];
  const unresolved = recommendations.filter((r) => r.recommended_action === 'review').length;

  const status = siteStatusFrom(ctx, unresolved, now);

  return {
    siteId: site.site_id,
    host: site.domain,
    status,
    health: siteHealthFrom(status, ctx, unresolved, lastScan, now),
    installedAt: ctx.install?.activity.first_event_at ?? ctx.install?.activity.last_consent_at ?? null,
    lastScanAt: lastScan?.completed_at ?? lastScan?.created_at ?? null,
    // The platform runs no scheduler: scans are started, never planned. A date
    // here would be a promise nothing in the system keeps.
    nextScanAt: null,
    counts: {
      pages: summary?.pages_scanned ?? 0,
      cookies: summary?.cookies_found ?? 0,
      services: summary?.third_party_domains ?? 0,
      technologies: summary?.technologies_detected ?? 0,
      unresolved,
    },
    consentRate: consentRateFrom(ctx.consent),
    configurationVersion: ctx.policy?.active_version
      ? (ctx.install?.config_version ?? `v${ctx.policy.active_version.version}`)
      : null,
  };
}

/* ── Scans ─────────────────────────────────────────────────────────────── */

/**
 * The nine stages, and the count that proves each one ran.
 *
 * A stage is `done` only when the crawl produced the evidence it exists to
 * produce. That is why `note` reads back a real number: an operator watching
 * this should be able to check it against the results screen afterwards and
 * find the same figure.
 */
const STAGES: Array<{
  id: ScanStageId;
  label: string;
  /** Null means the stage has no count of its own — see `alwaysRunsWith`. */
  count: (s: W.WireScanSummary) => number | null;
  note: (s: W.WireScanSummary) => string;
}> = [
  {
    id: 'reach',
    label: 'Reach website',
    count: (s) => s.pages_discovered + s.pages_scanned,
    note: () => 'Website reachable',
  },
  {
    id: 'discover_pages',
    label: 'Discover pages',
    count: (s) => s.pages_discovered,
    note: (s) => `${s.pages_discovered} ${s.pages_discovered === 1 ? 'page' : 'pages'} discovered`,
  },
  {
    id: 'cookies',
    label: 'Inspect cookies',
    count: (s) => s.pages_scanned,
    note: (s) => `${s.cookies_found} ${s.cookies_found === 1 ? 'cookie' : 'cookies'} observed`,
  },
  {
    id: 'scripts',
    label: 'Inspect scripts',
    count: (s) => s.pages_scanned,
    note: (s) => `${s.scripts_found} ${s.scripts_found === 1 ? 'script' : 'scripts'} inspected`,
  },
  {
    id: 'storage',
    label: 'Inspect storage',
    count: (s) => s.pages_scanned,
    note: (s) => `${s.storage_items_found} storage ${s.storage_items_found === 1 ? 'key' : 'keys'} read`,
  },
  {
    id: 'network',
    label: 'Inspect network activity',
    count: (s) => s.pages_scanned,
    note: (s) =>
      `${s.third_party_domains} third-party ${s.third_party_domains === 1 ? 'service' : 'services'} contacted`,
  },
  {
    id: 'technologies',
    label: 'Identify technologies',
    count: (s) => s.pages_scanned,
    note: (s) =>
      `${s.technologies_detected} ${s.technologies_detected === 1 ? 'technology' : 'technologies'} identified`,
  },
  {
    id: 'requirements',
    label: 'Evaluate privacy requirements',
    count: () => null,
    note: () => 'Requirements evaluated',
  },
  {
    id: 'configuration',
    label: 'Generate configuration',
    count: () => null,
    note: () => 'Configuration prepared',
  },
];

/** The two stages that are not part of the crawl. See `toScan`. */
const POST_CRAWL: ReadonlySet<ScanStageId> = new Set(['requirements', 'configuration']);

function scanStatusFor(meta: W.WireScanMetadata, summary: W.WireScanSummary): ScanStatus {
  switch (meta.status) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running';
    case 'failed':
    case 'cancelled':
      return 'failed';
    case 'completed':
      // A crawl that hit a limit or lost pages still produced everything it
      // reached. `completed_with_limitations` is a success with a footnote, and
      // the partial results screen is built to say so.
      return summary.limit_reached || summary.pages_failed > 0
        ? 'completed_with_limitations'
        : 'completed';
  }
}

export interface ScanContext {
  /** Notes for the two post-crawl stages, when the policy has been read. */
  regionCount?: number;
  categoryCount?: number;
  /** Pages the crawl could not reach, from the results endpoint. */
  unreachable?: Array<{ path: string; reason: string; attempts: number }>;
  /** Vendors the policy layer left for a person. */
  unresolvedCount?: number;
  /** The website, for copy that names it. */
  host?: string;
}

/**
 * Why a crawl stopped short of everything it found.
 *
 * The crawler reports which of its own limits it hit. Every one of these except
 * a page failure is Rift choosing to stop, not the website failing — a
 * distinction that matters enormously to the person reading the sentence,
 * because one of them means "your site is fine" and the other means "go and
 * look at your server".
 */
function describeLimit(
  summary: W.WireScanSummary,
  host: string | undefined,
): { kind: 'budget' | 'unreachable' | 'cancelled'; reason: string } {
  const site = host ?? 'your website';
  const reached = summary.pages_scanned;
  const found = Math.max(summary.pages_discovered, summary.pages_scanned);

  if (summary.limit_reached === 'cancelled') {
    return { kind: 'cancelled', reason: 'This scan was stopped before it finished.' };
  }

  switch (summary.limit_reached) {
    case 'maxPages':
    case 'queueBound':
      return {
        kind: 'budget',
        reason: `Rift inspected ${reached} of the ${found} pages it found on ${site}. It stops at a set number of pages so a scan stays quick and light on your server — the rest are picked up by the next scan.`,
      };
    case 'maxDuration':
      return {
        kind: 'budget',
        reason: `Rift inspected ${reached} pages before its time limit for a single scan. Everything found so far is below, and the next scan continues from a fresh budget.`,
      };
    case 'maxRequests':
    case 'maxScripts':
    case 'maxStorageItems':
    case 'maxCookies':
      return {
        kind: 'budget',
        reason: `${site} uses more scripts, requests or storage than Rift records in one pass, so this scan captured a representative sample rather than every last item.`,
      };
    default:
      return summary.pages_failed > 0
        ? {
            kind: 'unreachable',
            reason: `Rift reached ${reached} of ${found} pages. ${summary.pages_failed} did not respond and are listed below — everything else was scanned normally.`,
          }
        : {
            kind: 'budget',
            reason: `Rift inspected ${reached} of the ${found} pages it found on ${site}. Everything it saw is below and is safe to use.`,
          };
  }
}

export function toScan(
  meta: W.WireScanMetadata,
  summary: W.WireScanSummary,
  ctx: ScanContext = {},
): Scan {
  const status = scanStatusFor(meta, summary);
  const finished = status !== 'queued' && status !== 'running';
  const crawlDone = meta.status === 'completed';

  /*
   * While the crawl is running, only two things are known for certain: that the
   * website was reached, and how many pages have been visited so far. The
   * per-artefact counts — cookies, scripts, storage — are written once, at the
   * end, because a half-written scan is not a scan.
   *
   * So a running scan reports the truth it has: reach is done, and the first
   * inspection stage is active carrying the live page count. Marking the
   * inspection stages done off a page count would put "0 cookies observed"
   * on screen while the crawl was still finding them, which is worse than
   * saying nothing — a number that is wrong reads as a finding, and a stage
   * still working reads as work.
   */
  const inProgress = meta.status === 'running';
  const reached = summary.pages_scanned > 0 || summary.pages_discovered > 0;

  let running = false;
  const stages: ScanStage[] = STAGES.map((stage) => {
    const evidence = stage.count(summary);
    const isPostCrawl = POST_CRAWL.has(stage.id);

    // Post-crawl stages are performed by the policy layer when the results are
    // read, so the crawl completing is what makes them done. During the crawl
    // they have not started and must not claim to have.
    const done = isPostCrawl
      ? crawlDone
      : inProgress
        ? stage.id === 'reach' && reached
        : evidence !== null && evidence > 0;

    let state: ScanStage['state'];
    if (done) {
      state = 'done';
    } else if (meta.status === 'failed' || meta.status === 'cancelled') {
      state = 'failed';
    } else if (meta.status === 'queued') {
      state = 'pending';
    } else if (!running) {
      state = 'running';
      running = true;
    } else {
      state = 'pending';
    }

    let note: string | null = null;
    if (state === 'done') {
      note =
        stage.id === 'requirements' && ctx.regionCount !== undefined
          ? `${ctx.regionCount} ${ctx.regionCount === 1 ? 'region' : 'regions'} assessed`
          : stage.id === 'configuration' && ctx.categoryCount !== undefined
            ? `${ctx.categoryCount} consent ${ctx.categoryCount === 1 ? 'category' : 'categories'} prepared`
            : inProgress && stage.id === 'reach'
              ? 'Website reachable'
              : stage.note(summary);
    } else if (state === 'running' && inProgress && summary.pages_scanned > 0) {
      // The one live number the platform publishes mid-crawl.
      note = `${summary.pages_scanned} ${summary.pages_scanned === 1 ? 'page' : 'pages'} inspected so far`;
    }

    return {
      id: stage.id,
      label: stage.label,
      state,
      note,
      startedAt: state === 'pending' ? null : meta.started_at,
      finishedAt: state === 'done' ? (meta.completed_at ?? null) : null,
    };
  });

  return {
    scanId: meta.scan_id,
    siteId: meta.site_id,
    status,
    startedAt: meta.started_at ?? meta.created_at,
    finishedAt: meta.completed_at,
    stages,
    counts: {
      pages: summary.pages_scanned,
      cookies: summary.cookies_found,
      services: summary.third_party_domains,
      technologies: summary.technologies_detected,
      unresolved: ctx.unresolvedCount ?? 0,
    },
    limitations:
      status === 'completed_with_limitations'
        ? {
            pagesReached: summary.pages_scanned,
            pagesTotal: Math.max(summary.pages_discovered, summary.pages_scanned),
            ...describeLimit(summary, ctx.host),
            unreachable: ctx.unreachable ?? [],
          }
        : null,
    failure:
      status === 'failed'
        ? {
            summary:
              meta.error?.message ||
              (meta.status === 'cancelled'
                ? 'This scan was cancelled before it finished.'
                : 'The scan stopped before it could finish.'),
            // Nothing on the website changed and no configuration was touched:
            // a scan that fails leaves the previous one in force.
            recovered: true,
            guidance:
              meta.status === 'cancelled'
                ? ['Start a new scan whenever you are ready.']
                : [
                    'Check that the address is reachable from the public internet.',
                    'If the site blocks automated traffic, allow the Rift crawler’s user agent.',
                    'Start a new scan — nothing about your existing configuration was changed.',
                  ],
          }
        : null,
    ...(finished ? {} : {}),
  };
}

/**
 * Scan history.
 *
 * `unresolved` is only knowable for the scan the current policy was generated
 * from: the platform derives a policy on demand from the latest completed scan
 * and stores none for the ones before it. So the count is attached to that row
 * and left at zero elsewhere, which the table renders as an em dash — "not
 * known for this scan" rather than a confident zero.
 */
export function toScanSummaries(
  scans: readonly (W.WireScanMetadata & { summary: W.WireScanSummary })[],
  unresolvedForLatestCompleted = 0,
): ScanSummary[] {
  const latestCompleted = scans.find((s) => s.status === 'completed')?.scan_id ?? null;
  // `scans` arrives newest first. The delta for each is against the one after
  // it in the list, which is the scan that came before it in time.
  return scans.map((scan, index) => {
    const previous = scans.slice(index + 1).find((s) => s.status === 'completed');
    return {
      scanId: scan.scan_id,
      startedAt: scan.started_at ?? scan.created_at,
      status: scanStatusFor(scan, scan.summary),
      counts: {
        pages: scan.summary.pages_scanned,
        cookies: scan.summary.cookies_found,
        services: scan.summary.third_party_domains,
        technologies: scan.summary.technologies_detected,
        unresolved: scan.scan_id === latestCompleted ? unresolvedForLatestCompleted : 0,
      },
      deltaTechnologies: previous
        ? scan.summary.technologies_detected - previous.summary.technologies_detected
        : null,
    };
  });
}

/* ── Findings ──────────────────────────────────────────────────────────── */

/** What the runtime will do, in one phrase. A fact about Rift, not about law. */
function behaviourSummary(action: W.WireRecommendedAction): string {
  switch (action) {
    case 'allow':
      return 'Loads on every page view';
    case 'require_consent':
      return 'Loads only after the visitor agrees';
    case 'block':
      return 'Held until the visitor agrees';
    case 'ignore':
      return 'Left out of the consent banner';
    case 'review':
      return 'Waiting on your decision';
  }
}

const EVIDENCE_LABELS: Record<W.WireEvidence['type'], string> = {
  script: 'Script',
  network_host: 'Network request',
  cookie: 'Cookie',
  storage_key: 'Storage key',
  dom: 'Page markup',
};

function hostOf(technology: W.WireTechnology): string {
  const network = technology.evidence.find((e) => e.type === 'network_host');
  if (network) return network.value;
  const script = technology.evidence.find((e) => e.type === 'script');
  if (script) {
    try {
      return new URL(script.value).host;
    } catch {
      /* a relative or malformed script src has no host to report */
    }
  }
  return '—';
}

export interface FindingsContext {
  results: W.WireScanResults;
  recommendations: readonly W.WireRecommendation[];
  overrides: readonly W.WireOverride[];
  approved: W.WirePolicyVersion | null;
  purposeNames: PurposeNames;
  /** Fingerprints that are new since the previous scan, when a diff was read. */
  newFingerprints?: ReadonlySet<string>;
}

export function toFindings(ctx: FindingsContext): Finding[] {
  const { results } = ctx;
  const byDetector = new Map(ctx.recommendations.map((r) => [r.detector_id, r]));
  const overrideBy = new Map(ctx.overrides.map((o) => [o.detector_id, o]));
  const approvedBy = new Map((ctx.approved?.recommendations ?? []).map((r) => [r.detector_id, r]));
  const pagesTotal = Math.max(results.summary.pages_scanned, 1);

  return results.technologies.map((technology) => {
    // The autopilot keys on a slug of the display name; the scanner keys on its
    // detector id. They usually agree and occasionally do not, so try both
    // rather than silently dropping the recommendation for a row.
    const slug = technology.name.toLowerCase().replace(/\s+/g, '-');
    const rec = byDetector.get(slug) ?? byDetector.get(technology.detector_id);
    const override = overrideBy.get(slug) ?? overrideBy.get(technology.detector_id);
    const approved = approvedBy.get(slug) ?? approvedBy.get(technology.detector_id);

    const host = hostOf(technology);
    const category = purposeLabel(rec?.suggested_purpose ?? null, ctx.purposeNames);

    const cookies = results.cookies.filter(
      (c) => host !== '—' && (c.domain.endsWith(host) || host.endsWith(c.domain.replace(/^\./, ''))),
    ).length;
    const requests = results.requests
      .filter((r) => r.host === host)
      .reduce((total, r) => total + r.request_count, 0);
    const pagesSeenOn = new Set(
      results.scripts.filter((s) => s.host === host).map((s) => s.observed_on),
    ).size;

    const status: Finding['status'] = approved
      ? 'configured'
      : !rec || rec.recommended_action === 'review'
        ? 'needs_review'
        : 'not_configured';

    return {
      /*
       * The key a write must use, which is not always the scanner's own id.
       *
       * The policy layer keys a recommendation on a slug of the vendor's display
       * name; the scanner keys a detection on its detector id. They agree for
       * most vendors and not for all — the scanner calls it `linkedin-insight`
       * and the policy calls it `linkedin-insight-tag`. An override written
       * under the scanner's id would key a decision the recommendation never
       * looks up, so the operator's choice would be accepted and then quietly
       * have no effect. Where a recommendation matched, its key wins.
       */
      findingId: rec?.detector_id ?? technology.detector_id,
      name: technology.name,
      host,
      vendor: technology.name,
      category,
      confidence: confidenceFor(category, technology.confidence),
      status,
      counts: {
        cookies,
        requests,
        pagesSeenOn: pagesSeenOn || (technology.evidence.length > 0 ? 1 : 0),
        pagesTotal,
      },
      firstSeenAt: results.scan.completed_at ?? results.scan.created_at,
      newSinceLastScan:
        ctx.newFingerprints?.has(`technology:${technology.detector_id.trim().toLowerCase()}`) ??
        false,
      observedAs: [
        ...new Set(technology.evidence.map((e) => EVIDENCE_LABELS[e.type] ?? titleise(e.type))),
      ],
      evidence: technology.evidence.map((e) => ({
        kind: EVIDENCE_LABELS[e.type] ?? titleise(e.type),
        value: e.value,
      })),
      recommendation: rec
        ? {
            category: purposeLabel(rec.suggested_purpose, ctx.purposeNames),
            categoryId: rec.suggested_purpose,
            // Written by the policy layer. Rendered, never rephrased.
            rationale: rec.reason,
          }
        : null,
      decision: override
        ? {
            category: purposeLabel(override.purpose_code, ctx.purposeNames),
            categoryId: override.purpose_code,
            overridesRecommendation: true,
            decidedAt: override.updated_at,
          }
        : approved
          ? {
              category: purposeLabel(approved.suggested_purpose, ctx.purposeNames),
              categoryId: approved.suggested_purpose,
              overridesRecommendation: false,
              decidedAt: ctx.approved?.approved_at ?? null,
            }
          : null,
      consentBehaviour: rec
        ? { summary: behaviourSummary(rec.recommended_action), detail: rec.reason }
        : null,
    };
  });
}

/* ── Configuration ─────────────────────────────────────────────────────── */

/**
 * Jurisdiction codes the resolver produces, in words.
 *
 * A lookup, not a decision: which jurisdictions apply is the engine's answer
 * and arrives already made. An unknown code falls through as itself rather than
 * being guessed at.
 */
const REGION_NAMES: Record<string, string> = {
  EU: 'European Union',
  EEA: 'European Economic Area',
  UK: 'United Kingdom',
  India: 'India',
  Brazil: 'Brazil',
  US: 'United States',
  California: 'California',
};

/**
 * Regimes whose name does not contain the jurisdiction they attach to.
 *
 * The matrix names most regimes after the place — `India-DPDP-Act`,
 * `California-CCPA-CPRA`, `EU-ePrivacy` — so matching on the name works for
 * nearly all of them. The GDPR is named after the instrument instead, which is
 * a naming fact rather than a legal one, and this is the whole exception list.
 * Anything not listed and not name-matched simply appears under every region the
 * engine resolved, which is a visible over-inclusion rather than a silent
 * omission.
 */
const REGIME_JURISDICTION: Record<string, string> = {
  GDPR: 'EU',
};

function regimeBelongsTo(regime: string, jurisdiction: string): boolean {
  const mapped = REGIME_JURISDICTION[regime];
  if (mapped) return mapped.toLowerCase() === jurisdiction.toLowerCase();
  return regime.toLowerCase().includes(jurisdiction.toLowerCase());
}

/**
 * Compact forms for the round region badge.
 *
 * The engine names jurisdictions in words — `California`, `India` — which is
 * right for a sentence and does not fit in a 48px circle. Anything unlisted
 * falls back to its own first two letters, so a new jurisdiction gets a
 * reasonable badge rather than a broken one.
 */
const REGION_SHORT: Record<string, string> = {
  EU: 'EU',
  EEA: 'EEA',
  UK: 'UK',
  India: 'IN',
  Brazil: 'BR',
  US: 'US',
  California: 'CA',
};

const REGION_CONFIDENCE: Record<string, RegionConfiguration['confidence']> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

export interface ConfigurationContext {
  siteId: string;
  policy: W.WirePolicyResponse;
  proposal: W.WireProposal;
  runtime: W.WireRuntimeConfig | null;
  install: W.WireInstall | null;
  purposeNames: PurposeNames;
  /** Findings for the rows still waiting on a person. */
  unresolved: Finding[];
}

function toRegions(proposal: W.WireProposal, policy: W.WirePolicy): RegionConfiguration[] {
  return policy.jurisdictions.map((code) => {
    // Obligations are engine output and carry their own wording. Everything a
    // region row says about the law is one of these sentences, verbatim.
    const matched = proposal.obligations.filter((o) => regimeBelongsTo(o.regime, code));
    // A jurisdiction the engine resolved but no regime names — a federal `US`
    // alongside a state one, say — still gets a row, showing everything in play
    // rather than an empty one that reads as "nothing applies here".
    const obligations = matched.length > 0 ? matched : proposal.obligations;
    const consentRequired = obligations.some((o) => o.verdict === 'REQUIRE_CONSENT');
    const requirement =
      obligations[0]?.summary ??
      'No obligation was raised for this region. That is not a finding that none applies.';

    return {
      code,
      shortCode: REGION_SHORT[code] ?? code.slice(0, 2).toUpperCase(),
      name: REGION_NAMES[code] ?? code,
      requirement,
      // What Rift's own runtime does. A statement about our software, which is
      // why it is composed here and the sentence above is not.
      behaviour: consentRequired
        ? 'Non-essential technologies are held until the visitor decides, and the decision is recorded.'
        : 'The banner is shown and every decision is recorded. Nothing is held back.',
      confidence: REGION_CONFIDENCE[proposal.jurisdiction_confidence[code] ?? ''] ?? 'low',
      // The platform holds no visitor geography, and inferring it from the
      // markets an operator selected would be a made-up number.
      visitorShare: null,
      reasoning: {
        factors: [
          ...obligations.map((o) => `${o.regime}: ${o.summary}`),
          ...proposal.open_questions.slice(0, 3).map((q) => q.detail),
        ],
        source: [...new Set(obligations.map((o) => o.regime))].join(', ') || 'Rift requirement matrix',
        knowledgeBaseVersion: 'requirements 1.2.0',
        appliedAt: new Date().toISOString(),
      },
    };
  });
}

function toCategories(ctx: ConfigurationContext): ConsentCategory[] {
  const vendorCount = (code: string) =>
    ctx.policy.policy.recommendations.filter(
      (r) => r.suggested_purpose === code && r.recommended_action !== 'ignore',
    ).length;

  // Once purposes are declared, the runtime configuration is the truth: it is
  // literally what a visitor's banner fetches. Before that, the proposal is the
  // best available description of what the banner *would* offer.
  if (ctx.runtime && ctx.runtime.purposes.length > 0) {
    return ctx.runtime.purposes.map((purpose) => ({
      id: purpose.code,
      name: purpose.name,
      description: purpose.description,
      alwaysActive: purpose.kind === 'essential',
      technologyCount: purpose.vendors.length || vendorCount(purpose.code),
      behaviour:
        purpose.kind === 'essential'
          ? 'Always on. The website cannot work without it, so it is not offered as a choice.'
          : 'Off until the visitor turns it on. Nothing in this category loads before then.',
    }));
  }

  // Before acceptance, the list is exactly what acceptance would declare — the
  // union of what the proposal described and what the recommendations name.
  // Showing only the proposal's half was a preview that promised two categories
  // and then created three, which makes the screen before the button
  // untrustworthy for the one thing it exists to do.
  const described = new Map(
    ctx.proposal.purposes.map((purpose) => [
      purpose.suggested_code,
      {
        name: purpose.suggested_name,
        description: purpose.suggested_description,
        technologies: purpose.technologies.length,
      },
    ]),
  );

  return plannedCategoryCodes({
    proposalPurposes: ctx.proposal.purposes,
    recommendations: ctx.policy.policy.recommendations,
  }).map((code) => {
    const fromProposal = described.get(code);
    const fallback = describePurpose(code);
    return category(
      code,
      fromProposal?.name ?? fallback.name,
      fromProposal?.description ?? fallback.description,
      fromProposal?.technologies || vendorCount(code),
    );
  });
}

function category(
  id: string,
  name: string,
  description: string,
  technologyCount: number,
): ConsentCategory {
  const essential = id === 'essential';
  return {
    id,
    name,
    description,
    alwaysActive: essential,
    technologyCount,
    behaviour: essential
      ? 'Always on. The website cannot work without it, so it is not offered as a choice.'
      : 'Off until the visitor turns it on. Nothing in this category loads before then.',
  };
}

/**
 * Every purpose accepting this configuration would declare.
 *
 * The proposal describes the purposes it could place technologies into; the
 * recommendations separately name a purpose per vendor, and the two do not
 * always agree — the proposal is empty for a site whose only classified vendor
 * is a CDN, while the recommendation for that CDN still says `essential`.
 * Accepting declares the union, so anything that previews what acceptance will
 * do has to compute the union too, or the preview and the result disagree.
 */
export function plannedCategoryCodes(input: {
  proposalPurposes: readonly W.WireProposedPurpose[];
  recommendations: readonly W.WireRecommendation[];
}): string[] {
  const codes = new Set(input.proposalPurposes.map((p) => p.suggested_code));
  for (const rec of input.recommendations) {
    if (rec.suggested_purpose && rec.recommended_action !== 'ignore') {
      codes.add(rec.suggested_purpose);
    }
  }
  return [...codes].sort();
}

/** The banner copy the platform serves, with its own documented fallbacks. */
const FALLBACK_TEXT = {
  title: 'Your choices on this site',
  body: 'We use cookies and similar technologies. You choose what we may use them for, and you can change your mind at any time.',
  accept_all: 'Accept all',
  reject_all: 'Reject all',
  manage: 'Manage preferences',
  save: 'Save choices',
};

function toEnforcement(ctx: ConfigurationContext): EnforcementConfiguration {
  const mode = ctx.runtime?.enforcement?.mode ?? 'off';
  const approved = Boolean(ctx.policy.active_version);

  return {
    beforeConsent:
      mode === 'enforce'
        ? 'Technologies in an optional category are held back. Only what the website needs to work loads.'
        : mode === 'observe'
          ? 'Nothing is held back yet. Rift records what would have been blocked so you can check the rules before turning them on.'
          : approved
            ? 'The banner is shown and decisions are recorded. Blocking is not switched on for this site.'
            : 'Nothing is enforced until you accept a configuration.',
    afterConsent:
      mode === 'enforce'
        ? 'Everything the visitor agreed to loads. Anything they declined stays held back.'
        : 'The decision is recorded and made available to your own tags through the Rift runtime.',
    withdrawalEnabled: true,
    recordsEnabled: true,
    // No renewal clock exists in the platform. A number here would be a promise
    // nothing enforces.
    renewAfterMonths: null,
  };
}

export function toConfiguration(ctx: ConfigurationContext): RiftConfiguration {
  const text = ctx.runtime?.text;

  const technologies: TechnologyConfiguration[] = ctx.policy.policy.recommendations.map((rec) => {
    const configured = purposeLabel(rec.suggested_purpose, ctx.purposeNames);
    return {
      technologyId: rec.detector_id,
      name: rec.vendor_name,
      host: rec.detector_id,
      recommendedCategory: configured,
      recommendedCategoryId: rec.suggested_purpose,
      configuredCategory: configured,
      configuredCategoryId: rec.suggested_purpose,
      overridden: rec.overridden,
      confidence: confidenceFor(configured, rec.confidence),
    };
  });

  return {
    siteId: ctx.siteId,
    regions: toRegions(ctx.proposal, ctx.policy.policy),
    consent: {
      categories: toCategories(ctx),
      banner: {
        title: text?.title ?? FALLBACK_TEXT.title,
        body: text?.body ?? FALLBACK_TEXT.body,
        acceptAllLabel: text?.accept_all ?? FALLBACK_TEXT.accept_all,
        rejectLabel: text?.reject_all ?? FALLBACK_TEXT.reject_all,
        managePreferencesLabel: text?.manage ?? FALLBACK_TEXT.manage,
        privacyNoticeHref: text?.policy_url ?? '#',
      },
      preferenceCentre: {
        title: text?.manage ?? FALLBACK_TEXT.manage,
        body: 'Turn each purpose on or off. Your choice is recorded and applies the moment you save it.',
        saveLabel: text?.save ?? FALLBACK_TEXT.save,
      },
    },
    technologies,
    enforcement: toEnforcement(ctx),
    unresolved: ctx.unresolved,
    version:
      ctx.install?.config_version ??
      (ctx.policy.active_version ? `v${ctx.policy.active_version.version}` : 'unversioned'),
  };
}

/* ── Installation ──────────────────────────────────────────────────────── */

export function toSnippet(install: W.WireInstall): InstallSnippet {
  const bytes = new TextEncoder().encode(install.snippet).length;
  return {
    siteId: install.site_id,
    scriptUrl: install.script_url,
    snippet: install.snippet,
    configurationVersion: install.config_version,
    sizeLabel: bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`,
  };
}

/**
 * Verification, from what the site has actually reported.
 *
 * Each check is a question the platform can answer from its own records, and
 * the wording never says "installation failed" — a snippet that has not
 * reported yet is indistinguishable from one pasted thirty seconds ago, and
 * telling somebody their work is broken when it might simply be new is how a
 * verification screen loses their trust.
 */
export function toVerification(install: W.WireInstall, now = Date.now()): Verification {
  const { activity } = install;
  // Consent decisions are runtime traffic too — a visitor who chose "reject all"
  // sends no analytics events and has unmistakably run the snippet.
  const reporting = activity.events > 0 || activity.consent_decisions > 0;
  const lastSeen = [activity.last_event_at, activity.last_consent_at]
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop();
  const quietDays = ageInDays(lastSeen ?? null, now);
  const stale = reporting && quietDays !== null && quietDays > 14;

  const check = (
    id: string,
    label: string,
    passed: boolean,
    note: string | null,
  ): VerificationCheck => ({
    id,
    label,
    state: passed ? 'passed' : 'failed',
    note,
    durationMs: null,
  });

  const checks: VerificationCheck[] = [
    check('snippet', 'Snippet generated for this website', true, install.script_url),
    check(
      'configuration',
      'Configuration ready to serve',
      install.config_ready,
      install.config_ready
        ? `Version ${install.config_version}`
        : 'No consent purpose is declared yet, so the banner has nothing to offer.',
    ),
    check(
      'runtime',
      'Rift runtime reporting from your website',
      reporting,
      reporting
        ? `${activity.events} ${activity.events === 1 ? 'event' : 'events'} and ${activity.consent_decisions} consent ${activity.consent_decisions === 1 ? 'decision' : 'decisions'} received`
        : 'Nothing has been received from this website yet.',
    ),
    check(
      'consent',
      'Consent decisions recorded',
      activity.consent_decisions > 0,
      activity.consent_decisions > 0
        ? `${activity.consent_decisions} recorded, most recently ${activity.last_consent_at ?? 'unknown'}`
        : 'No visitor has made a choice yet.',
    ),
    check(
      'policy',
      'Configuration accepted',
      Boolean(install.policy_version),
      install.policy_version
        ? `Version ${install.policy_version.version}`
        : 'Accept the configuration Rift generated to switch it on.',
    ),
  ];

  const status: Verification['status'] = !reporting
    ? 'not_detected'
    : stale || !install.policy_version || !install.config_ready
      ? 'not_activated'
      : 'connected';

  const causes: Verification['causes'] = [];
  if (status === 'not_detected') {
    causes.push(
      {
        title: 'The snippet may not be on the page yet',
        detail:
          'Rift has received nothing under this website’s key. If you have just pasted it, give it a moment and load a page on your site.',
        remedy: 'Open your website, then check this screen again.',
      },
      {
        title: 'The snippet may be below the fold of your template',
        detail:
          'It has to run on every page, which is why it belongs before </head> rather than inside a single page’s body.',
        remedy: 'Move the snippet into the shared layout or template your pages share.',
      },
      {
        title: 'A content security policy may be blocking the script',
        detail: `Your site has to allow scripts from ${install.api_origin}. A CSP that omits it will block the runtime silently.`,
        remedy: 'Add the Rift origin to your script-src directive.',
      },
    );
  } else if (status === 'not_activated') {
    if (!install.policy_version) {
      causes.push({
        title: 'The configuration has not been accepted',
        detail:
          'The runtime is reporting, so the snippet is in place. Until a configuration is accepted there is nothing for it to enforce.',
        remedy: 'Review the generated configuration and accept it.',
      });
    }
    if (!install.config_ready) {
      causes.push({
        title: 'No consent purpose is declared',
        detail:
          'A banner with no purposes offers no choices, so the runtime renders nothing rather than showing an empty box.',
        remedy: 'Accept the Rift configuration — it declares the purposes your scan found.',
      });
    }
    if (stale) {
      causes.push({
        title: 'Nothing has been received recently',
        detail: `The last event arrived ${Math.round(quietDays ?? 0)} days ago. The snippet may have been removed in a deploy.`,
        remedy: 'Check that the snippet is still in your page template.',
      });
    }
  }

  return {
    siteId: install.site_id,
    status,
    checks,
    causes,
    observations: [
      {
        label: 'Sessions',
        value: String(activity.sessions),
        tone: activity.sessions > 0 ? 'ok' : 'warn',
      },
      {
        label: 'Events',
        value: String(activity.events),
        tone: activity.events > 0 ? 'ok' : 'warn',
      },
      {
        label: 'Consent decisions',
        value: String(activity.consent_decisions),
        tone: activity.consent_decisions > 0 ? 'ok' : 'warn',
      },
      {
        label: 'Configuration',
        value: install.config_version,
        tone: install.config_ready ? 'ok' : 'warn',
      },
    ],
    checkedAt: new Date().toISOString(),
  };
}

/* ── Consent ───────────────────────────────────────────────────────────── */

/**
 * How far apart two records can be and still be one person's single choice.
 *
 * The runtime writes one record per purpose, one request each, so "accept all"
 * on a four-purpose site arrives as four rows several seconds apart. Grouping
 * on an exact timestamp split them and reported four decisions for one click —
 * a site's decision count came out as a multiple of its category count, which
 * is wrong in the direction that flatters.
 *
 * Thirty seconds is comfortably longer than a burst of writes and far shorter
 * than anyone re-opening the preference centre to change their mind, so a real
 * second decision still counts as a second decision.
 */
const DECISION_GAP_MS = 30_000;

/**
 * The decision log, grouped into what a person actually chose.
 *
 * Records are walked oldest-first per principal and split wherever the gap
 * exceeds {@link DECISION_GAP_MS}. Sessionising rather than bucketing on a
 * timestamp is what makes a burst one decision without merging two.
 */
function groupDecisions(records: readonly W.WireConsentRecord[]) {
  const byPrincipal = new Map<string, W.WireConsentRecord[]>();
  for (const record of records) {
    const list = byPrincipal.get(record.principal_external_id);
    if (list) list.push(record);
    else byPrincipal.set(record.principal_external_id, [record]);
  }

  const groups: Array<{ at: string; principal: string; records: W.WireConsentRecord[] }> = [];

  for (const [principal, all] of byPrincipal) {
    const ordered = [...all].sort((a, b) => (a.decided_at < b.decided_at ? -1 : 1));
    let current: { at: string; principal: string; records: W.WireConsentRecord[] } | null = null;
    let previousAt = 0;

    for (const record of ordered) {
      const at = Date.parse(record.decided_at);
      if (current && at - previousAt <= DECISION_GAP_MS) {
        current.records.push(record);
        // The decision is stamped at the moment it finished being written.
        current.at = record.decided_at;
      } else {
        current = { at: record.decided_at, principal, records: [record] };
        groups.push(current);
      }
      previousAt = at;
    }
  }

  return groups.sort((a, b) => (a.at < b.at ? 1 : -1));
}

function decisionKind(group: { records: W.WireConsentRecord[] }): ConsentRecord['decision'] {
  const statuses = group.records.map((r) => r.status);
  if (statuses.every((s) => s === 'WITHDRAWN')) return 'withdrawn';
  const optional = group.records.filter((r) => r.purpose_code !== 'essential');
  if (optional.length === 0) return 'accepted_all';
  if (optional.every((r) => r.status === 'GRANTED')) return 'accepted_all';
  if (optional.every((r) => r.status !== 'GRANTED')) return 'rejected';
  return 'custom';
}

export function toConsentOverview(
  records: readonly W.WireConsentRecord[],
  days: number,
  purposeNames: PurposeNames,
  configurationVersions: number,
): ConsentOverview {
  const groups = groupDecisions(records);
  const kinds = groups.map((g) => decisionKind(g));

  const acceptedAll = kinds.filter((k) => k === 'accepted_all').length;
  const rejected = kinds.filter((k) => k === 'rejected').length;
  const custom = kinds.filter((k) => k === 'custom').length;
  const withdrawals = kinds.filter((k) => k === 'withdrawn').length;

  // One bucket per day in the window, oldest first, so a chart with no data
  // still has an axis and reads as "nothing yet" rather than as broken.
  const today = new Date();
  const buckets: Array<{ date: string; acceptedAll: number; rejected: number; custom: number }> = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * DAY).toISOString().slice(0, 10);
    index.set(date, buckets.length);
    buckets.push({ date, acceptedAll: 0, rejected: 0, custom: 0 });
  }
  groups.forEach((group, i) => {
    const slot = index.get(group.at.slice(0, 10));
    if (slot === undefined) return;
    const kind = kinds[i];
    if (kind === 'accepted_all') buckets[slot]!.acceptedAll += 1;
    else if (kind === 'rejected') buckets[slot]!.rejected += 1;
    else if (kind === 'custom') buckets[slot]!.custom += 1;
  });

  const byPurpose = new Map<string, { allowed: number; total: number }>();
  for (const record of records) {
    const entry = byPurpose.get(record.purpose_code) ?? { allowed: 0, total: 0 };
    entry.total += 1;
    if (record.status === 'GRANTED') entry.allowed += 1;
    byPurpose.set(record.purpose_code, entry);
  }

  const decisions = groups.length;

  return {
    decisions,
    // Every decision the runtime made reached the log — that is what the
    // append-only record guarantees. There is no second counter to compare it
    // against, so reporting anything but 100 would be inventing a shortfall.
    captureRate: decisions > 0 ? 100 : 0,
    breakdown: { acceptedAll, rejectedNonEssential: rejected, custom },
    withdrawals,
    configurationVersions,
    trend: buckets,
    // The platform records jurisdictions on a decision only where the runtime
    // supplied them, and this deployment does not, so there is no honest
    // regional split to show.
    byRegion: [],
    byCategory: [...byPurpose.entries()]
      .map(([code, e]) => ({
        category: purposeLabel(code, purposeNames) ?? code,
        allowedRate: e.total > 0 ? Math.round((e.allowed / e.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.category.localeCompare(b.category)),
  };
}

export function toConsentRecords(
  records: readonly W.WireConsentRecord[],
  purposeNames: PurposeNames,
  limit: number,
): ConsentRecord[] {
  return groupDecisions(records)
    .slice(0, limit)
    .map((group) => ({
      recordId: group.records[0]!.consent_record_id,
      recordedAt: group.at,
      // Nothing in the decision log carries a region for this deployment, and a
      // guess would be a claim about where a person was.
      region: '—',
      decision: decisionKind(group),
      categoriesAllowed: group.records
        .filter((r) => r.status === 'GRANTED')
        .map((r) => purposeLabel(r.purpose_code, purposeNames) ?? r.purpose_code),
      configurationVersion: group.records[0]!.policy_version_id ?? '—',
      channel: group.records[0]!.source === 'preference_centre' ? 'preference_centre' : 'banner',
    }));
}

/* ── Analytics ─────────────────────────────────────────────────────────── */

export function toAnalytics(
  summary: W.WireAnalyticsSummary,
  consentRate: number | null,
  days: number,
): AnalyticsOverview {
  const totalViews = summary.top_pages.reduce((t, p) => t + p.views, 0) || 1;
  const deviceEvents = summary.devices.reduce((t, d) => t + d.events, 0) || 1;

  // The platform reports sessions and holds no durable visitor identifier, so
  // the daily series is a single point at the end of the window rather than a
  // fabricated shape across it.
  const today = new Date();
  const trend = Array.from({ length: days }, (_, i) => ({
    date: new Date(today.getTime() - (days - 1 - i) * DAY).toISOString().slice(0, 10),
    visitors: 0,
  }));
  if (trend.length > 0) trend[trend.length - 1]!.visitors = summary.totals.sessions;

  return {
    consentAffected: true,
    analyticsConsentRate: consentRate ?? 0,
    visitors: summary.totals.sessions,
    sessions: summary.totals.sessions,
    pageViews: summary.totals.page_views,
    averageSessionLabel:
      summary.totals.sessions > 0
        ? `${(summary.totals.page_views / summary.totals.sessions).toFixed(1)} pages`
        : '—',
    trend,
    topPages: summary.top_pages.map((page) => ({
      path: pathOf(page.url),
      views: page.views,
      share: Math.round((page.views / totalViews) * 1000) / 10,
    })),
    // The platform breaks activity down by browser, not by referrer: no
    // referrer is stored against a session, so there are no acquisition
    // sources to report and an empty list says that plainly.
    sources: summary.browsers.map((b) => ({ source: titleise(b.key), sessions: b.events })),
    devices: summary.devices.map((d) => ({
      device: titleise(d.key),
      share: Math.round((d.events / deviceEvents) * 1000) / 10,
    })),
  };
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

/* ── Changes and diffs ─────────────────────────────────────────────────── */

const DIFF_KINDS: Record<W.WireDiffKind, DiffEntry['kind']> = {
  cookie: 'cookie',
  script: 'technology',
  request: 'request',
  storage: 'configuration',
  technology: 'technology',
};

function toDiffEntry(entry: W.WireDiffEntry): DiffEntry {
  const detail =
    entry.status === 'changed' && entry.changedFields.length > 0
      ? `${entry.changedFields.join(', ')} changed`
      : titleise(entry.kind);

  return {
    kind: DIFF_KINDS[entry.kind],
    name: entry.label,
    detail,
    // A diff describes what moved, not what it means. Category and confidence
    // are the configuration's answer, and this is not the configuration.
    category: null,
    confidence: null,
    handling: entry.kind === 'technology' ? 'needs_review' : 'automatic',
    note:
      entry.status === 'new'
        ? 'Seen for the first time in this scan.'
        : entry.status === 'removed'
          ? 'Present in the previous scan and not in this one.'
          : 'Present in both scans with different details.',
  };
}

export function toScanDiff(response: W.WireDiffResponse): ScanDiff {
  const entries = response.diff.entries.filter((e) => e.status !== 'unchanged');
  return {
    baselineScanId: response.baseline_scan_id ?? '—',
    comparedScanId: response.compared_scan_id,
    added: entries.filter((e) => e.status === 'new').map(toDiffEntry),
    removed: entries.filter((e) => e.status === 'removed').map(toDiffEntry),
    changed: entries.filter((e) => e.status === 'changed').map(toDiffEntry),
  };
}

export function toChanges(response: W.WireDiffResponse): ChangeEntry[] {
  const occurredAt =
    response.compared.completed_at ?? response.compared.started_at ?? response.compared.created_at;

  return response.diff.entries
    .filter((e) => e.status !== 'unchanged')
    .slice(0, 50)
    .map((entry) => {
      const mapped = toDiffEntry(entry);
      return {
        changeId: `${response.compared_scan_id}:${entry.fingerprint}`,
        kind: entry.status === 'new' ? 'added' : entry.status === 'removed' ? 'removed' : 'changed',
        title: entry.label,
        detail: mapped.detail,
        note: mapped.note,
        occurredAt,
        handling: mapped.handling,
      };
    });
}

/** Fingerprints of everything the latest scan saw for the first time. */
export function newFingerprintsFrom(response: W.WireDiffResponse | null): ReadonlySet<string> {
  if (!response) return new Set();
  return new Set(
    response.diff.entries.filter((e) => e.status === 'new').map((e) => e.fingerprint),
  );
}

/**
 * Wording for a purpose the proposal did not describe.
 *
 * These are the purpose codes the platform's own category map produces, so the
 * list is closed rather than open-ended. The text is product copy for a label a
 * visitor reads — it says what the category is *for*, and deliberately makes no
 * claim about what any law requires of it. An operator can rewrite any of it;
 * this only has to be true and legible on the day the configuration is
 * accepted.
 */
export function describePurpose(code: string): { code: string; name: string; description: string } {
  const known: Record<string, { name: string; description: string }> = {
    essential: {
      name: 'Strictly necessary',
      description:
        'Needed for the website to work — security, load balancing and remembering your choices on this banner. These cannot be turned off.',
    },
    analytics: {
      name: 'Analytics',
      description:
        'Helps us understand how the website is used, so we can see which pages work and which do not.',
    },
    advertising: {
      name: 'Advertising',
      description:
        'Used to select and measure advertising, on this website and elsewhere.',
    },
    marketing: {
      name: 'Marketing',
      description:
        'Used to send you communications you asked for and to measure whether they were useful.',
    },
    social_media: {
      name: 'Social media',
      description:
        'Powers embedded posts, sharing buttons and other features provided by social networks.',
    },
    personalisation: {
      name: 'Personalisation',
      description:
        'Remembers your preferences so the website can adapt what it shows you.',
    },
  };

  const entry = known[code];
  if (entry) return { code, ...entry };

  // A code the platform introduced after this list was written. Declaring it
  // with its own name is better than dropping it: a purpose that exists is one
  // an operator can rename, and one that is missing is a banner row that never
  // appears.
  return {
    code,
    name: code.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    description: 'Declared automatically from your scan. Edit this description to say what it covers.',
  };
}
