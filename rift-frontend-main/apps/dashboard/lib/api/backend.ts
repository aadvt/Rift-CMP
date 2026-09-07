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
  /**
   * What evidence the record carries. Not a verification result — checking a
   * proof needs the public key ring, which happens at `/consent/proof/verify`.
   */
  proof?: {
    receipt_hash: string | null;
    signed: boolean;
    key_id: string | null;
    sequence: number | null;
  };
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

/* ── Phase A: consent intelligence ───────────────────────────────────────── */

export interface WireConsentBreakdownRow {
  key: string | null;
  label: string;
  granted: number;
  denied: number;
  withdrawn: number;
  total: number;
  acceptance_rate: number | null;
}

export interface WireUnavailableDimension {
  dimension: string;
  reason: string;
}

export interface WireConsentAnalytics {
  range: { from: string; to: string };
  totals: { decisions: number; granted: number; denied: number; withdrawn: number; principals: number };
  rates: {
    acceptance_rate: number | null;
    rejection_rate: number | null;
    partial_rate: number | null;
    withdrawal_rate: number | null;
    principals: number;
  };
  by_purpose: WireConsentBreakdownRow[];
  by_jurisdiction: WireConsentBreakdownRow[];
  by_policy_version: WireConsentBreakdownRow[];
  by_mechanism: WireConsentBreakdownRow[];
  by_vendor: WireConsentBreakdownRow[];
  by_site: WireConsentBreakdownRow[];
  trend: Array<{ day: string; granted: number; denied: number; withdrawn: number }>;
  unavailable_dimensions: WireUnavailableDimension[];
}

export interface WireQualityComponent {
  id: string;
  label: string;
  ratio: number | null;
  weight: number;
  earned: number;
  applicable: boolean;
  detail: string;
  remedy: string | null;
}

export interface WireQuality {
  site_id: string;
  score: number;
  band: 'strong' | 'fair' | 'weak';
  components: WireQualityComponent[];
  not_applicable: string[];
  weight_considered: number;
  computed_at: string;
  legal_advice: false;
}

export interface WireFindingEvidence {
  source: 'scan' | 'runtime' | 'policy';
  detail: string;
  scan_id?: string;
  observed_at?: string;
}

export interface WireShadowTracker {
  id: string;
  host: string;
  vendor: string | null;
  category: string | null;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  pages: string[];
  destination_country: string | null;
  crosses_border: boolean;
  confidence: 'high' | 'medium' | 'low';
  approved: boolean;
  purpose: string | null;
  policy_action: string | null;
  evidence: WireFindingEvidence[];
  recommended_action: string;
  first_seen: string | null;
  last_seen: string | null;
}

export interface WireDriftFinding {
  id: string;
  kind: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  host: string | null;
  vendor: string | null;
  page: string | null;
  previous_state: string | null;
  current_state: string;
  policy_version: number | null;
  evidence: WireFindingEvidence[];
  recommended_action: string;
}

export interface WireSiteIntelligence {
  site_id: string;
  generated_at: string;
  scan_id: string | null;
  baseline_scan_id: string | null;
  shadow_trackers: WireShadowTracker[];
  drift: WireDriftFinding[];
  legal_advice: false;
}

export interface WirePageIntelligence {
  url: string;
  title: string | null;
  status: number | null;
  components: Array<{
    host: string;
    vendor: string | null;
    category: string | null;
    third_party: boolean;
    confidence: 'high' | 'medium' | 'low';
    attribution: 'observed' | 'configured' | 'inferred' | 'enforced' | 'unknown';
    observed_as: string;
    purpose: string | null;
    policy_action: string | null;
    consent_required: string | null;
    enforcement: string | null;
    destination_country: string | null;
    crosses_border: boolean;
  }>;
  cookies: Array<{ name: string; domain: string; third_party: boolean; attribution: string }>;
  purposes: string[];
  data_categories: string[];
  jurisdictions: string[];
  policy_version: number | null;
  shadow_trackers: WireShadowTracker[];
  drift: WireDriftFinding[];
  unresolved: Array<{ host: string; confidence: 'high' | 'medium' | 'low' }>;
  summary: { components: number; third_party: number; needs_review: number };
}

