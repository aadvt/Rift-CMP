'use server';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import { createSite, rescanSite, acceptConfiguration, overrideTechnology, restoreRecommendation } from '@/lib/api/endpoints';
import { SITE_COOKIE } from '@/lib/current-site';
import { API_URL } from '@/lib/api/client';
import { writeSessionToken } from '@/lib/auth/session';

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

/**
 * Creates an account, its organisation, and — when a website came with it — the
 * first site and scan.
 *
 * Returns a result rather than throwing or redirecting, because everything that
 * can go wrong here is something the person can fix by editing the form in
 * front of them. A thrown error would replace the page they are filling in with
 * an error screen and lose what they typed.
 */
export async function signUp(input: { email: string; password: string; website?: string }): Promise<
  { ok: true; siteId: string | null; scanId: string | null } | { ok: false; message: string }
> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, message: 'Could not reach Rift. Check your connection and try again.' };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return {
      ok: false,
      message: body?.error?.message ?? 'That did not work. Check the details and try again.',
    };
  }

  const body = (await response.json()) as {
    session_token: string;
    expires_at: string;
    site: { site_id: string } | null;
  };

  await writeSessionToken(body.session_token, body.expires_at);

  const siteId = body.site?.site_id ?? null;
  let scanId: string | null = null;
  if (siteId) {
    // The scan is started here rather than by the signup endpoint: creating an
    // account and crawling somebody's website are different acts, and the one
    // that reaches out to the internet belongs where it can be seen.
    scanId = (await rescanSite(siteId).catch(() => null))?.scanId ?? null;
    await selectSite(siteId);
  }

  revalidateTag('sites');
  return { ok: true, siteId, scanId };
}

/**
 * Signing in.
 *
 * A result rather than a redirect-on-failure, matching every other form in this
 * app. The `<form action={serverAction}>` shape this replaced looked tidier and
 * did not work: the action returned 500 from the deployed build, so the button
 * appeared to do nothing at all. Calling a server action as a function from a
 * client component is the path the rest of the codebase already uses and the
 * one that demonstrably works.
 *
 * It also displays the error next to the field instead of bouncing through a
 * query parameter, which means a wrong password no longer discards the email
 * that was typed with it.
 */
export async function signIn(input: { email: string; password: string }): Promise<
  { ok: true } | { ok: false; message: string }
> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
  } catch {
    // Unreachable is not the same as rejected, and saying so saves somebody
    // retyping a password that was never the problem.
    return { ok: false, message: 'Could not reach Rift. Check your connection and try again.' };
  }

  if (!response.ok) {
    return { ok: false, message: 'That email and password do not match.' };
  }

  const body = (await response.json()) as { session_token: string; expires_at: string };
  await writeSessionToken(body.session_token, body.expires_at);
  return { ok: true };
}
