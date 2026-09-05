import 'server-only';
import { cache } from 'react';
import { riftFetch, USE_FIXTURES } from './client';
import * as fx from './fixtures';
import * as adapt from './adapters';
import { describePurpose } from './adapters';
import type * as W from './backend';
import type {
  AnalyticsOverview, ChangeEntry, ConsentOverview, ConsentRecord, Finding, InstallSnippet,
  RiftConfiguration, Scan, ScanDiff, ScanSummary, Site, Verification,
} from './types';

/**
 * Every read and write the dashboard makes, in one file.
 *
 * Each function does the same three things: serve a fixture when there is no
 * backend, otherwise gather what the platform API can tell it, then hand the
 * responses to a pure adapter. The gathering lives here because it is I/O and
 * caching; the meaning lives in `adapters.ts` because it is a decision. No
 * component ever sees a platform response.
 *
 * ## Why several calls per screen
 *
 * The platform is a set of narrow, single-purpose endpoints — a scan knows
 * nothing about a policy, and a policy knows nothing about whether the runtime
 * is installed. Composing them is exactly the job of a BFF, and doing it here
 * rather than adding a wide dashboard-shaped endpoint keeps the platform API
 * something an external integrator can use without inheriting our screens.
 * Calls that do not depend on each other are issued together, and everything is
 * tagged so a mutation invalidates precisely the reads it affects.
 *
 * ## Base path
 *
 * The platform serves its public surface under `/api/v1`. That prefix lives
 * here, in one constant, rather than being folded into `RIFT_API_URL` — so the
 * environment variable stays an origin, which is what an operator expects to
 * put in it.
 */

const V1 = '/api/v1';

const tag = {
  sites: 'sites',
  site: (id: string) => `site:${id}`,
  scan: (id: string) => `scan:${id}`,
  config: (id: string) => `config:${id}`,
};

/**
 * Writes, and anything that must never be a moment stale.
 *
 * Everything else gets a short revalidate window instead, for a reason worth
 * being explicit about: a dashboard screen is composed of several platform
 * calls, and one of them — generating the policy — evaluates the whole
 * requirement matrix against a scan's observations and takes seconds. Reading it
 * with no cache at all meant every screen paid that cost again, several times
 * over, and the app spent its time waiting on answers that had not changed.
 *
 * The windows below are short enough that nothing on screen is meaningfully old,
 * and every mutation calls `revalidateTag` on the tags its reads were fetched
 * under — so an accepted configuration or a saved override is visible
 * immediately rather than after a timer. Staleness is bounded by the tag, not by
 * the number of seconds.
 */
const LIVE = { revalidate: false as const };

/** Seconds. Tuned to how fast each thing actually changes. */
const WINDOW = {
  sites: 5,
  scans: 5,
  install: 10,
  /** Deterministic from a scan, the overrides and the markets. Also the slowest. */
  policy: 30,
  purposes: 30,
  consent: 15,
  /** Two finished scans do not change; only which scans are compared does. */
  diff: 120,
};

/* ── Small gathering helpers ───────────────────────────────────────
 *
 * Each is wrapped in React's `cache`, which deduplicates it within a single
 * render. That matters more than it looks: the shell reads the site list, the
 * current-site resolver reads it again, and the screen itself reads it a third
 * time. Without this they were three round trips — and, for the per-site
 * gather, three fans of them.
 */

const listWireSites = cache(async (): Promise<W.WireSite[]> => {
  const body = await riftFetch<{ sites: W.WireSite[] }>(`${V1}/sites`, {
    tags: [tag.sites],
    revalidate: WINDOW.sites,
  });
  return body.sites;
});

const getWireSite = cache(
  async (siteId: string): Promise<W.WireSite> =>
    riftFetch<W.WireSite>(`${V1}/sites/${siteId}`, {
      tags: [tag.site(siteId)],
      revalidate: WINDOW.sites,
    }),
);

const listWireScans = cache(async (siteId: string) => {
  const body = await riftFetch<W.WireScanListResponse>(`${V1}/sites/${siteId}/scans`, {
    tags: [tag.site(siteId)],
    revalidate: WINDOW.scans,
  });
  return body.scans;
});

const getInstall = cache(async (siteId: string): Promise<W.WireInstall> => {
  const body = await riftFetch<W.WireInstallResponse>(`${V1}/sites/${siteId}/install`, {
    tags: [tag.site(siteId)],
    revalidate: WINDOW.install,
  });
  return body.install;
});

