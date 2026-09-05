import type {
  AnalyticsOverview, ChangeEntry, ConsentOverview, ConsentRecord, Finding,
  InstallSnippet, RiftConfiguration, Scan, ScanDiff, ScanSummary, Site, Verification,
} from './types';

/**
 * Development fixtures. Used automatically whenever RIFT_API_URL is unset, so
 * the frontend runs end to end before the backend is reachable. Shaped to the
 * exact response types — when the API arrives, these become test data.
 */

export const SITES: Site[] = [
  {
    siteId: 'site_9fb2c41a', host: 'northwind-retail.com', status: 'connected', health: 'needs_attention',
    installedAt: '2026-09-04T09:17:00Z', lastScanAt: '2026-09-05T09:14:00Z', nextScanAt: '2026-09-11T09:00:00Z',
    counts: { pages: 43, cookies: 12, services: 7, technologies: 11, unresolved: 1 },
    consentRate: 94.2, configurationVersion: 'cfg_2026.09.04-3',
  },
  {
    siteId: 'site_2a71d09c', host: 'shop.northwind.eu', status: 'connected', health: 'healthy',
    installedAt: '2026-08-19T11:02:00Z', lastScanAt: '2026-09-05T09:20:00Z', nextScanAt: '2026-09-11T09:00:00Z',
    counts: { pages: 28, cookies: 9, services: 5, technologies: 8, unresolved: 0 },
    consentRate: 96.8, configurationVersion: 'cfg_2026.09.04-1',
  },
  {
    siteId: 'site_55c0e8b1', host: 'careers.northwind.com', status: 'needs_review', health: 'needs_attention',
    installedAt: '2026-08-22T14:40:00Z', lastScanAt: '2026-09-04T09:05:00Z', nextScanAt: '2026-09-11T09:00:00Z',
    counts: { pages: 16, cookies: 6, services: 4, technologies: 6, unresolved: 2 },
    consentRate: 91.4, configurationVersion: 'cfg_2026.09.02-1',
  },
  {
    siteId: 'site_7d3f1188', host: 'help.northwind.com', status: 'connected', health: 'healthy',
    installedAt: '2026-07-30T08:11:00Z', lastScanAt: '2026-09-03T09:08:00Z', nextScanAt: '2026-09-10T09:00:00Z',
    counts: { pages: 61, cookies: 5, services: 3, technologies: 5, unresolved: 0 },
    consentRate: 95.1, configurationVersion: 'cfg_2026.08.28-2',
  },
  {
    siteId: 'site_0b94aa2e', host: 'northwind-labs.dev', status: 'not_installed', health: 'installation_issue',
    installedAt: null, lastScanAt: '2026-09-01T10:00:00Z', nextScanAt: null,
    counts: { pages: 12, cookies: 4, services: 2, technologies: 4, unresolved: 0 },
    consentRate: null, configurationVersion: null,
  },
];

const STAGE_LABELS: Array<[Scan['stages'][number]['id'], string, string]> = [
  ['reach', 'Reach website', 'Website reachable · 182 ms'],
  ['discover_pages', 'Discover pages', '43 pages discovered'],
  ['cookies', 'Inspect cookies', '12 cookies detected'],
  ['scripts', 'Inspect scripts', '19 scripts inspected'],
  ['storage', 'Inspect storage', 'Local and session storage read'],
  ['network', 'Inspect network activity', '7 third-party services seen'],
  ['technologies', 'Identify technologies', '11 technologies identified'],
  ['requirements', 'Evaluate privacy requirements', '4 regions assessed'],
  ['configuration', 'Generate configuration', '4 consent categories prepared'],
];

/** A scan frozen at `completedStages` — the SSE route walks this forward. */
export function scanAtStage(completedStages: number, scanId = 'scn_8841'): Scan {
  const done = Math.min(completedStages, 9);
  return {
    scanId,
    siteId: 'site_9fb2c41a',
    status: done >= 9 ? 'completed' : 'running',
    startedAt: '2026-09-05T09:14:00Z',
    finishedAt: done >= 9 ? '2026-09-05T09:15:11Z' : null,
    stages: STAGE_LABELS.map(([id, label, note], i) => ({
      id, label,
      state: i < done ? 'done' : i === done ? 'running' : 'pending',
      note: i < done ? note : null,
      startedAt: i <= done ? '2026-09-05T09:14:00Z' : null,
      finishedAt: i < done ? '2026-09-05T09:14:30Z' : null,
    })),
    counts: {
      pages: done > 2 ? 43 : 0,
      cookies: done > 3 ? 12 : 0,
      services: done > 6 ? 7 : 0,
      technologies: done > 7 ? 11 : 0,
      unresolved: done > 7 ? 1 : 0,
    },
    limitations: null,
    failure: null,
  };
}

