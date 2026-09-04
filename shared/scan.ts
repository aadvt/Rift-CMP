/**
 * The scan contract.
 *
 * This is the interface between the crawler (Person 1) and everything that
 * consumes its output — the onboarding flow, and eventually the consent and
 * compliance layer (Person 2).
 *
 * ## The one rule this contract exists to enforce
 *
 * **Scanner output is evidence about what was observed, not a legal
 * determination.** Nothing in these types says a cookie requires consent, is
 * lawful, or falls into a regulatory category. A `ScanTechnology` says "we
 * believe this is Google Analytics, at this confidence, because of this
 * evidence". What that obliges a site to do is a question for the compliance
 * layer, working from the requirement matrix in `docs/regulations/`, and it is
 * deliberately not answerable from this file.
 *
 * Mixing the two would be convenient and wrong: a classification with a legal
 * conclusion baked in cannot be re-evaluated when the law changes, and cannot
 * be corrected by a customer who knows their own stack better than a pattern
 * match does.
 *
 * ## What a scan does and does not prove
 *
 * A scan observes a site **in one state, at one moment, logged out**. It does
 * not prove what happens after consent is granted, for a signed-in user, or on
 * a page it never reached. `ScanSummaryContract.limit_reached` says when the
 * crawl stopped early, so a count can be read as the floor it is rather than as
 * a total.
 *
 * This is the mirror image of in-page discovery (`shared/discovery.ts`), which
 * sees production traffic but needs the tag installed. Neither replaces the
 * other, and `docs/crawler.md` sets out why both exist.
 */

export const SCAN_STATUSES = ["queued", "running", "completed", "failed", "cancelled"] as const;
export type ScanStatusContract = (typeof SCAN_STATUSES)[number];

/**
 * The consent state a scan ran under.
 *
 * Only `baseline` is implemented in this phase. The rest are declared now so
 * every observation is stamped with the state it was made in from the first
 * row; adding the field later would leave existing rows ambiguous about what
 * they actually witnessed.
 */
export const SCAN_MODES = ["baseline", "necessary_only", "analytics", "advertising", "all"] as const;
export type ScanModeContract = (typeof SCAN_MODES)[number];

export type ConfidenceContract = "high" | "medium" | "low";

export interface ScanEvidence {
  type: "script" | "network_host" | "cookie" | "storage_key" | "dom";
  value: string;
}

export interface ScanMetadata {
  scan_id: string;
  site_id: string;
  status: ScanStatusContract;
  mode: ScanModeContract;
  start_url: string;
  crawler_version: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  /** Present only when `status` is `failed`. */
  error: { code: string; message: string } | null;
}

export interface ScanPageContract {
  url: string;
  final_url: string | null;
  status: number | null;
  title: string | null;
  content_type: string | null;
  depth: number;
  rendered: boolean;
  /** Short machine-ish reason. Null when the page rendered. */
  error: string | null;
  duration_ms: number;
}

/** Cookie **metadata**. There is no value field, by design. */
export interface ScanCookieContract {
  name: string;
  domain: string;
  path: string;
  expires: string | null;
  secure: boolean;
  http_only: boolean;
  same_site: string | null;
  third_party: boolean;
}

export interface ScanScriptContract {
  url: string | null;
  host: string | null;
  inline: boolean;
  third_party: boolean;
  observed_on: string;
}

/** Network metadata, aggregated per host. No headers, bodies or query strings. */
export interface ScanRequestContract {
  host: string;
  resource_type: string;
  method: string;
  sample_path: string | null;
  third_party: boolean;
  request_count: number;
  failed_count: number;
  status: number | null;
}

/** Storage **key names**. Values are never read. */
export interface ScanStorageContract {
  kind: string;
  name: string;
  origin: string;
}

/**
 * A technology the detectors identified.
 *
 * `evidence` is required, not optional. An onboarding UI must be able to answer
 * "why did you detect this?", and a classification a customer cannot
 * interrogate is one they cannot correct.
 */
export interface ScanTechnologyContract {
  detector_id: string;
  name: string;
  /** What the technology is normally used for. Not a legal category. */
  category: string;
  confidence: ConfidenceContract;
  evidence: ScanEvidence[];
  destination_country: string | null;
  crosses_border: boolean;
}

export interface ScanSummaryContract {
  pages_discovered: number;
  pages_scanned: number;
  pages_failed: number;
  cookies_found: number;
  scripts_found: number;
  requests_observed: number;
  storage_items_found: number;
  third_party_domains: number;
  technologies_detected: number;
  consent_ui_detected: boolean;
  /**
   * Which limit stopped the crawl, or null if it finished naturally.
   * When set, every count above is a floor rather than a total.
   */
  limit_reached: string | null;
}

/** Response of `POST /api/v1/sites/{siteId}/scans`. */
export interface CreateScanResponse {
  scan: ScanMetadata;
}

/** Response of `GET /api/v1/scans/{scanId}` — status and counts, no observations. */
export interface ScanStatusResponse {
  scan: ScanMetadata;
  summary: ScanSummaryContract;
}

/** Response of `GET /api/v1/scans/{scanId}/results`. */
export interface ScanResultsResponse {
  scan: ScanMetadata;
  summary: ScanSummaryContract;
  /** Why a consent interface was believed present. Empty when none was found. */
  consent_ui: { detected: boolean; signals: Array<{ kind: string; detail: string }> };
  pages: ScanPageContract[];
  cookies: ScanCookieContract[];
  scripts: ScanScriptContract[];
  requests: ScanRequestContract[];
  storage: ScanStorageContract[];
  technologies: ScanTechnologyContract[];
}

export interface ScanListResponse {
  scans: Array<ScanMetadata & { summary: ScanSummaryContract }>;
}