/**
 * The generated policy, and the version in force.
 *
 * `market` is how an operator tells the engine which jurisdictions to consider.
 * Nothing geolocates a visitor to produce it — a target market is a decision the
 * business made and can evidence, which is both the strongest signal available
 * and the one that needs no personal data at all. Where the operator has stated
 * none, the engine resolves nothing and says so rather than guessing, and the
 * privacy screen renders that honestly.
 */
const getPolicy = cache(
  async (siteId: string): Promise<W.WirePolicyResponse> =>
    riftFetch<W.WirePolicyResponse>(`${V1}/sites/${siteId}/consent-policy${marketQuery()}`, {
      tags: [tag.config(siteId)],
      revalidate: WINDOW.policy,
    }),
);

const getProposal = cache(async (siteId: string): Promise<W.WireProposal> => {
  const body = await riftFetch<W.WireProposalResponse>(
    `${V1}/sites/${siteId}/consent-proposal${marketQuery()}`,
    { tags: [tag.config(siteId)], revalidate: WINDOW.policy },
  );
  return body.proposal;
});

/**
 * Markets the operator says they serve, from the environment.
 *
 * A per-site setting is where this belongs, and the platform has no field for
 * it yet. Until it does, one deployment-wide list is honest about what it is:
 * an assertion the operator made, not something inferred from a visitor.
 */
