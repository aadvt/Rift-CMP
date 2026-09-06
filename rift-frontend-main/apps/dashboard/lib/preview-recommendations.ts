import type { ChipTone } from '@rift/ui';

/**
 * Turning a preview scan into things somebody could actually do.
 *
 * ## Why this is not the policy engine
 *
 * The real recommendations come from the policy engine, which reads a matrix of
 * sourced requirements against the markets an operator has declared. A visitor
 * on the landing page has declared nothing, so none of that is available, and
 * inventing a lightweight copy of it here would produce a second set of answers
 * that quietly disagrees with the product.
 *
 * What this does instead is describe the observation in the imperative. "Two
 * advertising tags load before anything asks" is a fact from the crawl; "gate
 * them" is that same fact phrased as the thing to do about it. No rule is
 * evaluated, no regime is named as requiring anything, and nothing here is
 * conditioned on where the visitor's business operates — because that is
 * unknown.
 *
 * ## Wording
 *
 * Every step is hedged where it needs to be ("ordinarily", "typically") and
 * none is phrased as a legal obligation. The strongest verb available is
 * "check". A page that told a stranger they are in breach of something would be
 * making a claim about their business that three pages of crawling cannot
 * support.
 */

export interface PreviewTechnology {
  name: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  destination_country: string | null;
  crosses_border: boolean;
  likely_needs_consent: boolean;
}

export interface PreviewScanResult {
  url: string;
  scanned_at: string;
  duration_ms: number;
  summary: {
    pages_scanned: number;
    cookies: number;
    third_party_domains: number;
    technologies: number;
    likely_need_consent: number;
    consent_ui_detected: boolean;
  };
  technologies: PreviewTechnology[];
  destinations: Array<{ host: string; country: string | null; crosses_border: boolean }>;
  cookies: Array<{ name: string; domain: string; third_party: boolean }>;
  pages: string[];
  limits: { truncated: boolean; note: string };
  legal_advice: false;
}

export interface Recommendation {
  title: string;
  body: string;
  /** Roughly what it costs to do, so a list of five is triageable. */
  effort: string;
  tone: ChipTone;
}

/** At most this many, because a list nobody finishes reading recommends nothing. */
const MAX_STEPS = 4;

export function recommend(scan: PreviewScanResult): Recommendation[] {
  const s = scan.summary;
  const steps: Recommendation[] = [];

  /**
   * A crawl that finished no pages has not found "nothing" — it has found out
   * nothing, and those are opposite results.
   *
   * A site slower than the preview's twelve-second navigation budget can still
   * emit requests and cookies while never completing a page load, which yields
   * a plausible-looking handful of observations and a page count of zero.
   * Recommending anything on that basis would be advice derived from a failed
   * measurement, so the only honest recommendation is to measure again.
   */
  if (s.pages_scanned === 0) {
    return [
      {
        title: 'Scan again — this one did not finish',
        body: 'No page finished loading inside the preview’s budget, so anything above is a partial picture rather than a small one. A slow first response or a redirect chain is the usual cause.',
        effort: 'Try once more',
        tone: 'warning',
      },
    ];
  }

  const gated = scan.technologies.filter((t) => t.likely_needs_consent);
  const crossBorder = scan.destinations.filter((d) => d.crosses_border);
  const thirdPartyCookies = scan.cookies.filter((c) => c.third_party);

  // Ordered by what would change the most if it were wrong, not by severity in
  // the abstract: tracking that runs before anyone agrees is the finding that
  // makes the others matter.
  if (gated.length > 0 && !s.consent_ui_detected) {
    steps.push({
      title: 'Gate the tracking that runs on load',
      body: `${describe(gated)} started before anything asked. These categories ordinarily need consent first in the EU, the UK and under India's DPDP Act.`,
      effort: 'Highest impact',
      tone: 'error',
    });
  } else if (gated.length > 0 && s.consent_ui_detected) {
    steps.push({
      title: 'Check the banner actually blocks anything',
      body: `A consent interface is present and ${describe(gated)} still loaded during the scan. A banner that records a choice without enforcing it is the most common gap Rift finds.`,
      effort: 'Highest impact',
      tone: 'warning',
    });
  }

  if (crossBorder.length > 0) {
    const countries = [...new Set(crossBorder.map((d) => d.country).filter(Boolean))];
    steps.push({
      title: 'Account for the transfers that leave the region',
      body: `${crossBorder.length} ${crossBorder.length === 1 ? 'destination' : 'destinations'} sit outside the EU${
        countries.length ? ` (${countries.slice(0, 3).join(', ')})` : ''
      }. Cross-border transfers usually need a basis recorded, and DPDP treats them separately again.`,
      effort: 'Needs a decision',
      tone: 'warning',
    });
  }

  if (thirdPartyCookies.length > 0) {
    steps.push({
      title: 'Review the third-party cookies',
      body: `${thirdPartyCookies.length} of the cookies set belong to other domains. Each one needs a purpose it can be filed under before it can be gated correctly.`,
      effort: 'Mostly mechanical',
      tone: 'neutral',
    });
  }

  if (s.third_party_domains > 0 && gated.length === 0) {
    steps.push({
      title: 'Identify the unrecognised third parties',
      body: `${s.third_party_domains} third-party ${
        s.third_party_domains === 1 ? 'domain was' : 'domains were'
      } contacted that the catalogue does not recognise by name. Unrecognised is not the same as harmless — it means nobody has classified them yet.`,
      effort: 'Worth a look',
      tone: 'neutral',
    });
  }

  if (scan.limits.truncated) {
    steps.push({
      title: 'Scan the rest of the site',
      body: 'This preview hit its page limit before it ran out of links, so anything that only loads deeper in the site has not been seen.',
      effort: 'Needs an account',
      tone: 'primary',
    });
  }

  return steps.slice(0, MAX_STEPS);
}

/** "Two advertising tags", "Google AdSense" — whichever is more informative. */
function describe(gated: PreviewTechnology[]): string {
  if (gated.length === 1 && gated[0]) return gated[0].name;
  if (gated.length === 2 && gated[0] && gated[1]) return `${gated[0].name} and ${gated[1].name}`;

  const categories = [...new Set(gated.map((t) => t.category.replace(/_/g, ' ')))];
  return categories.length === 1
    ? `${gated.length} ${categories[0]} technologies`
    : `${gated.length} technologies`;
}
