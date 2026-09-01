/**
 * The analytics read contract.
 *
 * A deliberately small, fixed set of metrics — not a query API. The platform's
 * job is consent and authorised data movement; analytics here exists so an
 * operator can confirm the SDK is working and see roughly what it is capturing.
 *
 * Note on "visitors": this API reports **sessions**, not unique visitors. There
 * is no persistent visitor identifier in the analytics domain — a session id
 * lives in `sessionStorage` and expires after 30 minutes of inactivity. The one
 * durable per-person identifier in the system is `Principal`, which belongs to
 * the consent domain and is deliberately never joined to analytics rows. Naming
 * a session count "visitors" would overstate what the data supports.
 */

export interface AnalyticsRange {
  /** Inclusive lower bound, ISO 8601. */
  from: string;
  /** Exclusive upper bound, ISO 8601. */
  to: string;
}

export interface AnalyticsTotals {
  /** Sessions started within the range. */
  sessions: number;
  page_views: number;
  custom_events: number;
  /** Every event type, including `session_start`. */
  total_events: number;
  /** Sites belonging to this organisation that recorded any event in range. */
  active_sites: number;
}

export interface TopPage {
  url: string;
  title: string;
  views: number;
}

/** One row of a categorical breakdown, e.g. a browser or a device type. */
export interface BreakdownEntry {
  key: string;
  events: number;
}

export interface SiteActivity {
  site_id: string;
  name: string;
  sessions: number;
  page_views: number;
  total_events: number;
}

export interface AnalyticsSummary {
  range: AnalyticsRange;
  totals: AnalyticsTotals;
  top_pages: TopPage[];
  devices: BreakdownEntry[];
  browsers: BreakdownEntry[];
  operating_systems: BreakdownEntry[];
  by_site: SiteActivity[];
}

/** Counts for the operational overview, across consent, authorisation and transfer. */
export interface PlatformOverview {
  sites: { total: number; active: number };
  consent: {
    total_decisions: number;
    granted: number;
    denied: number;
    withdrawn: number;
    /** Distinct principals who have recorded at least one decision. */
    principals: number;
  };
  authorisations: {
    total: number;
    authorised: number;
    consumed: number;
    expired: number;
  };
  transfers: {
    total: number;
    recorded: number;
    delivered: number;
    failed: number;
  };
  activity: AnalyticsTotals;
}
