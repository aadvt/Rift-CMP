/**
 * ─────────────────────────────────────────────────────────────────────────────
 * The Rift platform API, exactly as it is on the wire.
 *
 * These are snake_case because the API is snake_case. Nothing in this file is
 * shaped for a screen, and nothing in it is invented: every field below appears
 * in `shared/` in the platform repository, which is the authoritative contract.
 *
 * `adapters.ts` is the only file that reads these, and it is where the wire
 * shape becomes the product shape in `types.ts`. Keeping the two apart is what
 * makes a backend field rename a one-file change instead of a hunt through
 * every screen — and it is what stops a component quietly depending on a
 * platform detail it has no business knowing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface WireSite {
  site_id: string;
  organisation_id: string;
  name: string;
  domain: string;
  public_key: string;
  is_active: boolean;
  analytics_consent_purpose: string | null;
  allowed_origins: string[];
  created_at: string;
}

export type WireScanStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WireScanMetadata {
  scan_id: string;
  site_id: string;
  status: WireScanStatus;
  mode: string;
  start_url: string;
  crawler_version: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: { code: string; message: string } | null;
}

export interface WireScanSummary {
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
  /** Which limit stopped the crawl. When set, every count above is a floor. */
  limit_reached: string | null;
}

export interface WireEvidence {
  type: 'script' | 'network_host' | 'cookie' | 'storage_key' | 'dom';
  value: string;
}

export interface WireTechnology {
  detector_id: string;
  name: string;
  /** What it is normally used for. Explicitly not a legal category. */
  category: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: WireEvidence[];
  destination_country: string | null;
  crosses_border: boolean;
}

export interface WirePage {
  url: string;
  final_url: string | null;
  status: number | null;
  title: string | null;
  content_type: string | null;
  depth: number;
  rendered: boolean;
  error: string | null;
  duration_ms: number;
}

export interface WireCookie {
  name: string;
  domain: string;
  path: string;
  expires: string | null;
  secure: boolean;
  http_only: boolean;
  same_site: string | null;
  third_party: boolean;
}

export interface WireScript {
  url: string | null;
  host: string | null;
  inline: boolean;
  third_party: boolean;
  observed_on: string;
}

export interface WireRequest {
  host: string;
  resource_type: string;
  method: string;
  sample_path: string | null;
  third_party: boolean;
  request_count: number;
  failed_count: number;
  status: number | null;
}

export interface WireStorage {
  kind: string;
  name: string;
  origin: string;
}

export interface WireScanResults {
  scan: WireScanMetadata;
  summary: WireScanSummary;
  consent_ui: { detected: boolean; signals: Array<{ kind: string; detail: string }> };
  pages: WirePage[];
  cookies: WireCookie[];
  scripts: WireScript[];
  requests: WireRequest[];
  storage: WireStorage[];
  technologies: WireTechnology[];
}

export interface WireScanStatusResponse {
  scan: WireScanMetadata;
  summary: WireScanSummary;
}

export interface WireScanListResponse {
  scans: Array<WireScanMetadata & { summary: WireScanSummary }>;
}

export interface WireCreateScanResponse {
  scan: WireScanMetadata;
}

/* ── The consent autopilot ─────────────────────────────────────────────── */

export type WireRecommendedAction = 'allow' | 'require_consent' | 'block' | 'ignore' | 'review';

export interface WireRecommendationEvidence {
  kind: string;
  detail: string;
  requirement_id?: string;
  source_ids?: string[];
}

export interface WireRecommendation {
  detector_id: string;
  vendor_name: string;
  category: string;
  suggested_purpose: string | null;
  data_categories: string[];
  jurisdictions: string[];
  consent_requirement: 'required' | 'not_required' | 'conditional' | 'unknown';
  opt_out_requirement: 'required' | 'not_required' | 'unknown';
  recommended_action: WireRecommendedAction;
  /** Written by the policy layer. The dashboard renders it; it never rewrites it. */
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: WireRecommendationEvidence[];
  rule_references: string[];
  overridden: boolean;
  override_note: string | null;
  observed_in_latest_scan: boolean;
}

export interface WirePolicy {
  site_id: string;
  scan_id: string | null;
  jurisdictions: string[];
  regimes: string[];
  recommendations: WireRecommendation[];
  open_questions: Array<{ reason: string; detail: string }>;
  undeclared_purposes: string[];
  requires_approval: true;
  legal_advice: false;
}

export interface WirePolicyVersion {
  policy_version_id: string;
  site_id: string;
  version: number;
  status: 'draft' | 'approved' | 'superseded';
  scan_id: string | null;
  jurisdictions: string[];
  regimes: string[];
  approval_note: string | null;
  created_at: string;
  approved_at: string | null;
  recommendations: WireRecommendation[];
}

export interface WirePolicyResponse {
  policy: WirePolicy;
  active_version: WirePolicyVersion | null;
}

