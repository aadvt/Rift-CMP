import { cache } from "react";
import { cookies } from "next/headers";
import {
  DASHBOARD_SESSION_MAX_AGE_SECONDS,
  createDashboardSession,
  prisma,
  resolveDashboardSession,
  revokeDashboardSession,
} from "database";

/**
 * Dashboard sign-in state.
 *
 * The cookie used to hold the organisation secret verbatim. It now holds an
 * opaque session token; the secret is sealed at rest in `dashboard_sessions`
 * with a key derived from that token, so neither the cookie nor the database is
 * sufficient on its own, and deleting the row revokes the session immediately.
 * The reasoning, and the limitation that remains, are in
 * `database/dashboard-sessions.ts` and docs/security.md.
 *
 * This module is the one place in `api/` outside the route handlers that talks
 * to `database`. The rule the dashboard follows — "no page imports `database`" —
 * is about *product data*: every screen still reads consent, transfers and
 * analytics over HTTP like any other integrator. A session store is
 * infrastructure, and routing it through the public API would mean publishing an
 * endpoint that hands out organisation secrets.
 */
export const SESSION_COOKIE = "rift_dashboard_session";

/**
 * The cookie the previous design used, which held the organisation secret
 * itself. Cleared on sign-in and sign-out so a stale one cannot linger in a
 * browser after this deploy.
 */
const LEGACY_SESSION_COOKIE = "rift_dashboard_key";

/**
 * Reads the organisation secret for the current request, or null.
 *
 * Memoised per request with React's `cache`, because the layout and every
 * `apiGet` call on a page all need it and none of them should cost a separate
 * round trip. The idle clock is advanced once per request as a side effect of
 * the first call.
 */
export const readSessionKey = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await resolveDashboardSession(prisma, token, { touch: true });
  return session?.secretKey ?? null;
});

/** Opens a session for an organisation whose secret has already been validated. */
export async function writeSessionKey(
  organisationId: string,
  secretKey: string,
): Promise<void> {
  const { token } = await createDashboardSession(prisma, { organisationId, secretKey });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    // Allows local development over http; a deployment behind TLS gets secure.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DASHBOARD_SESSION_MAX_AGE_SECONDS,
  });
  store.delete(LEGACY_SESSION_COOKIE);
}

/**
 * Signs out.
 *
 * The row is deleted before the cookie is cleared, so a token captured in flight
 * is dead even if the browser never receives the `Set-Cookie`.
 */
export async function clearSessionKey(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await revokeDashboardSession(prisma, token);
  }
  store.delete(SESSION_COOKIE);
  store.delete(LEGACY_SESSION_COOKIE);
}
