'use server';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { createSite, rescanSite, acceptConfiguration, overrideTechnology, restoreRecommendation } from '@/lib/api/endpoints';
import { SITE_COOKIE } from '@/lib/current-site';

/** Server Actions are the only write path. Each one invalidates the tags the
 *  reads it affects were fetched under. */

export async function startScan(url: string) {
  const result = await createSite(url);
  // A website somebody just added is the one they want to be looking at.
  await selectSite(result.siteId);
  revalidateTag('sites');
  return result;
}

/**
 * Remember which website the site-agnostic screens are about.
 *
 * Install, consent, analytics and settings have no site in their URL, so the
 * switcher has to leave something behind for them to read. A cookie holding one
 * site id is all it is — every read is still scoped by the organisation
 * credential server-side, so a tampered value resolves to nothing rather than
 * to somebody else's website.
 */
/** Re-scans a website already on the account, and refreshes the screens that show scans. */
export async function runScan(siteId: string) {
  const result = await rescanSite(siteId);
  revalidateTag(`site:${siteId}`);
  return result;
}

export async function selectSite(siteId: string) {
  (await cookies()).set(SITE_COOKIE, siteId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function applyRiftConfiguration(siteId: string) {
  const result = await acceptConfiguration(siteId);
  revalidateTag(`config:${siteId}`);
  revalidateTag(`site:${siteId}`);
  return result;
}

export async function setTechnologyCategory(siteId: string, technologyId: string, category: string | null) {
  await overrideTechnology(siteId, technologyId, category);
  revalidateTag(`config:${siteId}`);
}

export async function restoreRiftRecommendation(siteId: string, technologyId: string) {
  await restoreRecommendation(siteId, technologyId);
  revalidateTag(`config:${siteId}`);
}