export const SCAN_PARTIAL: Scan = {
  ...scanAtStage(9, 'scn_8455'),
  status: 'completed_with_limitations',
  counts: { pages: 38, cookies: 9, services: 6, technologies: 3, unresolved: 0 },
  limitations: {
    pagesReached: 38,
    pagesTotal: 43,
    kind: 'unreachable',
    reason:
      'Rift reached 38 of 43 pages. 5 did not respond and are listed below — everything else was scanned normally.',
    unreachable: [
      { path: '/account/orders', reason: 'Response timed out after 15s', attempts: 3 },
      { path: '/account/addresses', reason: 'Response timed out after 15s', attempts: 3 },
      { path: '/checkout/confirmation', reason: 'Server returned 503', attempts: 2 },
      { path: '/journal/archive/2019', reason: 'Redirect loop', attempts: 2 },
      { path: '/gift-cards', reason: 'Server returned 503', attempts: 2 },
    ],
  },
  failure: null,
};

export const SCAN_HISTORY: ScanSummary[] = [
  { scanId: 'scn_8841', startedAt: '2026-09-05T09:14:00Z', status: 'completed', counts: { pages: 43, cookies: 12, services: 7, technologies: 11, unresolved: 1 }, deltaTechnologies: 1 },
  { scanId: 'scn_8702', startedAt: '2026-08-28T09:12:00Z', status: 'completed', counts: { pages: 41, cookies: 11, services: 6, technologies: 10, unresolved: 0 }, deltaTechnologies: 0 },
  { scanId: 'scn_8590', startedAt: '2026-08-21T09:11:00Z', status: 'completed', counts: { pages: 41, cookies: 11, services: 6, technologies: 10, unresolved: 0 }, deltaTechnologies: 1 },
  { scanId: 'scn_8455', startedAt: '2026-08-14T09:15:00Z', status: 'completed_with_limitations', counts: { pages: 38, cookies: 9, services: 6, technologies: 9, unresolved: 0 }, deltaTechnologies: 0 },
  { scanId: 'scn_8321', startedAt: '2026-08-07T09:13:00Z', status: 'completed', counts: { pages: 41, cookies: 9, services: 6, technologies: 9, unresolved: 0 }, deltaTechnologies: 2 },
];

const f = (
  id: string, name: string, host: string, vendor: string | null, category: string | null,
  confidence: Finding['confidence'], status: Finding['status'],
  cookies: number, requests: number, firstSeenAt: string, newSince = false,
): Finding => ({
  findingId: id, name, host, vendor, category, confidence, status,
  counts: { cookies, requests, pagesSeenOn: confidence === 'unresolved' ? 4 : requests > 8 ? 43 : 19, pagesTotal: 43 },
  firstSeenAt, newSinceLastScan: newSince,
  observedAs: cookies > 0 ? ['Network request', 'Script', 'Cookie'] : ['Network request', 'Script'],
  evidence: [
    { kind: 'Request', value: `GET https://${host}/collect?v=2&tid=…` },
    { kind: 'Script', value: `<script src="https://${host}/loader.js" async>` },
    { kind: 'Cookie', value: cookies > 0 ? `Set-Cookie on ${host} · expires in 13 months` : 'No cookie observed' },
  ],
  recommendation: category
    ? {
        category,
        categoryId: category.toLowerCase(),
        rationale: confidence === 'confirmed' ? 'Matched on host, script and cookie' : 'Matched on request pattern',
      }
    : null,
  decision: category
    ? { category, categoryId: category.toLowerCase(), overridesRecommendation: false, decidedAt: null }
    : null,
  consentBehaviour: category
    ? category === 'Necessary'
      ? { summary: 'Always available where applicable', detail: 'This technology is required for the site to function, so it runs without waiting for a consent decision.' }
      : { summary: 'Controlled until appropriate consent', detail: `This technology is held until the visitor’s consent allows the ${category.toLowerCase()} category, according to the configuration Rift generated for their region.` }
    : null,
});

