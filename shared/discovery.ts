/**
 * The discovery contract.
 *
 * Discovery answers three questions a fiduciary has to be able to answer about
 * its own website: **what is running on my pages, where is it sending data, and
 * did any of it fire when consent said it should not.**
 *
 * It is deliberately *in-page* rather than crawler-based. A crawler visits a URL
 * once, logged out, and sees whatever loads for a robot. The SDK is already on
 * the page when real people use it, so it sees lazy-loaded tags, logged-in
 * states, and — the part a crawler structurally cannot do — whether a request
 * actually left the browser. That last property is what turns "we found this
 * tracker" into "this tracker fired while consent was withdrawn", which is
 * evidence rather than an inventory.
 *
 * ## What is deliberately never collected
 *
 * Discovery reports **hosts and paths, never query strings, fragments or request
 * bodies**. Those are exactly where identifiers and personal data live, and a
 * privacy product that hoovered them up while cataloguing trackers would be
 * doing the thing it exists to prevent. The SDK strips them before anything is
 * queued; the API rejects a payload that still contains them.
 *
 * Discovery is also **not joined to `Principal`**. A violation records that a
 * destination was contacted under a non-granted purpose, not which person was
 * on the page. Attributing violations to individuals would create a new
 * behavioural record about a person — the opposite of the point.
 */

/** How a destination was contacted. Mirrors `PerformanceResourceTiming.initiatorType`. */
export const COMPONENT_KINDS = [
  "script",
  "image",
  "iframe",
  "fetch",
  "xhr",
  "beacon",
  "stylesheet",
  "media",
  "font",
  "other",
] as const;

export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export const STORAGE_KINDS = ["cookie", "local_storage", "session_storage"] as const;

export type StorageKind = (typeof STORAGE_KINDS)[number];

/** One destination the page contacted, aggregated across the page view. */
export interface DiscoveredDestination {
  /** Hostname only. Never a full URL. */
  host: string;
  kind: ComponentKind;
  /**
   * The script the SDK could attribute the request to, as a hostname plus file
   * name — e.g. `www.googletagmanager.com/gtm.js`. Null when the browser gave no
   * usable stack, which is common for requests made by native page markup.
   */
  initiator: string | null;
  /** Path with query string and fragment already removed. Truncated. */
  sample_path: string | null;
  /** False when the host matches the page's own origin. */
  third_party: boolean;
  request_count: number;
  first_seen: string;
}

/** One storage key the page wrote, and who wrote it when that is knowable. */
export interface DiscoveredStorageItem {
  kind: StorageKind;
  /** Key or cookie name. Values are never collected. */
  name: string;
  writer: string | null;
  first_seen: string;
}

/**
 * A destination contacted while consent for its purpose was not granted.
 *
 * This is the claim the whole feature exists to support, so it is recorded as
 * its own row rather than derived later: the consent state at the moment of the
 * request is not reconstructable after the fact.
 */
export interface DiscoveredViolation {
  host: string;
  purpose_code: string;
  /** The effective status at the moment the request was observed. */
  consent_status: string;
  observed_at: string;
}

/** One page view's worth of observation, sent as a single batched report. */
export interface DiscoveryReport {
  site_id: string;
  /** Origin and path of the observed page. Query and fragment removed. */
  page_url: string;
  collected_at: string;
  schema_version: number;
  source: string;
  destinations: DiscoveredDestination[];
  storage: DiscoveredStorageItem[];
  violations: DiscoveredViolation[];
}

export interface DiscoveryReportResponse {
  destinations_recorded: number;
  storage_recorded: number;
  violations_recorded: number;
}

// ─── Read model ──────────────────────────────────────────────────────────────

/**
 * A destination after server-side classification.
 *
 * Classification happens on the server, not in the SDK: the catalogue changes
 * far more often than the tag, and shipping it to every visitor's browser would
 * mean a redeploy of customer websites every time a vendor is added.
 */
export interface ClassifiedComponent {
  host: string;
  kind: ComponentKind;
  initiator: string | null;
  sample_path: string | null;
  third_party: boolean;
  request_count: number;
  first_seen: string;
  last_seen: string;
  page_url: string;
  /** Known vendor name, or null when the host is not in the catalogue. */
  vendor: string | null;
  /** What the vendor is normally used for, e.g. `analytics`. Null when unknown. */
  category: string | null;
  /**
   * ISO 3166-1 alpha-2 country the destination is understood to terminate in,
   * or null when unknown. Present because DPDP treats transfer outside India as
   * a distinct question, so "where is this going" needs a geographic answer and
   * not only a vendor name.
   */
  destination_country: string | null;
  /** True when the destination country is known and is not India. */
  crosses_border: boolean;
}

export interface DiscoveryInventory {
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
  components: ClassifiedComponent[];
  storage: DiscoveredStorageItem[];
  violations: DiscoveredViolation[];
}