function marketQuery(): string {
  const markets = (process.env.RIFT_MARKETS ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (markets.length === 0) return '';
  return `?${markets.map((m) => `market=${encodeURIComponent(m)}`).join('&')}`;
}

const listOverrides = cache(async (siteId: string): Promise<W.WireOverride[]> => {
  const body = await riftFetch<W.WireOverrideListResponse>(
    `${V1}/sites/${siteId}/consent-policy/overrides`,
    { tags: [tag.config(siteId)], revalidate: WINDOW.policy },
  );
  return body.overrides;
});

const listPurposes = cache(async (): Promise<W.WirePurpose[]> => {
  const body = await riftFetch<{ purposes: W.WirePurpose[] }>(`${V1}/purposes`, {
    tags: [tag.sites],
    revalidate: WINDOW.purposes,
  });
  return body.purposes;
});

/**
 * The configuration a visitor's banner actually fetches.
 *
 * Read on the browser plane with the site's own public key, which is why the
 * Authorization header is overridden here: the management secret is refused by
 * this endpoint on purpose, so that one credential can never be used to probe
 * the other's surface. Nothing secret travels — a public key ships in page
 * source by design.
 */
const getRuntimeConfig = cache(async (publicKey: string): Promise<W.WireRuntimeConfig | null> => {
  try {
    return await riftFetch<W.WireRuntimeConfig>(`${V1}/consent/config`, {
      headers: { Authorization: `Bearer ${publicKey}` },
      revalidate: WINDOW.install,
    });
  } catch {
    // An inactive site, or one whose key has been rotated, has no runtime
    // configuration to read. That is a legible state, not a failed screen.
    return null;
  }
});

const listConsentFor = cache(async (siteId: string, limit = 1000): Promise<W.WireConsentRecord[]> => {
  const body = await riftFetch<W.WireConsentHistoryResponse>(
    `${V1}/consent/history?site_id=${encodeURIComponent(siteId)}&limit=${limit}`,
    { tags: [tag.site(siteId)], revalidate: WINDOW.consent },
  );
  return body.records;
});

const getDiff = cache(
  async (scanId: string, baselineScanId?: string): Promise<W.WireDiffResponse | null> => {
    try {
      const query = baselineScanId ? `?baseline=${encodeURIComponent(baselineScanId)}` : '';
      return await riftFetch<W.WireDiffResponse>(`${V1}/scans/${scanId}/diff${query}`, {
        tags: [tag.scan(scanId)],
        revalidate: WINDOW.diff,
      });
    } catch {
      // A first scan has nothing to compare against. "No previous scan" and
      // "comparison failed" must not look the same to a caller, so this returns
      // null and every caller renders the empty case rather than an error.
      return null;
    }
  },
);

/** The most recent scan that finished, or the most recent of any state. */
function latestScan(scans: readonly (W.WireScanMetadata & { summary: W.WireScanSummary })[]) {
  return scans.find((s) => s.status === 'completed') ?? scans[0];
}

const siteContext = cache(async (siteId: string): Promise<adapt.SiteContext> => {
  const [scans, install, policy, consent] = await Promise.all([
    listWireScans(siteId).catch(() => []),
    getInstall(siteId).catch(() => null),
    getPolicy(siteId).catch(() => null),
    listConsentFor(siteId).catch(() => []),
  ]);
  return { scans, install, policy, consent };
});

/* ── Who this dashboard is signed in as ────────────────────────────────────
 *
 * The platform has no user model: a credential identifies an organisation, and
 * that is the whole of the identity available. Rendering a person's name and
 * avatar over it would invent an account that does not exist, so the shell
 * shows the organisation and says plainly that it is a credential.
 */

export interface Organisation {
  organisationId: string;
  name: string;
  slug: string;
}

export const getOrganisation = cache(async (): Promise<Organisation | null> => {
  if (USE_FIXTURES) return { organisationId: 'org_fixture', name: 'Northwind Retail', slug: 'northwind' };

  try {
    const body = await riftFetch<{ organisation_id: string; name: string; slug: string }>(
      `${V1}/organisation`,
      { tags: [tag.sites], revalidate: WINDOW.purposes },
    );
    return { organisationId: body.organisation_id, name: body.name, slug: body.slug };
  } catch {
    // The shell must render even when this one call fails; it is a label.
    return null;
  }
});

/* ── Sites ─────────────────────────────────────────────────────────────── */

export async function listSites(): Promise<Site[]> {
  if (USE_FIXTURES) return fx.SITES;

  const sites = await listWireSites();
  return Promise.all(
    sites.map(async (site) => adapt.toSite(site, await siteContext(site.site_id))),
  );
}

export async function getSite(siteId: string): Promise<Site> {
  if (USE_FIXTURES) return fx.SITES.find((s) => s.siteId === siteId) ?? fx.SITES[0]!;

  const [site, ctx] = await Promise.all([getWireSite(siteId), siteContext(siteId)]);
  return adapt.toSite(site, ctx);
}

/**
 * A website URL becomes a site and a scan, in that order.
 *
 * The operator typed an address; everything else about the site record is
 * derived rather than asked for, because the first screen of the journey is one
 * field and a button. Starting the scan here rather than on the next screen is
 * the same decision: they asked for their website to be looked at, not for a
 * record to exist.
 */
/**
 * Scans a website Rift already knows about.
 *
 * Distinct from `createSite`, which is for a website nobody has entered yet.
 * The starting point is the site's own address: the crawler follows links from
 * wherever it begins, so re-scanning from the root is the comparable run — a
 * scan that started somewhere else would produce a diff full of differences
 * that are really just a different starting point.
 */
export async function rescanSite(siteId: string): Promise<{ scanId: string }> {
  if (USE_FIXTURES) return { scanId: 'scn_8842' };

  const site = await riftFetch<W.WireSite>(`${V1}/sites/${siteId}`, { ...LIVE });
  const scan = await riftFetch<W.WireCreateScanResponse>(`${V1}/sites/${siteId}/scans`, {
    method: 'POST',
    body: { start_url: `https://${site.domain}` },
    ...LIVE,
  });

  return { scanId: scan.scan.scan_id };
}

export async function createSite(url: string): Promise<{ siteId: string; scanId: string }> {
  if (USE_FIXTURES) return { siteId: 'site_9fb2c41a', scanId: 'scn_8841' };

  const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);

  const site = await riftFetch<W.WireSite>(`${V1}/sites`, {
    method: 'POST',
    body: { name: parsed.hostname, domain: parsed.hostname },
    ...LIVE,
  });

  const scan = await riftFetch<W.WireCreateScanResponse>(`${V1}/sites/${site.site_id}/scans`, {
    method: 'POST',
    body: { start_url: parsed.toString() },
    ...LIVE,
  });

  return { siteId: site.site_id, scanId: scan.scan.scan_id };
}

/* ── Scans ─────────────────────────────────────────────────────────────── */