export const FINDINGS: Finding[] = [
  f('fnd_01', 'Google Analytics 4', 'www.googletagmanager.com', 'Google LLC', 'Analytics', 'confirmed', 'configured', 3, 14, '2026-09-05T09:14:00Z'),
  f('fnd_02', 'Meta Pixel', 'connect.facebook.net', 'Meta Platforms', 'Marketing', 'confirmed', 'configured', 2, 9, '2026-09-05T09:14:00Z'),
  f('fnd_03', 'YouTube embed', 'www.youtube-nocookie.com', 'Google LLC', 'Preferences', 'confirmed', 'configured', 2, 6, '2026-09-05T09:14:00Z'),
  f('fnd_04', 'Hotjar', 'static.hotjar.com', 'Hotjar Ltd', 'Analytics', 'confirmed', 'configured', 2, 8, '2026-08-28T09:12:00Z'),
  f('fnd_05', 'Stripe Checkout', 'js.stripe.com', 'Stripe, Inc.', 'Necessary', 'confirmed', 'configured', 1, 5, '2026-08-21T09:11:00Z'),
  f('fnd_06', 'Cloudflare Turnstile', 'challenges.cloudflare.com', 'Cloudflare', 'Necessary', 'confirmed', 'configured', 1, 3, '2026-08-21T09:11:00Z'),
  f('fnd_07', 'Intercom', 'widget.intercom.io', 'Intercom, Inc.', 'Preferences', 'confirmed', 'configured', 1, 7, '2026-08-21T09:11:00Z'),
  f('fnd_08', 'TikTok Pixel', 'analytics.tiktok.com', 'TikTok Ltd', 'Marketing', 'likely', 'configured', 1, 4, '2026-09-05T09:14:00Z', true),
  f('fnd_09', 'Analytics technology', 'metrics.vendor-cdn.io', null, 'Analytics', 'likely', 'configured', 1, 3, '2026-09-02T09:10:00Z'),
  f('fnd_10', 'Session replay technology', 'rec.pxlgrid.net', null, 'Analytics', 'likely', 'needs_review', 0, 2, '2026-09-02T09:10:00Z'),
  f('fnd_11', 'Unknown third-party technology', 'tracker.example.net', null, null, 'unresolved', 'needs_review', 1, 3, '2026-09-05T09:14:00Z', true),
];

export const CONFIGURATION: RiftConfiguration = {
  siteId: 'site_9fb2c41a',
  version: 'cfg_2026.09.04-3',
  regions: [
    { code: 'EU', shortCode: 'EU', name: 'EU / EEA', requirement: 'GDPR + ePrivacy requirements', behaviour: 'Consent configuration enabled', confidence: 'high', visitorShare: 46,
      reasoning: { factors: ['8 non-essential tracking technologies detected on your site', 'Visitors observed in the EU / EEA', 'Applicable requirement in Rift’s knowledge base'], source: 'Rift regulation knowledge base', knowledgeBaseVersion: 'kb_2026.08.19', appliedAt: '2026-09-04T09:17:00Z' } },
    { code: 'US', shortCode: 'US', name: 'United States', requirement: 'Applicable state privacy requirements', behaviour: 'Regional privacy controls enabled', confidence: 'high', visitorShare: 31, reasoning: null },
    { code: 'IN', shortCode: 'IN', name: 'India', requirement: 'DPDP requirements', behaviour: 'DPDP-oriented configuration enabled', confidence: 'medium', visitorShare: 18, reasoning: null },
    { code: 'RW', shortCode: 'RW', name: 'Rest of world', requirement: 'Baseline Rift configuration', behaviour: 'Baseline controls enabled', confidence: 'high', visitorShare: 5, reasoning: null },
  ],
  consent: {
    categories: [
      { id: 'necessary', name: 'Necessary', description: 'Keeps the site working — checkout, sign-in and abuse prevention.', alwaysActive: true, technologyCount: 4, behaviour: 'Always available where applicable' },
      { id: 'analytics', name: 'Analytics', description: 'Measures how the site is used so it can be improved.', alwaysActive: false, technologyCount: 4, behaviour: 'Controlled until appropriate consent' },
      { id: 'marketing', name: 'Marketing', description: 'Supports advertising and campaign measurement.', alwaysActive: false, technologyCount: 2, behaviour: 'Controlled until appropriate consent' },
      { id: 'preferences', name: 'Preferences', description: 'Remembers choices such as embedded media and chat.', alwaysActive: false, technologyCount: 2, behaviour: 'Controlled until appropriate consent' },
    ],
    banner: {
      title: 'Your privacy matters',
      body: 'We use necessary technologies to keep this website working. With your permission, we may also use analytics and other technologies to understand how the site is used.',
      acceptAllLabel: 'Accept all',
      rejectLabel: 'Reject non-essential',
      managePreferencesLabel: 'Manage preferences',
      privacyNoticeHref: 'https://northwind-retail.com/privacy',
    },
    preferenceCentre: {
      title: 'Privacy preferences',
      body: 'Choose what this website may use. You can change this at any time.',
      saveLabel: 'Save preferences',
    },
  },
  technologies: FINDINGS.filter((x) => x.category).map((x) => ({
    technologyId: x.findingId, name: x.name, host: x.host,
    recommendedCategory: x.recommendation?.category ?? null,
    // Fixture categories are already the id the fixture consent categories use.
    recommendedCategoryId: x.recommendation?.category?.toLowerCase() ?? null,
    configuredCategory: x.decision?.category ?? null,
    configuredCategoryId: x.decision?.category?.toLowerCase() ?? null,
    overridden: x.decision?.overridesRecommendation ?? false,
    confidence: x.confidence,
  })),
  enforcement: {
    beforeConsent: 'Non-essential tracking is controlled',
    afterConsent: 'Allowed tracking activates according to visitor choices',
    withdrawalEnabled: true,
    recordsEnabled: true,
    renewAfterMonths: 12,
  },
  unresolved: FINDINGS.filter((x) => x.confidence === 'unresolved'),
};

