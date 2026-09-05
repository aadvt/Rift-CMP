import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BlurField, Card, Icon, RiftMark } from '@rift/ui';
import { SignInForm } from '@/components/SignInForm';
import { USE_FIXTURES } from '@/lib/api/client';
import { readSessionToken } from '@/lib/auth/session';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

/**
 * Signing in.
 *
 * Same shell as the landing and sign-up screens, so the three read as one
 * product rather than three pages that happen to share a domain.
 */
export default async function SignInPage() {
  if (await readSessionToken()) redirect('/dashboard');

  return (
    <main className="min-h-dvh bg-md-surface px-5 py-10 md:px-8 md:py-14">
      <header className="mx-auto mb-10 flex max-w-[980px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <RiftMark />
          <span className="text-title-medium font-medium text-md-on-surface">Rift</span>
        </Link>
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-label-large text-md-on-surface-variant transition-colors hover:bg-md-surface-container hover:text-md-on-surface"
        >
          Create an account
        </Link>
      </header>

      <div className="relative mx-auto max-w-[980px] overflow-hidden rounded-3xl bg-md-surface-container p-8 md:p-12">
        <BlurField variant="hero" />

        <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
            <h1 className="text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">
              Sign in
            </h1>
            <p className="mt-4 max-w-[440px] text-body-large leading-relaxed text-md-on-surface-variant">
              Manage your websites, their scans and the consent they record.
            </p>

            {USE_FIXTURES ? (
              <p
                role="note"
                className="mt-6 max-w-[440px] rounded-xl border border-md-outline/40 px-4 py-3 text-body-small text-md-on-surface-variant"
              >
                This deployment has no backend configured, so it is running on sample data and there is
                nothing to sign in to. Set <code>RIFT_API_URL</code> to point it at a Rift API.
              </p>
            ) : (
              <SignInForm className="mt-7 max-w-[440px]" />
            )}

            <p className="mt-6 max-w-[440px] text-label-medium text-md-on-surface-variant">
              No account yet?{' '}
              <Link href="/" className="text-md-primary underline underline-offset-2">
                Scan your website
              </Link>{' '}
              and create one.
            </p>
          </div>

          <Card tone="low" className="rounded-2xl motion-safe:animate-[md-rise_500ms_var(--md-ease)_both]">
            <div className="p-7">
              <p className="text-title-small font-medium text-md-on-surface">How your session works</p>
              <ul className="mt-5 flex flex-col gap-4 text-body-small leading-relaxed text-md-on-surface-variant">
                <li className="flex gap-3">
                  <Icon name="shieldCheck" size={16} className="mt-0.5 shrink-0 text-md-on-surface" />
                  <span>
                    Your session is an opaque token in a cookie no page script can read, and the server
                    can revoke it at any time.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Icon name="layers" size={16} className="mt-0.5 shrink-0 text-md-on-surface" />
                  <span>
                    Your organisation key never reaches the browser. Signing in proves who you are; the
                    key proves which organisation a request represents, and the two stay separate.
                  </span>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