export async function getScan(scanId: string): Promise<Scan> {
  if (USE_FIXTURES) return scanId === 'scn_8455' ? fx.SCAN_PARTIAL : fx.scanAtStage(9, scanId);

  const status = await riftFetch<W.WireScanStatusResponse>(`${V1}/scans/${scanId}`, {
    tags: [tag.scan(scanId)],
    ...LIVE,
  });

  if (status.scan.status !== 'completed') {
    return adapt.toScan(status.scan, status.summary);
  }

  // Only once the crawl is done is there anything to say about the two
  // post-crawl stages, or any page-level failure to list. Fetching either of
  // these on every poll of a running scan would be paying for an answer that
  // does not exist yet.
  const [results, policy, proposal, site] = await Promise.all([
    riftFetch<W.WireScanResults>(`${V1}/scans/${scanId}/results`, { tags: [tag.scan(scanId)], ...LIVE }).catch(
      () => null,
    ),
    getPolicy(status.scan.site_id).catch(() => null),
    getProposal(status.scan.site_id).catch(() => null),
    getWireSite(status.scan.site_id).catch(() => null),
  ]);

  // The same derivation the configuration screen uses, so the number the
  // stepper reports is the number of categories that screen then shows.
  const categoryCount = adapt.plannedCategoryCodes({
    proposalPurposes: proposal?.purposes ?? [],
    recommendations: policy?.policy.recommendations ?? [],
  }).length;

  return adapt.toScan(status.scan, status.summary, {
    ...(policy ? { regionCount: policy.policy.jurisdictions.length } : {}),
    ...(site ? { host: site.domain } : {}),
    categoryCount,
    unresolvedCount: (policy?.policy.recommendations ?? []).filter(
      (r) => r.recommended_action === 'review',
    ).length,
    unreachable: (results?.pages ?? [])
      .filter((page) => page.error !== null)
      .map((page) => ({
        path: pathOf(page.url),
        reason: page.error ?? 'unreachable',
        attempts: 1,
      })),
  });
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

export async function listScans(siteId: string): Promise<ScanSummary[]> {
  if (USE_FIXTURES) return fx.SCAN_HISTORY;

  const [scans, policy] = await Promise.all([
    listWireScans(siteId),
    getPolicy(siteId).catch(() => null),
  ]);

  return adapt.toScanSummaries(
    scans,
    (policy?.policy.recommendations ?? []).filter((r) => r.recommended_action === 'review').length,
  );
}

export async function getScanDiff(
  baselineScanId: string,
  comparedScanId: string,
): Promise<ScanDiff> {
  if (USE_FIXTURES) return fx.SCAN_DIFF;

  const diff = await getDiff(comparedScanId, baselineScanId);
  if (!diff) {
    return { baselineScanId, comparedScanId, added: [], removed: [], changed: [] };
  }
  return adapt.toScanDiff(diff);
}

export async function listFindings(scanId: string): Promise<Finding[]> {
  if (USE_FIXTURES) return fx.FINDINGS;

  const results = await riftFetch<W.WireScanResults>(`${V1}/scans/${scanId}/results`, {
    tags: [tag.scan(scanId)],
    ...LIVE,
  });
  const siteId = results.scan.site_id;

  const [policy, overrides, purposes, proposal, diff] = await Promise.all([
    getPolicy(siteId).catch(() => null),
    listOverrides(siteId).catch(() => []),
    listPurposes().catch(() => []),
    getProposal(siteId).catch(() => null),
    getDiff(scanId),
  ]);

  return adapt.toFindings({
    results,
    recommendations: policy?.policy.recommendations ?? [],
    overrides,
    approved: policy?.active_version ?? null,
    purposeNames: adapt.purposeNamesFrom(purposes, proposal?.purposes ?? []),
    newFingerprints: adapt.newFingerprintsFrom(diff),
  });
}

/* ── Configuration ─────────────────────────────────────────────────────── */

export async function getConfiguration(siteId: string): Promise<RiftConfiguration> {
  if (USE_FIXTURES) return fx.CONFIGURATION;

  const [policy, proposal, purposes, install, scans] = await Promise.all([
    getPolicy(siteId),
    getProposal(siteId),
    listPurposes().catch(() => []),
    getInstall(siteId).catch(() => null),
    listWireScans(siteId).catch(() => []),
  ]);

  const purposeNames = adapt.purposeNamesFrom(purposes, proposal.purposes);

  const [runtime, results] = await Promise.all([
    install ? getRuntimeConfig(install.public_key) : Promise.resolve(null),
    (async () => {
      const scan = latestScan(scans);
      if (!scan || scan.status !== 'completed') return null;
      return riftFetch<W.WireScanResults>(`${V1}/scans/${scan.scan_id}/results`, {
        tags: [tag.scan(scan.scan_id)],
        ...LIVE,
      }).catch(() => null);
    })(),
  ]);

  /**
   * The rows still waiting on a person, as full findings so the review screen
   * can show the same evidence the scan screen did.
   *
   * A finding counts as unresolved only while **nobody has decided it**. An
   * overridden vendor is resolved by definition — somebody looked at it and
   * said what should happen — and continuing to count it produced screens that
   * disagreed about the same site: an overview saying one item needed
   * attention beside a configuration page saying two. Both were reading real
   * data; they simply meant different things by the same word.
   *
   * The operator's decision is the one that settles it, which is the same rule
   * the platform applies when it marks a recommendation `overridden`.
   */
  const overrides = await listOverrides(siteId).catch(() => []);
  const decided = new Set(overrides.map((o) => o.detector_id));

  const unresolved = results
    ? adapt
        .toFindings({
          results,
          recommendations: policy.policy.recommendations,
          overrides,
          approved: policy.active_version,
          purposeNames,
        })
        .filter(
          (finding) =>
            !decided.has(finding.findingId) &&
            (finding.confidence === 'unresolved' || finding.status === 'needs_review'),
        )
    : [];

  return adapt.toConfiguration({
    siteId,
    policy,
    proposal,
    runtime,
    install,
    purposeNames,
    unresolved,
  });
}

/**
 * Accept what Rift generated.
 *
 * Two writes, in an order that matters:
 *
 *  1. **Declare the purposes the proposal suggested.** A consent decision can
 *     only reference a purpose the organisation has declared, so approving a
 *     policy that names undeclared purposes would produce a banner whose
 *     choices the consent log cannot hold. An existing purpose comes back 409
 *     and is skipped — the operator's own wording is theirs, not ours to
 *     overwrite.
 *
 *  2. **Approve the policy, sending back the recommendations verbatim.** The
 *     platform deliberately does not re-derive them at approval time: what was
 *     approved has to be what was on screen, not whatever a re-run a moment
 *     later would produce. The extra round trip is the point.
 */
export async function acceptConfiguration(siteId: string): Promise<{ version: string }> {
  if (USE_FIXTURES) return { version: fx.CONFIGURATION.version };

  const [policy, proposal] = await Promise.all([getPolicy(siteId), getProposal(siteId)]);

  // Two sources, because they answer different questions and neither is a
  // superset of the other. The proposal suggests purposes for the technologies
  // it could place, with wording; `undeclared_purposes` is the policy's own list
  // of every purpose its recommendations name and the organisation has not
  // declared. A site whose only classified vendor is a CDN produces an empty
  // proposal and an `essential` in that list — and skipping it would approve a
  // policy whose banner has nothing to show.
  const proposed = new Map(
    proposal.purposes
      .filter((purpose) => !purpose.already_declared)
      .map((purpose) => [
        purpose.suggested_code,
        {
          code: purpose.suggested_code,
          name: purpose.suggested_name,
          description: purpose.suggested_description,
        },
      ]),
  );
  for (const code of policy.policy.undeclared_purposes) {
    if (!proposed.has(code)) proposed.set(code, describePurpose(code));
  }

  await Promise.all(
    [...proposed.values()].map((purpose) =>
      riftFetch<unknown>(`${V1}/purposes`, { method: 'POST', body: purpose, ...LIVE }).catch(
        // A purpose that already exists comes back 409, and that is the state
        // the caller wanted. Overwriting an operator's own wording would be the
        // wrong repair.
        () => undefined,
      ),
    ),
  );

  const approved = await riftFetch<{ version: W.WirePolicyVersion }>(
    `${V1}/sites/${siteId}/consent-policy`,
    {
      method: 'POST',
      body: {
        recommendations: policy.policy.recommendations,
        jurisdictions: policy.policy.jurisdictions,
        regimes: policy.policy.regimes,
        scan_id: policy.policy.scan_id,
        approval_note: 'Accepted from the Rift dashboard.',
      },
      ...LIVE,
    },
  );

  return { version: `v${approved.version.version}` };
}

/**
 * Put a technology in a different consent category.
 *
 * Overrides are keyed on the vendor across the whole site rather than on one
 * observation, because that is the granularity the platform offers. Implying
 * per-page control that does not exist would be a lie an operator only
 * discovers when it matters.
 *
 * A null category is not "no consent needed" — it is "we have not decided",
 * which is what `review` means. Mapping it to `allow` would resolve an open
 * question silently in the permissive direction, and that is the one direction
 * that cannot be undone for a visitor who has already been tracked.
 */
export async function overrideTechnology(
  siteId: string,
  technologyId: string,
  category: string | null,
): Promise<void> {
  if (USE_FIXTURES) return;

  await riftFetch<void>(`${V1}/sites/${siteId}/consent-policy/overrides`, {
    method: 'POST',
    body: {
      detector_id: technologyId,
      purpose_code: category,
      action: category ? (category === 'essential' ? 'allow' : 'require_consent') : 'review',
      note: 'Set from the dashboard.',
    },
    ...LIVE,
  });
}

export async function restoreRecommendation(siteId: string, technologyId: string): Promise<void> {
  if (USE_FIXTURES) return;

  await riftFetch<void>(
    `${V1}/sites/${siteId}/consent-policy/overrides?detector_id=${encodeURIComponent(technologyId)}`,
    { method: 'DELETE', ...LIVE },
  );
}

/* ── Installation ──────────────────────────────────────────────────────── */

export async function getSnippet(siteId: string): Promise<InstallSnippet> {
  if (USE_FIXTURES) return fx.SNIPPET;
  return adapt.toSnippet(await getInstall(siteId));
}

export async function getVerification(siteId: string): Promise<Verification> {
  if (USE_FIXTURES) return fx.verificationAtStep(5);
  return adapt.toVerification(await getInstall(siteId));
}

/* ── Consent & analytics ───────────────────────────────────────────────── */

export async function getConsentOverview(siteId: string, days = 14): Promise<ConsentOverview> {
  if (USE_FIXTURES) return fx.CONSENT;

  const [records, purposes, proposal, versions] = await Promise.all([
    listConsentFor(siteId),
    listPurposes().catch(() => []),
    getProposal(siteId).catch(() => null),
    riftFetch<{ versions: W.WirePolicyVersion[] }>(
      `${V1}/sites/${siteId}/consent-policy?versions=true`,
      { tags: [tag.config(siteId)], ...LIVE },
    ).catch(() => ({ versions: [] as W.WirePolicyVersion[] })),
  ]);

  return adapt.toConsentOverview(
    records,
    days,
    adapt.purposeNamesFrom(purposes, proposal?.purposes ?? []),
    versions.versions.length,
  );
}

export async function listConsentRecords(siteId: string, limit = 25): Promise<ConsentRecord[]> {
  if (USE_FIXTURES) return fx.CONSENT_RECORDS;

  const [records, purposes] = await Promise.all([
    listConsentFor(siteId),
    listPurposes().catch(() => []),
  ]);

  return adapt.toConsentRecords(records, adapt.purposeNamesFrom(purposes), limit);
}

export async function getAnalytics(siteId: string, days = 14): Promise<AnalyticsOverview> {
  if (USE_FIXTURES) return fx.ANALYTICS;

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [summary, consent] = await Promise.all([
    riftFetch<W.WireAnalyticsSummary>(
      `${V1}/analytics/summary?site_id=${encodeURIComponent(siteId)}&from=${from.toISOString()}&to=${to.toISOString()}`,
      { tags: [tag.site(siteId)], ...LIVE },
    ),
    listConsentFor(siteId).catch(() => [] as W.WireConsentRecord[]),
  ]);

  // The rate that matters on an analytics screen is consent for analytics
  // specifically, not consent in general: it is the number that says how much
  // of the traffic below is being measured at all.
  const analyticsDecisions = consent.filter((r) => r.purpose_code === 'analytics');
  const decided = analyticsDecisions.filter(
    (r) => r.status === 'GRANTED' || r.status === 'DENIED',
  );
  const rate =
    decided.length > 0
      ? Math.round(
          (decided.filter((r) => r.status === 'GRANTED').length / decided.length) * 1000,
        ) / 10
      : null;

  return adapt.toAnalytics(summary, rate, days);
}

/* ── Changes ───────────────────────────────────────────────────────────── */

export async function listChanges(siteId: string): Promise<ChangeEntry[]> {
  if (USE_FIXTURES) return fx.CHANGES;

  const scans = await listWireScans(siteId).catch(() => []);
  const scan = latestScan(scans);
  if (!scan || scan.status !== 'completed') return [];

  const diff = await getDiff(scan.scan_id);
  // A first scan has no predecessor. Nothing has changed because there was
  // nothing to change from, and an empty feed says that better than a row would.
  if (!diff || !diff.baseline_scan_id) return [];

  return adapt.toChanges(diff);
}
