/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REPLACE THIS FILE with types generated from the backend's OpenAPI document:
 *
 *     RIFT_OPENAPI_URL=https://api.rift.dev/openapi.json npm run api:types
 *
 * which writes `schema.d.ts` next to this file. Until that spec exists, these
 * hand-written types stand in — they follow the shapes the product spec
 * defines, and every field the UI reads is listed here so the swap is a
 * mechanical diff rather than a rewrite.
 *
 * The frontend must never own consent semantics. Categories, applicable
 * requirements and enforcement behaviour are values the API returns, not
 * values this layer derives.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ConfidenceLevel = 'confirmed' | 'likely' | 'unresolved';

export type SiteStatus = 'connected' | 'needs_review' | 'not_installed' | 'installation_issue';

export type HealthState = 'healthy' | 'needs_attention' | 'action_required' | 'scanner_stale' | 'installation_issue' | 'configuration_issue';

export interface Site {
  siteId: string;
  host: string;
  status: SiteStatus;
  health: HealthState;
  installedAt: string | null;
  lastScanAt: string | null;
  nextScanAt: string | null;
  counts: { pages: number; cookies: number; services: number; technologies: number; unresolved: number };
  consentRate: number | null;
  configurationVersion: string | null;
}

/* ── Scans ─────────────────────────────────────────────────────────────── */

export type ScanStatus = 'queued' | 'running' | 'completed' | 'completed_with_limitations' | 'failed';

/** The nine stages, in the order the API reports them. */
export type ScanStageId =
  | 'reach' | 'discover_pages' | 'cookies' | 'scripts' | 'storage'
  | 'network' | 'technologies' | 'requirements' | 'configuration';