/**
 * The advisory layer, kept structurally separate.
 *
 * `ai` and `ai_summary` are nullable on purpose and are the only fields a model
 * ever touches. The deterministic `recommendation` travels beside them
 * untouched, so a screen can render the decision with the commentary absent and
 * lose nothing that matters.
 */
export interface WireAiNote {
  provider: string;
  model: string;
  advisory: true;
  suggested_category: string | null;
  reasoning: string;
  confidence: number;
  ambiguous: boolean;
}

export interface WireEnrichedRecommendation {
  recommendation: WireRecommendation;
  priority: number;
  priority_reason: string;
  shadow_trackers: WireShadowTracker[];
  drift: WireDriftFinding[];
  observed_on_pages: string[];
  ai: WireAiNote | null;
}

export interface WireAutopilotIntelligence {
  site_id: string;
  generated_at: string;
  recommendations: WireEnrichedRecommendation[];
  ai_summary: {
    provider: string;
    model: string;
    advisory: true;
    summary: string;
    ambiguities: string[];
    confidence: number;
  } | null;
  ai_configured: boolean;
  /** Always true. Nothing here is applied without a person approving it. */
  requires_approval: true;
  legal_advice: false;
}

// ─── Phase 11B: enforcement and proof ────────────────────────────────────────

export interface WireEnforcementEvent {
  id: string;
  site_id: string;
  occurred_at: string;
  /** "client" or "server". They are not equivalent controls. */
  source: string;
  destination_host: string | null;
  vendor: string | null;
  purpose: string | null;
  decision: string;
  effect: string;
  observed_only: boolean;
  policy_version: string | null;
  matched_rule: { host?: string; action?: string } | null;
  reason: string;
  severity: string;
  /** Rule ids and paths. Never values. */
  redactions: Array<{ rule: string; location: string; path: string }> | null;
}

export interface WireEnforcementHistory {
  events: WireEnforcementEvent[];
  summary: {
    by_decision: Record<string, number>;
    observed_only: number;
    blocked: number;
    redacted: number;
    needs_review: number;
    total: number;
    destinations: number;
  };
  /**
   * What the log does and does not cover.
   *
   * Rendered beside the counts rather than filed in documentation, because a
   * count of blocked requests reads as completeness unless something says
   * otherwise.
   */
  coverage: {
    client_enforcement: string;
    server_enforcement: string;
    not_covered: string[];
  };
}

export interface WireProofVerification {
  ok: boolean;
  version: string;
  malformed: string | null;
  unsupported_version: boolean;
  integrity: 'valid' | 'invalid' | null;
  signature: 'valid' | 'invalid' | 'unsigned' | 'unknown_key' | 'revoked_key' | null;
  key_id: string | null;
  chain: 'valid' | 'broken' | 'unverifiable' | null;
  findings: string[];
}

// ─── Phase 3: consent experiments ────────────────────────────────────────────

export interface WireExperimentVariant {
  variant_id: string;
  key: string;
  name: string;
  description: string | null;
  allocation: number;
  /** Display copy only. There is no other kind of override. */
  text: Record<string, string | null> | null;
  is_control: boolean;
}

export interface WireExperiment {
  experiment_id: string;
  site_id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  starts_at: string | null;
  ends_at: string | null;
  policy_version_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  variants: WireExperimentVariant[];
  /** Status and window together — whether it is assigning arms right now. */
  serving: boolean;
}

export interface WireVariantMetrics {
  variant_key: string;
  variant_name: string;
  is_control: boolean;
  allocation: number;
  impressions: number;
  deciders: number;
  accepted_all: number;
  rejected_all: number;
  partial: number;
  withdrew: number;
  /** Null when nobody has decided. Never zero — those are different findings. */
  acceptance_rate: number | null;
  rejection_rate: number | null;
  partial_rate: number | null;
  withdrawal_rate: number | null;
  completion_rate: number | null;
  by_purpose: Array<{
    purpose_code: string;
    granted: number;
    denied: number;
    rate: number | null;
  }>;
}

export interface WireSignificance {
  reading: 'observed_difference' | 'significant' | 'not_significant';
  method: string | null;
  confidence_level: number | null;
  z: number | null;
  p_value: number | null;
  difference: number | null;
  interval: { lower: number; upper: number } | null;
  sample: { control: number; variant: number };
  note: string | null;
}

