import 'server-only';
import { cookies } from 'next/headers';

/**
 * The signed-in session, as this app holds it.
 *
 * The cookie carries an opaque `ds_` token and nothing else — no email, no
 * organisation id, no key. Everything the token means is resolved by the
 * platform on each request, so a tampered cookie is an unknown token rather than
 * a forged identity, and signing out is a revocation the server records rather
 * than a value the browser agrees to forget.
 *
 * `httpOnly` keeps it away from page scripts, so the cookie is never readable
 * by a script.
 *
 * `secure` is on by default outside development and can be turned off only by
 * setting `RIFT_INSECURE_COOKIES`. That escape hatch exists because a `Secure`
 * cookie is silently discarded by the browser when the page is served over
 * plain HTTP — the sign-in succeeds, the server sets the cookie, the browser
 * throws it away, and the person lands back on the form with no error anywhere
 * to explain it. A deployment without TLS needs to say so out loud rather than
 * appear broken.
 *
 * It is a downgrade and it is named like one. Anything reachable by someone
 * other than its author should be on HTTPS, at which point this goes away.
 *
 * `sameSite: 'lax'` rather than `'strict'`. Strict is the tighter setting and it
 * was the first choice, but it withholds the cookie on navigations that arrive
 * from anywhere else — including, in some browsers, the redirect that follows
 * the sign-in POST. The failure it produces is the worst kind: the session is
 * created, the redirect happens, and the person lands back on the sign-in form
 * with no error, having in fact signed in successfully. Lax still refuses to
 * send the cookie on cross-site POSTs, which is the request CSRF actually needs.
 */

export const SESSION_COOKIE = 'rift_session';

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  return value && value.startsWith('ds_') ? value : null;
}

export async function writeSessionToken(token: string, expiresAt: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:
      process.env.RIFT_INSECURE_COOKIES === 'true'
        ? false
        : process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function clearSessionToken(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
