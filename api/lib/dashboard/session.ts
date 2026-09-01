import { cookies } from "next/headers";

/**
 * Dashboard sign-in state.
 *
 * The dashboard authenticates with the organisation secret key, which is the
 * only operator credential this platform has. That secret must never reach the
 * browser, so it is held in an httpOnly cookie and read exclusively on the
 * server: page components fetch through `lib/dashboard/api.ts`, and the browser
 * only ever receives rendered results.
 *
 * This is an MVP compromise and is documented as one. A production system would
 * have user accounts, short-lived sessions and per-user roles rather than a
 * single shared organisation secret standing in for all of them.
 */
export const SESSION_COOKIE = "rift_dashboard_key";

/** Eight hours: long enough for a working session, short enough to expire. */
const MAX_AGE_SECONDS = 8 * 60 * 60;

export async function readSessionKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionKey(secretKey: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, secretKey, {
    httpOnly: true,
    sameSite: "strict",
    // Allows local development over http; a deployment behind TLS gets secure.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionKey(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