export interface WireExperimentComparison {
  experiment_id: string;
  name: string;
  status: string;
  site_id: string;
  policy_version_id: string | null;
  range: { from: string; to: string };
  control_key: string | null;
  variants: WireVariantMetrics[];
  posture: Record<
    string,
    {
      shadow_trackers: number;
      drift_findings: number;
      enforcement_events: number;
      enforcement_blocked: number;
      /** Usually false: scans and enforcement are site-wide, not per arm. */
      attributable_to_variant: boolean;
    }
  >;
  significance: Record<string, Record<string, WireSignificance>>;
  caveats: string[];
}

export interface WirePolicyComparison {
  site_id: string;
  versions: Array<{
    policy_version_id: string;
    version: number;
    approved_at: string | null;
    decisions: number;
    principals: number;
    acceptance_rate: number | null;
    rejection_rate: number | null;
    partial_rate: number | null;
    withdrawal_rate: number | null;
    shadow_trackers: number | null;
    drift_findings: number | null;
  }>;
  changes: Array<{
    from_version: number;
    to_version: number;
    metric: string;
    from: number | null;
    to: number | null;
    /** Observed, never causal. A version ships alongside everything else. */
    observed_change: number | null;
  }>;
  caveats: string[];
}

// ─── Phase D: graph and simulation ───────────────────────────────────────────

export type WireProvenance = 'OBSERVED' | 'CONFIGURED' | 'ENFORCED' | 'INFERRED' | 'UNKNOWN';

export interface WireEvidenceRef {
  source: string;
  ref: string | null;
  detail: string;
  observed_at?: string | null;
}

export interface WireGraphNode {
  id: string;
  kind: string;
  label: string;
  sublabel: string | null;
  /** How firmly this is known. Never decoration — see the graph docs. */
  provenance: WireProvenance;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | null;
  evidence: WireEvidenceRef[];
  attributes: Record<string, string | number | boolean | null>;
}

export interface WireGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: string;
  label: string;
  provenance: WireProvenance;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | null;
  evidence: WireEvidenceRef[];
}

export interface WireConsentGraph {
  site_id: string;
  generated_at: string;
  scan_id: string | null;
  policy_version: string | null;
  nodes: WireGraphNode[];
  edges: WireGraphEdge[];
  /** Said out loud, because a capped graph reads as a complete one. */
  truncated: { nodes: boolean; edges: boolean; reason: string | null };
  totals: Record<string, number>;
  caveats: string[];
}

export interface WireGraphNodeDetail {
  node: WireGraphNode;
  neighbours: Array<{ edge: WireGraphEdge; node: WireGraphNode; direction: 'out' | 'in' }>;
  simulations: Array<{ operation: string; label: string; description: string }>;
}

export interface WireSimulation {
  /** Always true on the wire, so no consumer can lose it. */
  hypothetical: true;
  scenario_name: string;
  site_id: string;
  base_policy_version: string | null;
  base_scan_id: string | null;
  generated_at: string;
  changes: Array<Record<string, string | undefined>>;
  inventory: { trackers: number; vendors: number; destinations: number; added: string[]; removed: string[] };
  consent: {
    purposes_affected: string[];
    requirements: Array<{ vendor: string; from: string | null; to: string; reason: string }>;
  };
  jurisdiction: { before: string[]; after: string[]; added: string[]; removed: string[]; regimes: string[] };
  enforcement: { current: string; simulated: string; rules_before: number; rules_after: number };
  intelligence: {
    shadow_before: number;
    shadow_after: number;
    drift_before: number;
    drift_after: number;
    new_shadow: Array<{ host: string; vendor: string | null; severity: string; reason: string }>;
  };
  quality: {
    current_score: number;
    current_band: string;
    /** Hypothetical. Never to be rendered as a production score. */
    simulated_score: number;
    simulated_band: string;
    components: Array<{ id: string; label: string; before: number; after: number }>;
  };
  findings: Array<{ severity: string; area: string; summary: string; because: string }>;
  unsupported: Array<{ change: Record<string, string | undefined>; reason: string }>;
  caveats: string[];
}

