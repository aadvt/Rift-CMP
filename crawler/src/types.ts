/**
 * Observation types produced by the crawler.
 *
 * These are deliberately *observations*, not conclusions. Every field answers
 * "what did we see", never "what does the law require". The distinction is
 * structural rather than stylistic: the consent and compliance layer is another
 * person's work, and a scanner that pre-empts it produces answers nobody can
 * audit. See `docs/crawler.md`.
 */

export const SCAN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/**
 * The consent state a scan was performed under.
 *
 * Only `baseline` is implemented. The others exist in the vocabulary now so
 * that observations are stamped with the state they were made in from the
 * start — retrofitting that later would leave every existing row ambiguous
 * about what it actually proves.
 */
export const SCAN_MODES = ["baseline", "necessary_only", "analytics", "advertising", "all"] as const;
export type ScanMode = (typeof SCAN_MODES)[number];

export interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
  maxDurationMs: number;
  concurrency: number;
  navigationTimeoutMs: number;
  stabilisationMs: number;
  maxRedirects: number;
  /** Per-scan ceilings, so one hostile page cannot fill the database. */
  maxRequests: number;
  maxCookies: number;
  maxScripts: number;
  maxStorageItems: number;
  maxEvidencePerFinding: number;
}

export const DEFAULT_LIMITS: CrawlLimits = {
  maxPages: 100,
  maxDepth: 3,
  maxDurationMs: 10 * 60 * 1000,
  concurrency: 2,
  navigationTimeoutMs: 30_000,
  stabilisationMs: 2_500,
  maxRedirects: 5,
  maxRequests: 5_000,
  maxCookies: 500,
  maxScripts: 1_000,
  maxStorageItems: 500,
  maxEvidencePerFinding: 5,
};

export interface PageObservation {
  url: string;
  /** The URL finally landed on, when redirects moved us. */
  finalUrl: string | null;
  status: number | null;
  title: string | null;
  contentType: string | null;
  depth: number;
  redirectChain: string[];
  rendered: boolean;
  /** Populated when the page failed; the scan continues regardless. */
  error: string | null;
  startedAt: string;
  durationMs: number;
}

export interface CookieObservation {
  name: string;
  domain: string;
  path: string;
  /** ISO timestamp, or null for a session cookie. Values are never recorded. */
  expires: string | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  isThirdParty: boolean;
  /** Page whose render the cookie was first observed after. */
  firstSeenOn: string;
}

export interface ScriptObservation {
  /** Absolute URL for an external script; null for inline. */
  url: string | null;
  host: string | null;
  inline: boolean;
  isThirdParty: boolean;
  observedOn: string;
}

export interface RequestObservation {
  /** Origin + path only. Query and fragment are stripped at capture. */
  url: string;
  host: string;
  method: string;
  resourceType: string;
  status: number | null;
  isThirdParty: boolean;
  observedOn: string;
  failed: boolean;
}

export interface StorageObservation {
  kind: "local_storage" | "session_storage" | "indexed_db";
  /** Key or database name. Values are never read. */
  name: string;
  origin: string;
  observedOn: string;
}

export interface ConsentUiSignal {
  kind: "button_text" | "dom_pattern" | "known_cmp_script" | "known_cmp_cookie";
  detail: string;
}

export interface ConsentUiObservation {
  detected: boolean;
  signals: ConsentUiSignal[];
  observedOn: string | null;
}

export type Confidence = "high" | "medium" | "low";

export interface Evidence {
  type: "script" | "network_host" | "cookie" | "storage_key" | "dom";
  value: string;
}

export interface TechnologyFinding {
  detectorId: string;
  name: string;
  category: string;
  confidence: Confidence;
  evidence: Evidence[];
  /** Jurisdiction of the receiving organisation, from the shared catalogue. */
  destinationCountry: string | null;
  crossesBorder: boolean;
}

export interface ScanSummary {
  pagesDiscovered: number;
  pagesScanned: number;
  pagesFailed: number;
  cookiesFound: number;
  scriptsFound: number;
  requestsObserved: number;
  storageItemsFound: number;
  thirdPartyDomains: number;
  technologiesDetected: number;
  consentUiDetected: boolean;
  /** True when a limit stopped the crawl early, so counts are not "the whole site". */
  limitReached: string | null;
}

export interface ScanResult {
  startUrl: string;
  mode: ScanMode;
  crawlerVersion: string;
  startedAt: string;
  completedAt: string;
  limits: CrawlLimits;
  robots: { source: string; crawlDelaySeconds: number | null; disallowedSkipped: number };
  pages: PageObservation[];
  cookies: CookieObservation[];
  scripts: ScriptObservation[];
  requests: RequestObservation[];
  storage: StorageObservation[];
  consentUi: ConsentUiObservation;
  technologies: TechnologyFinding[];
  summary: ScanSummary;
}
