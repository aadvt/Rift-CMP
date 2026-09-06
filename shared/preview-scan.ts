/**
 * The scan a stranger can run, before there is an account.
 *
 * ## Why this exists separately from a real scan
 *
 * A real scan belongs to a site, a site belongs to an organisation, and an
 * organisation belongs to somebody. That chain is what makes a scan evidence:
 * it has an owner who can be shown it, and a history it sits in.
 *
 * A visitor on the landing page has none of that. The options were to create an
 * organisation for them before they asked for one — which produces orphan rows,
 * or quietly makes an account somebody never agreed to — or to run a scan that
 * belongs to nobody and is kept nowhere.
 *
 * This is the second. A preview scan **persists nothing**: no site, no scan row,
 * no observations, no organisation. It runs, it answers, and it is gone. What a
 * visitor sees is real — a genuine crawl of their own site — and what the
 * database records about it is nothing at all.
 *
 * ## Why the numbers are smaller than a real scan's
 *
 * A few pages, a short budget, no queue. Somebody waiting on a landing page will
 * not wait two minutes, and a public endpoint that launches an unbounded browser
 * crawl per request is a way to have the server attacked with its own feature.
 * So the preview is deliberately shallow, and says so rather than presenting a
 * three-page sample as though it were the whole site.
 */

export interface PreviewScanRequest {
  url: string;
}

/** One technology the preview found, with what the catalogue knows about it. */
export interface PreviewTechnology {
  name: string;
  /** What it is normally used for. Not a legal category. */
  category: string;
  confidence: "high" | "medium" | "low";
  /** Where the operator is, when the catalogue knows. */
  destination_country: string | null;
  crosses_border: boolean;
  /**
   * Whether this would need consent under a typical European reading.
   *
   * Deliberately hedged. The real answer depends on the markets the operator
   * declares and the purposes they run, and neither exists yet for somebody who
   * has not signed up — so this is a likelihood shown to prompt a question,
   * never a finding, and the wire name says so.
   */
  likely_needs_consent: boolean;
}

export interface PreviewScanResult {
  url: string;
  scanned_at: string;
  /** Seconds the crawl actually took, so "that was quick" is checkable. */
  duration_ms: number;

  summary: {
    pages_scanned: number;
    cookies: number;
    third_party_domains: number;
    technologies: number;
    /** Of those technologies, how many would typically be gated. */
    likely_need_consent: number;
    /** Whether the site already shows a consent interface. */
    consent_ui_detected: boolean;
  };

  technologies: PreviewTechnology[];
  /** Third-party hosts the pages actually contacted. */
  destinations: Array<{ host: string; country: string | null; crosses_border: boolean }>;
  /** Cookie names and domains only. No values, ever. */
  cookies: Array<{ name: string; domain: string; third_party: boolean }>;
  pages: string[];

  /**
   * What this preview is not.
   *
   * Carried on the response rather than written into the page, so the limits
   * travel with the numbers wherever they are rendered. A visitor who reads
   * "3 trackers" and believes that is their whole site has been misled by the
   * absence of this.
   */
  limits: {
    /** True when a cap stopped the crawl before it ran out of pages. */
    truncated: boolean;
    note: string;
  };

  legal_advice: false;
}

export interface PreviewScanResponse {
  scan: PreviewScanResult;
}

/**
 * Scanner categories that ordinarily need consent in the EU.
 *
 * A heuristic for a preview, and nothing more. The real answer comes from the
 * policy engine once an operator has declared their markets and purposes, and
 * this exists only so a stranger can see *why* the question matters. Anything
 * not listed is left alone rather than guessed at in the permissive direction.
 */
const TYPICALLY_GATED = new Set([
  "analytics",
  "advertising",
  "marketing",
  "session_replay",
  "social",
  "personalisation",
  "customer_data_platform",
  "tag_management",
  "ab_testing",
]);

export function likelyNeedsConsent(category: string): boolean {
  return TYPICALLY_GATED.has(category.toLowerCase());
}

export const PREVIEW_NOTE =
  "A preview reads a few pages, once. It is a genuine crawl of your site, not a sample of somebody else's — but it is not the whole site, and a tracker that did not run during it will not appear here.";
