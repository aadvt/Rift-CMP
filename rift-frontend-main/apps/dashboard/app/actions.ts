'use server';
import { cookies } from 'next/headers';
import { revalidateTag } from 'next/cache';
import {
  createSite, rescanSite, acceptConfiguration, overrideTechnology, restoreRecommendation,
  cancelScan as cancelScanUpstream,
  setExperimentStatus as setExperimentStatusUpstream,
  runSimulation,
  updateRightsRequest,
  verifyConsentProof,
  evaluateFirewall,
  getConsentProof,
} from '@/lib/api/endpoints';
import { SITE_COOKIE } from '@/lib/current-site';
import { API_URL, riftFetch } from '@/lib/api/client';
import { clearSessionToken, writeSessionToken } from '@/lib/auth/session';
import type { ProposedChange, WireSimulation } from '@/lib/api/simulation';
import type { ProofVerification } from '@/lib/api/endpoints';
import type { WireConsentProof, WireFirewallEvaluation } from '@/lib/api/backend';

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

/**
 * Stops a scan that is queued or running.
 *
 * The platform cancels cooperatively — a running crawl notices at its next page
 * boundary — so this returns as soon as the intent is recorded. The scan screen
 * is already polling and will show the status change when it lands, which is
 * why nothing here waits for it.
 */
export async function stopScan(scanId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await cancelScanUpstream(scanId);
    revalidateTag(`scan:${scanId}`);
    return { ok: true };
  } catch (error) {
    // A 409 means it finished before the click landed. The person wanted it to
    // stop and it has stopped, so that is a success with a different sentence.
    const status = (error as { status?: number }).status;
    if (status === 409) return { ok: true, message: 'That scan had already finished.' };
    return { ok: false, message: 'Could not cancel the scan.' };
  }
}

/**
 * Starts, pauses, completes or archives an experiment.
 *
 * The platform owns the lifecycle table and refuses an illegal move with a
 * sentence naming what is allowed from here. That message is returned rather
 * than replaced: "cannot start a completed experiment" tells somebody what to
 * do next, and "something went wrong" does not.
 */
export async function changeExperimentStatus(
  experimentId: string,
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED',
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await setExperimentStatusUpstream(experimentId, status);
    revalidateTag('experiments');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : null;
    return { ok: false, message: message ?? 'Could not change the experiment.' };
  }
}

/**
 * Runs a hypothetical scenario.
 *
 * A Server Action rather than a client fetch so the session stays on the
 * server, like every other call in this app. It revalidates nothing, because
 * nothing changed — that is the entire point of the endpoint behind it, and
 * invalidating a cache here would imply otherwise.
 */
export async function simulateScenario(
  siteId: string,
  scenarioName: string,
  changes: ProposedChange[],
): Promise<{ ok: true; simulation: WireSimulation } | { ok: false; message: string }> {
  try {
    const simulation = await runSimulation(siteId, scenarioName, changes);
    return { ok: true, simulation };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : null;
    return { ok: false, message: message ?? 'The scenario could not be run.' };
  }
}

/**
 * Moves a rights request along, and records what was done about it.
 *
 * The note is not optional decoration. `completed` is the operator's claim that
 * they did the work in their own systems — Rift cannot see into those systems
 * and does not pretend to — so the note is the only account of what actually
 * happened, and it is the thing a regulator would ask for.
 */
export async function setRightsRequestStatus(
  requestId: string,
  status: 'received' | 'in_progress' | 'completed' | 'refused' | 'withdrawn',
  resolutionNote: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await updateRightsRequest(requestId, {
      status,
      ...(resolutionNote !== null ? { resolution_note: resolutionNote } : {}),
    });
    revalidateTag('rights');
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : null;
    return { ok: false, message: message ?? 'Could not update the request.' };
  }
}

/**
 * Checks a consent proof against the record as it stands now.
 *
 * This is the auditor's question — has anything about this decision changed
 * since it was recorded — rather than the holder's, which asks whether a
 * document somebody was handed is genuine. Both are the same endpoint; this
 * calls the first form.
 *
 * Verification touches only public key material. There is no path from here to
 * a private key, which is the property that makes the check safe to expose and
 * repeatable by anybody holding the proof.
 */
export async function checkConsentProof(
  consentRecordId: string,
): Promise<{ ok: true; verification: ProofVerification } | { ok: false; message: string }> {
  try {
    const verification = await verifyConsentProof(consentRecordId);
    return { ok: true, verification };
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : null;
    return { ok: false, message: message ?? 'The proof could not be checked.' };
  }
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

/**
 * Signing out.
 *
 * Two things have to happen and only one of them is the browser's. The cookie
 * is deleted here, but a cookie is just a copy — the token it held is still
 * valid until the platform is told to revoke it, and a session that survives
 * "sign out" on every other device is not signed out. So the revocation goes
 * first, and the cookie is cleared whether or not it succeeded: leaving
 * somebody holding a cookie because the network dropped would mean the button
 * visibly did nothing.
 *
 * The site cookie goes too. It names a website belonging to the organisation
 * that has just left; every read is scoped by credential so a stale value
 * resolves to nothing, but the next person to use this browser should not start
 * inside somebody else's choice of site.
 */
export async function signOut(): Promise<void> {
  // 204, and it answers the same way for a token that was already dead — so
  // there is no failure here worth reporting to somebody who is leaving.
  await riftFetch<void>(`/api/v1/auth/logout`, { method: 'POST' }).catch(() => {});

  await clearSessionToken();
  (await cookies()).delete(SITE_COOKIE);
}

/**
 * A firewall dry run.
 *
 * A write path by HTTP method only: the platform records nothing, so there is
 * no tag to invalidate. It lives here because the credential must stay on the
 * server, not because anything changed.
 */
export async function runFirewall(
  siteId: string,
  input: { destination: string; purpose: string | null; principalExternalId?: string },
): Promise<{ evaluation: WireFirewallEvaluation } | { error: string }> {
  try {
    const evaluation = await evaluateFirewall(siteId, input);
    return { evaluation };
  } catch (err) {
    const e = err as Error & { riftCode?: string };
    // The platform rejects a malformed destination with a message worth
    // showing; anything else gets the generic sentence rather than a stack.
    return {
      error: e.riftCode === 'invalid_request'
        ? e.message
        : 'The firewall could not evaluate that request. Check the destination and try again.',
    };
  }
}

/**
 * Fetches the receipt for one consent decision.
 *
 * A read, but a Server Action rather than a page load: it is wanted for one row
 * out of a table of thousands, and fetching every receipt to render a list
 * nobody opened would be a lot of hashing for nothing.
 */
export async function fetchConsentReceipt(
  recordId: string,
): Promise<{ ok: true; proof: WireConsentProof } | { ok: false; message: string }> {
  const proof = await getConsentProof(recordId);
  if (!proof) {
    return {
      ok: false,
      message: 'No receipt is available for this record. It may pre-date proof generation, or the record may no longer exist.',
    };
  }
  return { ok: true, proof };
}
