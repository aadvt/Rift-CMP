import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { USE_FIXTURES } from './api/client';
import { listSites, listScans } from './api/endpoints';
import type { Site } from './api/types';

/**
 * Which website the site-agnostic screens are about.
 *
 * Install, consent, analytics, settings and the scan history are all "this
 * website" screens without a site in their URL, so something has to answer the
 * question for them. Two rules, in order:
 *
 *  1. **The one the operator last chose**, from a cookie the site switcher
 *     sets. A pivot control that visibly changes the sidebar but not the screen
 *     underneath it is a control people stop trusting.
 *  2. **Otherwise the first site**, which is the same one the shell shows as
 *     active, so the two can never disagree on a first visit.
 *
 * The cookie holds a site id and nothing else. It is a convenience, never an
 * authorisation: every read is still scoped by the organisation credential
 * server-side, so a tampered value resolves to a site that does not exist
 * rather than to somebody else's.
 */

export const SITE_COOKIE = 'rift_site';

/** The fixture site, so the no-backend experience is unchanged. */
const FIXTURE_SITE_ID = 'site_9fb2c41a';
const FIXTURE_SCAN_ID = 'scn_8841';

export async function currentSite(): Promise<Site | null> {
  const sites = await listSites();
  if (sites.length === 0) return null;

  const chosen = (await cookies()).get(SITE_COOKIE)?.value;
  return sites.find((site) => site.siteId === chosen) ?? sites[0]!;
}

export async function currentSiteId(): Promise<string | null> {
  if (USE_FIXTURES) return FIXTURE_SITE_ID;
  return (await currentSite())?.siteId ?? null;
}

/**
 * The current site, or the first screen of the journey.
 *
 * An organisation with no website yet has nothing for these screens to show,
 * and an empty state on each of them would be six ways of saying the same
 * thing. Sending them to the one field that starts everything is the more
 * useful answer.
 */
export async function requireSiteId(): Promise<string> {
  const siteId = await currentSiteId();
  if (!siteId) redirect('/dashboard/sites/new');
  return siteId;
}

/** The most recent scan for a site — completed if there is one, else the newest. */
export async function latestScanId(siteId: string): Promise<string | null> {
  if (USE_FIXTURES) return FIXTURE_SCAN_ID;

  const scans = await listScans(siteId);
  if (scans.length === 0) return null;
  const completed = scans.find(
    (scan) => scan.status === 'completed' || scan.status === 'completed_with_limitations',
  );
  return (completed ?? scans[0]!).scanId;
}