export interface ScanStage {
  id: ScanStageId;
  label: string;
  state: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  /** Human-readable result, e.g. "43 pages discovered". Supplied by the API. */
  note: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Scan {
  scanId: string;
  siteId: string;
  status: ScanStatus;
  startedAt: string;
  finishedAt: string | null;
  stages: ScanStage[];
  counts: { pages: number; cookies: number; services: number; technologies: number; unresolved: number };
  /** Present when status is `completed_with_limitations`. Partial results are
   *  never discarded — the UI shows them alongside what was missed. */
  limitations: {
    pagesReached: number;
    pagesTotal: number;
    /**
     * Why the scan stopped short. `budget` means Rift reached a limit it sets
     * for itself — a page count, a time box — and is the ordinary case on a
     * large website. `unreachable` means pages did not respond. Telling a
     * customer their website stopped responding when Rift simply ran out of
     * budget is the kind of wrong that sends someone to debug a healthy server.
     */
    kind: 'budget' | 'unreachable' | 'cancelled';
    /** One sentence saying what happened, written for the person reading it. */
    reason: string;
    unreachable: Array<{ path: string; reason: string; attempts: number }>;
  } | null;
  /** Present when status is `failed`. */
  failure: { summary: string; recovered: boolean; guidance: string[] } | null;
}

export interface ScanSummary {
  scanId: string;
  startedAt: string;
  status: ScanStatus;
  counts: Scan['counts'];
  /** Net technologies added since the previous scan, if there was one. */
  deltaTechnologies: number | null;
}

export interface ScanDiff {
  baselineScanId: string;
  comparedScanId: string;
  added: DiffEntry[];
  removed: DiffEntry[];
  changed: DiffEntry[];
}

export interface DiffEntry {
  kind: 'technology' | 'cookie' | 'request' | 'configuration';
  name: string;
  detail: string;
  category: string | null;
  confidence: ConfidenceLevel | null;
  /** Whether Rift applied this itself or it is waiting on a person. */
  handling: 'automatic' | 'needs_review';
  note: string;
}

/* ── Findings ──────────────────────────────────────────────────────────── */

export interface Finding {
  findingId: string;
  name: string;
  host: string;
  vendor: string | null;
  /** `null` when unresolved — the API does not guess, and neither does the UI. */
  category: string | null;
  confidence: ConfidenceLevel;
  status: 'configured' | 'needs_review' | 'not_configured';
  counts: { cookies: number; requests: number; pagesSeenOn: number; pagesTotal: number };
  firstSeenAt: string;
  newSinceLastScan: boolean;
  observedAs: string[];
  evidence: Array<{ kind: string; value: string }>;
  /** Rift's recommendation and the company's decision, kept distinct.
   *  `category` reads; `categoryId` is what a write sends. */
  recommendation: { category: string | null; categoryId: string | null; rationale: string } | null;
  decision: {
    category: string | null;
    categoryId: string | null;
    overridesRecommendation: boolean;
    decidedAt: string | null;
  } | null;
  /** Rendered by the API so the frontend never composes a consent claim. */
  consentBehaviour: { summary: string; detail: string } | null;
}

/* ── Configuration (spec §31) ──────────────────────────────────────────── */

export interface ConsentCategory {
  id: string;
  name: string;
  description: string;
  /** Necessary categories are always available where applicable. */
  alwaysActive: boolean;
  technologyCount: number;
  /** Behaviour text comes from the policy layer, never composed here. */
  behaviour: string;
}

export interface RegionConfiguration {
  /** The jurisdiction identifier the policy engine returned, verbatim. */
  code: string;
  /**
   * A compact form of `code` for the round region badge. Purely typographic —
   * an abbreviation of the same jurisdiction, never a different one.
   */
  shortCode: string;
  name: string;
  requirement: string;
  behaviour: string;
  confidence: 'high' | 'medium' | 'low';
  visitorShare: number | null;
  reasoning: { factors: string[]; source: string; knowledgeBaseVersion: string; appliedAt: string } | null;
}

export interface BannerConfiguration {
  title: string;
  body: string;
  acceptAllLabel: string;
  rejectLabel: string;
  managePreferencesLabel: string;
  privacyNoticeHref: string;
}

export interface PreferenceConfiguration {
  title: string;
  body: string;
  saveLabel: string;
}

export interface TechnologyConfiguration {
  technologyId: string;
  name: string;
  host: string;
  /**
   * Display labels, for reading. The `…Id` twins are the consent category's
   * own identifier and are what a write must send — the platform matches a
   * purpose by code, and a label that merely looks like one attaches the vendor
   * to a purpose that does not exist.
   */
  recommendedCategory: string | null;
  recommendedCategoryId: string | null;
  configuredCategory: string | null;
  configuredCategoryId: string | null;
  overridden: boolean;
  confidence: ConfidenceLevel;
}

export interface EnforcementConfiguration {
  beforeConsent: string;
  afterConsent: string;
  withdrawalEnabled: boolean;
  recordsEnabled: boolean;
  renewAfterMonths: number | null;
}

export interface RiftConfiguration {
  siteId: string;
  regions: RegionConfiguration[];
  consent: {
    categories: ConsentCategory[];
    banner: BannerConfiguration;
    preferenceCentre: PreferenceConfiguration;
  };
  technologies: TechnologyConfiguration[];
  enforcement: EnforcementConfiguration;
  unresolved: Finding[];
  version: string;
}

/* ── Installation ──────────────────────────────────────────────────────── */

export interface InstallSnippet {
  siteId: string;
  scriptUrl: string;
  snippet: string;
  configurationVersion: string;
  sizeLabel: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  state: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  note: string | null;
  durationMs: number | null;
}

export interface Verification {
  siteId: string;
  status: 'checking' | 'connected' | 'not_activated' | 'not_detected';
  checks: VerificationCheck[];
  /** Ordered most-likely-first, each with an action the operator can take. */
  causes: Array<{ title: string; detail: string; remedy: string }>;
  observations: Array<{ label: string; value: string; tone: 'ok' | 'warn' }>;
  checkedAt: string;
}

/* ── Consent & analytics ───────────────────────────────────────────────── */

export interface ConsentOverview {
  decisions: number;
  captureRate: number;
  breakdown: { acceptedAll: number; rejectedNonEssential: number; custom: number };
  withdrawals: number;
  configurationVersions: number;
  trend: Array<{ date: string; acceptedAll: number; rejected: number; custom: number }>;
  byRegion: Array<{ region: string; decisions: number; acceptedAllRate: number }>;
  byCategory: Array<{ category: string; allowedRate: number }>;
}

export interface ConsentRecord {
  recordId: string;
  recordedAt: string;
  region: string;
  decision: 'accepted_all' | 'rejected' | 'custom' | 'withdrawn';
  categoriesAllowed: string[];
  configurationVersion: string;
  channel: 'banner' | 'preference_centre';
  /**
   * Three states, not two.
   *
   * `signed` means a key was configured when the decision was written.
   * `receipt` means integrity only — which is what every record written before
   * signed proofs existed carries, and is a real, defensible state rather than a
   * failure. `none` means there is no evidence attached at all.
   *
   * None of these is a verification result. Whether a proof actually verifies is
   * a separate question with its own endpoint, and conflating "a signature is
   * present" with "the signature is valid" is the mistake this wording avoids.
   */
  proof: 'signed' | 'receipt' | 'none';
}

export interface AnalyticsOverview {
  /** Every metric here is measured from the consent-controlled event stream. */
  consentAffected: true;
  analyticsConsentRate: number;
  visitors: number;
  sessions: number;
  pageViews: number;
  averageSessionLabel: string;
  trend: Array<{ date: string; visitors: number }>;
  topPages: Array<{ path: string; views: number; share: number }>;
  sources: Array<{ source: string; sessions: number }>;
  devices: Array<{ device: string; share: number }>;
}

/* ── Changes ───────────────────────────────────────────────────────────── */

export interface ChangeEntry {
  changeId: string;
  kind: 'added' | 'removed' | 'changed';
  title: string;
  detail: string;
  note: string;
  occurredAt: string;
  handling: 'automatic' | 'needs_review';
}

/* ── Discovery (Phase 11A) ─────────────────────────────────────────────────
   What is running on the pages, where it sends data, and whether any of it
   fired when consent said it should not. */

export interface DiscoveredComponent {
  host: string;
  vendor: string | null;
  category: string | null;
  kind: string;
  initiator: string | null;
  thirdParty: boolean;
  requestCount: number;
  pageUrl: string;
  firstSeen: string;
  lastSeen: string;
  destinationCountry: string | null;
  crossesBorder: boolean;
  /** True when the catalogue does not know this host. Not a violation. */
  unclassified: boolean;
}

export interface ConsentViolation {
  host: string;
  purposeCode: string;
  /** DENIED or WITHDRAWN — the effective status when the request was observed. */
  consentStatus: string;
  observedAt: string;
}

export interface StorageItem {
  kind: 'cookie' | 'local_storage' | 'session_storage';
  name: string;
  writer: string | null;
  firstSeen: string;
}

export interface DiscoveryInventory {
  siteId: string;
  generatedAt: string;
  totals: {
    destinations: number;
    thirdParty: number;
    unclassified: number;
    crossBorder: number;
    storageItems: number;
    openViolations: number;
  };
  components: DiscoveredComponent[];
  storage: StorageItem[];
  violations: ConsentViolation[];
}

/* ── Data flow (Phase 11A) ─────────────────────────────────────────────────
   Two halves that answer the same question from opposite ends: what leaves the
   browser (observed by the SDK) and what leaves the server under an
   authorisation (recorded by the transfer ledger). */

export interface DataFlowDestination {
  host: string;
  vendor: string | null;
  category: string | null;
  country: string | null;
  crossesBorder: boolean;
  requestCount: number;
}

export interface ServerTransfer {
  transferId: string;
  purposeCode: string;
  recipientCode: string;
  recipientName: string | null;
  status: 'RECORDED' | 'DELIVERED' | 'FAILED';
  payloadBytes: number;
  recordedAt: string;
  deliveredAt: string | null;
  /** The consent decision this transfer was authorised against. */
  consentRecordId: string;
}

export interface DataFlowMap {
  siteId: string;
  /** Grouped by destination country; `null` key means the country is unknown. */
  byCountry: Array<{
    country: string | null;
    crossesBorder: boolean;
    destinations: DataFlowDestination[];
    requestCount: number;
  }>;
  browserDestinations: DataFlowDestination[];
  serverTransfers: ServerTransfer[];
  totals: { destinations: number; countries: number; crossBorder: number; transfers: number };
}

/* ── Audit trail (Phase 11B) ───────────────────────────────────────────────
   One timeline across three domains the platform deliberately keeps apart.
   The cross-reference ids are the point: a consent decision, the authorisation
   that relied on it, and the transfer that followed are three rows a reader
   has to be able to join. */

export type AuditKind = 'consent' | 'authorisation' | 'transfer';

export interface AuditEntry {
  kind: AuditKind;
  at: string;
  siteId: string;
  principal: string;
  purposeCode: string;
  status: string;
  /** The platform's own sentence. Never recomposed here. */
  summary: string;
  consentRecordId: string | null;
  authorisationId: string | null;
  transferId: string | null;
}
