import type { SiteStatus } from '@/lib/api/types';

/**
 * How each site status is shown.
 *
 * A `Record<SiteStatus, …>` rather than a ternary, so adding a status to the
 * union is a compile error here instead of a silent fallthrough. The site
 * detail header previously branched on `connected` alone and labelled the other
 * three "Needs review" — which told an operator a decision was waiting on them
 * for a site where Rift had simply never been installed, and contradicted the
 * sites table one click earlier.
 */
export const SITE_STATUS: Record<
  SiteStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'error' }
> = {
  connected: { label: 'Connected', tone: 'success' },
  needs_review: { label: 'Needs review', tone: 'warning' },
  not_installed: { label: 'Not installed', tone: 'neutral' },
  installation_issue: { label: 'Installation issue', tone: 'error' },
};