export interface WireOverride {
  detector_id: string;
  purpose_code: string | null;
  action: WireRecommendedAction;
  note: string | null;
  updated_at: string;
}

export interface WireOverrideListResponse {
  overrides: WireOverride[];
}

/* ── The proposal: what Rift suggests a site should declare ────────────── */

export interface WireProposedPurpose {
  suggested_code: string;
  suggested_name: string;
  suggested_description: string;
  already_declared: boolean;
  technologies: string[];
  evidence: WireRecommendationEvidence[];
  confidence: 'high' | 'medium' | 'low';
}

export interface WireProposal {
  site_id: string;
  scan_id: string | null;
  jurisdictions: string[];
  jurisdiction_confidence: Record<string, string>;
  regimes: string[];
  obligations: Array<{ verdict: string; requirement_id: string; regime: string; summary: string }>;
  open_questions: Array<{ reason: string; detail: string }>;
  purposes: WireProposedPurpose[];
  unmapped_technologies: Array<{ name: string; category: string; confidence: string }>;
  requires_review: true;
  legal_advice: false;
}

export interface WireProposalResponse {
  proposal: WireProposal;
}

/* ── The runtime configuration a visitor's banner renders ──────────────── */

export interface WirePurposeConfig {
  code: string;
  name: string;
  description: string;
  kind: 'essential' | 'optional';
  vendors: string[];
  order: number;
}

export interface WireEnforcementConfig {
  mode: 'off' | 'observe' | 'enforce';
  rules: Array<{
    host: string;
    vendor: string;
    purpose: string | null;
    action: 'allow' | 'require_consent' | 'block';
  }>;
  unknown_host: 'allow' | 'block';
}

export interface WireRuntimeConfig {
  site_id: string;
  config_version: string;
  purposes: WirePurposeConfig[];
  notice: {
    notice_id: string;
    version: string;
    locale: string;
    policy_version_id: string;
    document_url: string | null;
  } | null;
  text: {
    title: string | null;
    body: string | null;
    accept_all: string | null;
    reject_all: string | null;
    manage: string | null;
    save: string | null;
    policy_url: string | null;
  };
  enforcement: WireEnforcementConfig | null;
  /** False when no purpose is declared — a banner with nothing to offer. */
  ready: boolean;
}

/* ── Installation ──────────────────────────────────────────────────────── */

export interface WireInstall {
  site_id: string;
  public_key: string;
  script_url: string;
  api_origin: string;
  snippet: string;
  preferences_snippet: string;
  config_version: string;
  config_ready: boolean;
  policy_version: { version: number; approved_at: string | null } | null;
  /**
   * Evidence that this site's key has been used. Not a verdict about whether
   * the installation is correct — the words for that belong to the screen.
   */
  activity: {
    sessions: number;
    events: number;
    page_views: number;
    consent_decisions: number;
    first_event_at: string | null;
    last_event_at: string | null;
    last_consent_at: string | null;
  };
}

export interface WireInstallResponse {
  install: WireInstall;
}

/* ── Consent records and analytics ─────────────────────────────────────── */

export type WireConsentStatus = 'GRANTED' | 'DENIED' | 'WITHDRAWN' | 'EXPIRED' | 'PENDING';

export interface WireConsentRecord {
  consent_record_id: string;
  site_id: string;
  principal_external_id: string;
  purpose_code: string;
  status: WireConsentStatus;
  notice_id: string | null;
  policy_version_id: string | null;
  source: string;
  decided_at: string;
  recorded_at: string;
  metadata: Record<string, unknown> | null;
}

export interface WireConsentHistoryResponse {
  records: WireConsentRecord[];
}

export interface WireAnalyticsSummary {
  range: { from: string; to: string };
  totals: {
    sessions: number;
    page_views: number;
    custom_events: number;
    total_events: number;
    active_sites: number;
  };
  top_pages: Array<{ url: string; title: string; views: number }>;
  devices: Array<{ key: string; events: number }>;
  browsers: Array<{ key: string; events: number }>;
  operating_systems: Array<{ key: string; events: number }>;
  by_site: Array<{ site_id: string; name: string; sessions: number; page_views: number; total_events: number }>;
}

/* ── Scan-to-scan comparison ───────────────────────────────────────────── */

export type WireDiffKind = 'cookie' | 'script' | 'request' | 'storage' | 'technology';

export interface WireDiffEntry {
  kind: WireDiffKind;
  fingerprint: string;
  status: 'new' | 'removed' | 'changed' | 'unchanged';
  label: string;
  changedFields: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface WireDiffResponse {
  baseline_scan_id: string | null;
  compared_scan_id: string;
  baseline: WireScanMetadata | null;
  compared: WireScanMetadata;
  diff: {
    entries: WireDiffEntry[];
    totals: { new: number; removed: number; changed: number; unchanged: number };
    byKind: Record<WireDiffKind, { new: number; removed: number; changed: number; unchanged: number }>;
    legalAdvice: false;
  };
}

export interface WirePurpose {
  purpose_id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}