export const SNIPPET: InstallSnippet = {
  siteId: 'site_9fb2c41a',
  scriptUrl: 'https://cdn.rift.dev/rift.js',
  snippet: '<script\n  src="https://cdn.rift.dev/rift.js"\n  data-site="site_9fb2c41a"\n  async></script>',
  configurationVersion: 'cfg_2026.09.04-3',
  sizeLabel: '14.2 kB gzipped',
};

const CHECK_LABELS: Array<[string, string, string]> = [
  ['script', 'Rift script detected', 'Found in <head> on 3 sampled pages'],
  ['identity', 'Site identity verified', 'site_9fb2c41a matches this domain'],
  ['consent', 'Consent system active', 'Banner rendered for an EU test visitor'],
  ['tracking', 'Tracking controls active', '8 non-essential technologies held before consent'],
  ['analytics', 'Analytics connection active', 'First event received'],
];
const CHECK_MS = [182, 96, 241, 318, 204];

export function verificationAtStep(completed: number): Verification {
  const done = Math.min(completed, 5);
  return {
    siteId: 'site_9fb2c41a',
    status: done >= 5 ? 'connected' : 'checking',
    checks: CHECK_LABELS.map(([id, label, note], i) => ({
      id, label,
      state: i < done ? 'passed' : i === done ? 'running' : 'pending',
      note: i < done ? note : i === done ? 'Checking…' : null,
      durationMs: i < done ? (CHECK_MS[i] ?? null) : null,
    })),
    causes: [],
    observations: [],
    checkedAt: '2026-09-05T09:18:00Z',
  };
}

export const VERIFICATION_ISSUE: Verification = {
  siteId: 'site_9fb2c41a',
  status: 'not_activated',
  checks: [
    { id: 'script', label: 'Rift script detected', state: 'passed', note: 'Found in <head> on 3 sampled pages', durationMs: 176 },
    { id: 'identity', label: 'Site identity verified', state: 'passed', note: 'site_9fb2c41a matches this domain', durationMs: 94 },
    { id: 'consent', label: 'Consent system active', state: 'failed', note: 'No banner rendered for an EU test visitor', durationMs: 2000 },
    { id: 'tracking', label: 'Tracking controls active', state: 'skipped', note: 'Not reached — depends on the consent system', durationMs: null },
    { id: 'analytics', label: 'Analytics connection active', state: 'skipped', note: 'Not reached — depends on the consent system', durationMs: null },
  ],
  causes: [
    { title: 'The script loaded too late', detail: 'Another analytics or tag-manager script ran before Rift, so those technologies started before Rift could control them.', remedy: 'Move the Rift snippet above every other script in <head>.' },
    { title: 'A different site identifier is on the page', detail: 'The snippet on your site carries an identifier Rift doesn’t recognise for this domain.', remedy: 'Check the snippet reads data-site="site_9fb2c41a".' },
    { title: 'A cached version of the page is being served', detail: 'Rift is seeing an older copy of your HTML that doesn’t include the snippet yet.', remedy: 'Purge your CDN or page cache, then check again.' },
    { title: 'A Content Security Policy is blocking Rift', detail: 'Your CSP does not allow Rift’s script or its configuration request.', remedy: 'Allow cdn.rift.dev in script-src and connect-src.' },
  ],
  observations: [
    { label: 'Script load order', value: 'Rift ran 4th of 6 scripts', tone: 'warn' },
    { label: 'Configuration request', value: 'Completed in 210 ms', tone: 'ok' },
    { label: 'Banner render', value: 'No banner element found', tone: 'warn' },
    { label: 'Technologies before consent', value: '3 already started', tone: 'warn' },
  ],
  checkedAt: '2026-09-05T09:18:00Z',
};

