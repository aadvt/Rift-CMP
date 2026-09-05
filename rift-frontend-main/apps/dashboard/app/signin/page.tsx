import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { API_URL, USE_FIXTURES } from '@/lib/api/client';
import { writeSessionToken } from '@/lib/auth/session';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

/**
 * Signing in.
 *
 * The password proves which person is asking. It never becomes an API
 * credential: the platform answers with an opaque session token, that goes into
 * an httpOnly cookie, and every later call carries the token rather than
 * anything the person typed.
 *
 * One message covers every failure. Telling somebody that an address exists but
 * the password was wrong answers the first question a credential-stuffing run
 * has, and the form has no reason to.
 */
async function signIn(formData: FormData) {
  'use server';

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  // Typed routes cannot express a query string, so the cast is the documented
  // way to say "this really is /signin, with a message on it".
  const back = (message: string) =>
    redirect(`/signin?error=${encodeURIComponent(message)}` as Route);

  if (!email || !password) back('Enter your email and password.');

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    // A backend that cannot be reached is not a rejected password, and saying
    // so saves somebody retyping a password that was never the problem.
    back('Could not reach Rift. Check the API is running and try again.');
    return;
  }

  if (!response.ok) back('That email and password do not match.');

  const body = (await response.json()) as { session_token: string; expires_at: string };
  await writeSessionToken(body.session_token, body.expires_at);
  redirect('/dashboard');
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-md-on-surface">Rift</h1>
        <p className="mt-1 text-sm text-md-on-surface-variant">
          Sign in to manage your websites.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-md-error/40 bg-md-error-container/40 px-4 py-3 text-sm text-md-on-error-container"
        >
          {error}
        </p>
      ) : null}

      {USE_FIXTURES ? (
        <p
          role="note"
          className="rounded-lg border border-md-outline/40 px-4 py-3 text-sm text-md-on-surface-variant"
        >
          This deployment has no backend configured, so it is running on sample
          data and there is nothing to sign in to. Set <code>RIFT_API_URL</code>{' '}
          to point it at a Rift API.
        </p>
      ) : (
        <form action={signIn} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-md-on-surface">Email</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="rounded-lg border border-md-outline bg-md-surface px-3 py-2.5 text-base text-md-on-surface outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-md-on-surface">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-lg border border-md-outline bg-md-surface px-3 py-2.5 text-base text-md-on-surface outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
            />
          </label>

          <button
            type="submit"
            className="mt-1 rounded-full bg-md-primary px-5 py-2.5 text-sm font-medium text-md-on-primary"
          >
            Sign in
          </button>
        </form>
      )}

      <p className="text-xs text-md-on-surface-variant">
        Your session is held in a cookie that page scripts cannot read, and can be
        revoked from the server at any time. Your organisation key is never sent
        to the browser.
      </p>
    </main>
  );
}