// ─── Phase 11A ───────────────────────────────────────────────────────────────
//
// `shared/discovery.ts` and `shared/transfer.ts`, restated in wire form like
// everything else here. The consent-analytics wire types were already declared
// above — they had simply never been read by a screen.





/** `shared/discovery.ts` — a destination after server-side classification. */
export interface WireClassifiedComponent {
  host: string;
  kind: string;
  initiator: string | null;
  sample_path: string | null;
  third_party: boolean;
  request_count: number;
  first_seen: string;
  last_seen: string;
  page_url: string;
  vendor: string | null;
  category: string | null;
  /** ISO 3166-1 alpha-2, or null when unknown. */
  destination_country: string | null;
  crosses_border: boolean;
}

export interface WireDiscoveredStorageItem {
  kind: 'cookie' | 'local_storage' | 'session_storage';
  name: string;
  writer: string | null;
  first_seen: string;
}

/**
 * A destination contacted while consent for its purpose was not granted.
 *
 * The claim the whole discovery feature exists to support. Recorded as its own
 * row because the consent state at the moment of the request is not
 * reconstructable after the fact.
 */
export interface WireDiscoveredViolation {
  host: string;
  purpose_code: string;
  consent_status: string;
  observed_at: string;
}

export interface WireDiscoveryInventory {
  site_id: string;
  generated_at: string;
  totals: {
    destinations: number;
    third_party: number;
    unclassified: number;
    cross_border: number;
    storage_items: number;
    open_violations: number;
  };
  components: WireClassifiedComponent[];
  storage: WireDiscoveredStorageItem[];
  violations: WireDiscoveredViolation[];
}

/** `shared/transfer.ts` — routing metadata for a completed transfer. No payload. */
export interface WireTransferRecord {
  transfer_id: string;
  authorisation_id: string;
  site_id: string;
  purpose_code: string;
  recipient_code: string;
  principal_external_id: string;
  consent_record_id: string;
  status: 'RECORDED' | 'DELIVERED' | 'FAILED';
  ciphertext_sha256: string;
  payload_bytes: number;
  recorded_at: string;
  delivered_at: string | null;
}

export interface WireRecipient {
  recipient_id: string;
  code: string;
  name: string;
  public_key: string;
  algorithm: string;
  is_active: boolean;
  created_at: string;
}

/** `shared/consent-firewall.ts` — one evaluated request. */
export interface WireFirewallEvidence {
  /** `policy` | `consent` | `catalogue` | `config` */
  source: string;
  detail: string;
}

export interface WireFirewallDecision {
  decision: 'ALLOW' | 'BLOCK' | 'REDACT' | 'REQUIRE_CONSENT' | 'REVIEW';
  /** What happens to the request. REVIEW and ALLOW both allow. */
  effect: 'allow' | 'block';
  destination_host: string | null;
  vendor: string | null;
  purpose: string | null;
  /** The visitor's state for the gating purpose, or `n/a`. */
  user_state: string;
  matched_rule: { host: string; vendor: string; purpose: string | null; action: string } | null;
  policy_version: string | null;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  evidence: WireFirewallEvidence[];
  /** Rule ids applied. Ids only — never a value. */
  redactions: string[];
  /** True when the deciding policy is in `observe` mode, so the effect was
   *  recorded rather than applied. An observed BLOCK did not block anything. */
  observed_only: boolean;
  source: string;
}

export interface WireFirewallEvaluation {
  decision: WireFirewallDecision;
  redaction_applied: string[];
  would_send: boolean;
  config_problems: string[];
  legal_advice: false;
}

/** `shared/consent-proof.ts` — the receipt for one consent record. */
export interface WireConsentProof {
  proof: string;
  evidence: {
    site_id: string;
    principal_external_id: string;
    purpose_code: string;
    status: string;
    decided_at: string;
    notice_id: string | null;
    policy_version_id: string | null;
    policy_config_version: string | null;
    jurisdictions: string[];
    vendors: string[];
    mechanism: string | null;
    source: string;
  };
  /** The identifier, never the key. */
  key_id: string | null;
  /** The limits, stated on the proof so they travel with it. */
  caveat: string;
  legal_advice: false;
}