export const CHANGES: ChangeEntry[] = [
  { changeId: 'chg_01', kind: 'added', title: 'New technology detected', detail: 'TikTok Pixel', note: 'Classified as Marketing with likely confidence. Waiting on your confirmation.', occurredAt: '2026-09-05T09:16:00Z', handling: 'needs_review' },
  { changeId: 'chg_02', kind: 'added', title: 'New cookie observed', detail: '_ttp', note: 'Attached to TikTok Pixel. No separate decision needed.', occurredAt: '2026-09-05T09:16:00Z', handling: 'automatic' },
  { changeId: 'chg_03', kind: 'added', title: 'Unresolved technology found', detail: 'tracker.example.net', note: 'Rift could not determine its purpose and made no claim about it.', occurredAt: '2026-09-05T09:15:00Z', handling: 'needs_review' },
  { changeId: 'chg_04', kind: 'changed', title: 'Configuration published', detail: 'cfg_2026.09.04-3', note: 'Delivered to the Rift SDK. No reinstall required.', occurredAt: '2026-09-05T09:17:00Z', handling: 'automatic' },
  { changeId: 'chg_05', kind: 'added', title: 'New third-party request', detail: 'assets.example-cdn.com', note: 'Matched an existing necessary technology. Consent behaviour unchanged.', occurredAt: '2026-09-03T09:12:00Z', handling: 'automatic' },
  { changeId: 'chg_06', kind: 'removed', title: 'Technology no longer present', detail: 'Legacy analytics script', note: 'Removed from the configuration after two consecutive scans without it.', occurredAt: '2026-09-01T09:11:00Z', handling: 'automatic' },
];

export const SCAN_DIFF: ScanDiff = {
  baselineScanId: 'scn_8702',
  comparedScanId: 'scn_8841',
  added: [
    { kind: 'technology', name: 'TikTok Pixel', detail: 'analytics.tiktok.com', category: 'Marketing', confidence: 'likely', handling: 'needs_review', note: 'Classified with likely confidence — Rift wants your confirmation before it stays.' },
    { kind: 'cookie', name: '_ttp', detail: '.tiktok.com', category: 'Marketing', confidence: 'likely', handling: 'automatic', note: 'Attached to the TikTok Pixel technology above.' },
    { kind: 'request', name: 'assets.example-cdn.com', detail: 'assets.example-cdn.com', category: 'Necessary', confidence: 'confirmed', handling: 'automatic', note: 'Matched an existing necessary technology. No consent change.' },
    { kind: 'request', name: 'fonts.example-cdn.com', detail: 'fonts.example-cdn.com', category: 'Necessary', confidence: 'confirmed', handling: 'automatic', note: 'Matched an existing necessary technology. No consent change.' },
  ],
  removed: [
    { kind: 'technology', name: 'Legacy analytics script', detail: 'stats.old-vendor.com', category: 'Analytics', confidence: null, handling: 'automatic', note: 'No longer present on any scanned page. Removed from the configuration.' },
  ],
  changed: [
    { kind: 'configuration', name: 'Analytics policy', detail: 'cfg_2026.09.01-1 → cfg_2026.09.04-3', category: 'Analytics', confidence: null, handling: 'automatic', note: 'Retention window for one analytics cookie changed from 14 to 24 months at the vendor.' },
  ],
};

