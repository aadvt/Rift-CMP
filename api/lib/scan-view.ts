import type {
  ConfidenceContract,
  ScanEvidence,
  ScanMetadata,
  ScanModeContract,
  ScanResultsResponse,
  ScanStatusContract,
  ScanSummaryContract,
} from "@rift-cmp/shared";

/**
 * Projects scan rows onto the wire contract.
 *
 * Kept out of the route handlers so all three scan endpoints answer with the
 * same shape, and so the snake_case boundary lives in one file rather than
 * being re-derived per route.
 *
 * This layer performs no classification. It renames fields and nothing else:
 * anything that looks like a judgement here would be a judgement made twice,
 * once in the detector and once on the way out.
 */

interface ScanRow {
  id: string;
  siteId: string;
  status: string;
  mode: string;
  startUrl: string;
  crawlerVersion: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
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
  consentUiSignals: unknown;
  limitReached: string | null;
}

export function toScanMetadata(scan: ScanRow): ScanMetadata {
  return {
    scan_id: scan.id,
    site_id: scan.siteId,
    status: scan.status as ScanStatusContract,
    mode: scan.mode as ScanModeContract,
    start_url: scan.startUrl,
    crawler_version: scan.crawlerVersion,
    created_at: scan.createdAt.toISOString(),
    started_at: scan.startedAt?.toISOString() ?? null,
    completed_at: scan.completedAt?.toISOString() ?? null,
    error: scan.errorCode
      ? { code: scan.errorCode, message: scan.errorMessage ?? "" }
      : null,
  };
}

export function toScanSummary(scan: ScanRow): ScanSummaryContract {
  return {
    pages_discovered: scan.pagesDiscovered,
    pages_scanned: scan.pagesScanned,
    pages_failed: scan.pagesFailed,
    cookies_found: scan.cookiesFound,
    scripts_found: scan.scriptsFound,
    requests_observed: scan.requestsObserved,
    storage_items_found: scan.storageItemsFound,
    third_party_domains: scan.thirdPartyDomains,
    technologies_detected: scan.technologiesDetected,
    consent_ui_detected: scan.consentUiDetected,
    limit_reached: scan.limitReached,
  };
}

interface ScanWithObservations extends ScanRow {
  pages: Array<{
    url: string;
    finalUrl: string | null;
    status: number | null;
    title: string | null;
    contentType: string | null;
    depth: number;
    rendered: boolean;
    error: string | null;
    durationMs: number;
  }>;
  cookies: Array<{
    name: string;
    domain: string;
    path: string;
    expires: Date | null;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string | null;
    isThirdParty: boolean;
  }>;
  scripts: Array<{
    url: string | null;
    host: string | null;
    inline: boolean;
    isThirdParty: boolean;
    observedOn: string;
  }>;
  requests: Array<{
    host: string;
    resourceType: string;
    method: string;
    samplePath: string | null;
    isThirdParty: boolean;
    requestCount: number;
    failedCount: number;
    status: number | null;
  }>;
  storage: Array<{ kind: string; name: string; origin: string }>;
  technologies: Array<{
    detectorId: string;
    name: string;
    category: string;
    confidence: string;
    evidence: unknown;
    destinationCountry: string | null;
    crossesBorder: boolean;
  }>;
}

export function toScanResults(scan: ScanWithObservations): ScanResultsResponse {
  return {
    scan: toScanMetadata(scan),
    summary: toScanSummary(scan),
    consent_ui: {
      detected: scan.consentUiDetected,
      signals: Array.isArray(scan.consentUiSignals)
        ? (scan.consentUiSignals as Array<{ kind: string; detail: string }>)
        : [],
    },
    pages: scan.pages.map((page) => ({
      url: page.url,
      final_url: page.finalUrl,
      status: page.status,
      title: page.title,
      content_type: page.contentType,
      depth: page.depth,
      rendered: page.rendered,
      error: page.error,
      duration_ms: page.durationMs,
    })),
    cookies: scan.cookies.map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires?.toISOString() ?? null,
      secure: cookie.secure,
      http_only: cookie.httpOnly,
      same_site: cookie.sameSite,
      third_party: cookie.isThirdParty,
    })),
    scripts: scan.scripts.map((script) => ({
      url: script.url,
      host: script.host,
      inline: script.inline,
      third_party: script.isThirdParty,
      observed_on: script.observedOn,
    })),
    requests: scan.requests.map((request) => ({
      host: request.host,
      resource_type: request.resourceType,
      method: request.method,
      sample_path: request.samplePath,
      third_party: request.isThirdParty,
      request_count: request.requestCount,
      failed_count: request.failedCount,
      status: request.status,
    })),
    storage: scan.storage.map((item) => ({
      kind: item.kind,
      name: item.name,
      origin: item.origin,
    })),
    technologies: scan.technologies.map((technology) => ({
      detector_id: technology.detectorId,
      name: technology.name,
      category: technology.category,
      confidence: technology.confidence as ConfidenceContract,
      evidence: Array.isArray(technology.evidence)
        ? (technology.evidence as ScanEvidence[])
        : [],
      destination_country: technology.destinationCountry,
      crosses_border: technology.crossesBorder,
    })),
  };
}