export const CONSENT: ConsentOverview = {
  decisions: 12482,
  captureRate: 94.2,
  breakdown: { acceptedAll: 58, rejectedNonEssential: 27, custom: 15 },
  withdrawals: 214,
  configurationVersions: 3,
  trend: [
    ['Aug 23', 268, 121, 66], ['Aug 24', 251, 118, 61], ['Aug 25', 214, 104, 55], ['Aug 26', 289, 133, 72],
    ['Aug 27', 302, 140, 78], ['Aug 28', 294, 136, 74], ['Aug 29', 311, 145, 81], ['Aug 30', 288, 131, 70],
    ['Aug 31', 232, 109, 58], ['Sep 1', 241, 112, 62], ['Sep 2', 318, 148, 83], ['Sep 3', 327, 151, 86],
    ['Sep 4', 334, 154, 88], ['Sep 5', 341, 158, 90],
  ].map(([date, acceptedAll, rejected, custom]) => ({ date: date as string, acceptedAll: acceptedAll as number, rejected: rejected as number, custom: custom as number })),
  byRegion: [
    { region: 'EU / EEA', decisions: 5742, acceptedAllRate: 46 },
    { region: 'United States', decisions: 3871, acceptedAllRate: 71 },
    { region: 'India', decisions: 2246, acceptedAllRate: 64 },
    { region: 'Rest of world', decisions: 623, acceptedAllRate: 68 },
  ],
  byCategory: [
    { category: 'Analytics', allowedRate: 68 },
    { category: 'Marketing', allowedRate: 41 },
    { category: 'Preferences', allowedRate: 73 },
  ],
};

export const CONSENT_RECORDS: ConsentRecord[] = [
  { recordId: 'cr_7f21a9', recordedAt: '2026-09-05T11:42:00Z', region: 'EU / EEA', decision: 'custom', categoriesAllowed: ['Analytics'], configurationVersion: 'cfg_2026.09.04-3', channel: 'banner' },
  { recordId: 'cr_7f2198', recordedAt: '2026-09-05T11:41:00Z', region: 'United States', decision: 'accepted_all', categoriesAllowed: ['Analytics', 'Marketing', 'Preferences'], configurationVersion: 'cfg_2026.09.04-3', channel: 'banner' },
  { recordId: 'cr_7f2187', recordedAt: '2026-09-05T11:39:00Z', region: 'EU / EEA', decision: 'rejected', categoriesAllowed: [], configurationVersion: 'cfg_2026.09.04-3', channel: 'banner' },
  { recordId: 'cr_7f2172', recordedAt: '2026-09-05T11:38:00Z', region: 'India', decision: 'accepted_all', categoriesAllowed: ['Analytics', 'Marketing', 'Preferences'], configurationVersion: 'cfg_2026.09.04-3', channel: 'banner' },
  { recordId: 'cr_7f2166', recordedAt: '2026-09-05T11:36:00Z', region: 'EU / EEA', decision: 'withdrawn', categoriesAllowed: [], configurationVersion: 'cfg_2026.09.04-2', channel: 'preference_centre' },
  { recordId: 'cr_7f2150', recordedAt: '2026-09-05T11:35:00Z', region: 'United States', decision: 'custom', categoriesAllowed: ['Analytics', 'Preferences'], configurationVersion: 'cfg_2026.09.04-3', channel: 'preference_centre' },
];

export const ANALYTICS: AnalyticsOverview = {
  consentAffected: true,
  analyticsConsentRate: 68,
  visitors: 24381,
  sessions: 31204,
  pageViews: 87412,
  averageSessionLabel: '2m 41s',
  trend: [
    ['Aug 23', 688], ['Aug 24', 601], ['Aug 25', 794], ['Aug 26', 842], ['Aug 27', 826], ['Aug 28', 871],
    ['Aug 29', 803], ['Aug 30', 654], ['Aug 31', 679], ['Sep 1', 888], ['Sep 2', 914], ['Sep 3', 936],
    ['Sep 4', 958], ['Sep 5', 972],
  ].map(([date, visitors]) => ({ date: date as string, visitors: visitors as number })),
  topPages: [
    { path: '/', views: 21408, share: 24.5 },
    { path: '/collections/autumn', views: 12944, share: 14.8 },
    { path: '/products/field-jacket', views: 9117, share: 10.4 },
    { path: '/checkout', views: 6382, share: 7.3 },
    { path: '/journal/how-we-make-it', views: 4771, share: 5.5 },
  ],
  sources: [
    { source: 'Direct', sessions: 9218 },
    { source: 'Organic search', sessions: 7844 },
    { source: 'Paid social', sessions: 4102 },
    { source: 'Referral', sessions: 2216 },
    { source: 'Email', sessions: 1001 },
  ],
  devices: [
    { device: 'Mobile', share: 61 },
    { device: 'Desktop', share: 33 },
    { device: 'Tablet', share: 6 },
  ],
};
