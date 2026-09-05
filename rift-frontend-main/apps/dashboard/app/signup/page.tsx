import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BlurField, Card, Icon, RiftMark } from '@rift/ui';
import { SignUpForm } from '@/components/SignUpForm';
import { USE_FIXTURES } from '@/lib/api/client';
import { readSessionToken } from '@/lib/auth/session';

export const metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

/**
 * Creating an account, immediately after asking for a website.
 *
 * The address is shown back rather than asked for again — it is the reason the
 * person is here, and repeating the question suggests the first answer went
 * nowhere. Signing up creates the organisation, the site and the first scan
 * together, so the next screen is that scan running.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ website?: string; error?: string }>;
}) {
  if (await readSessionToken()) redirect('/dashboard');
  const { website, error } = await searchParams;

  let host: string | null = null;
  if (website) {
    try {
      host = new URL(website).hostname;
    } catch {
      host = null;
    }
  }

  return (
    <main className="min-h-dvh bg-md-surface px-5 py-10 md:px-8 md:py-14">
      <header className="mx-auto mb-10 flex max-w-[980px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <RiftMark />
          <span className="text-title-medium font-medium text-md-on-surface">Rift</span>
        </Link>
        <Link
          href="/signin"
          className="rounded-full px-4 py-2 text-label-large text-md-on-surface-variant transition-colors hover:bg-md-surface-container hover:text-md-on-surface"
        >
          Sign in
        </Link>
      </header>

      <div className="relative mx-auto max-w-[980px] overflow-hidden rounded-3xl bg-md-surface-container p-8 md:p-12">
        <BlurField variant="hero" />

        <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
            <h1 className="text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">
              Create your account
            </h1>
            <p className="mt-4 max-w-[440px] text-body-large leading-relaxed text-md-on-surface-variant">
              {host ? (
                <>
                  Rift will scan <span className="font-medium text-md-on-surface">{host}</span> as soon as
                  your account exists.
                </>
              ) : (
                <>One account covers every website you add.</>
              )}
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-6 flex max-w-[440px] items-start gap-2 rounded-xl border border-md-error/40 bg-md-error-container/40 px-4 py-3 text-body-small text-md-on-error-container"
              >
                <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}

            {USE_FIXTURES ? (
              <p
                role="note"
                className="mt-6 max-w-[440px] rounded-xl border border-md-outline/40 px-4 py-3 text-body-small text-md-on-surface-variant"
              >
                This deployment has no backend configured, so there is nothing to create an account
                against. Set <code>RIFT_API_URL</code> to point it at a Rift API.
              </p>
            ) : (
              <SignUpForm className="mt-7 max-w-[440px]" website={website ?? ''} />
            )}
          </div>

          <Card tone="low" className="rounded-2xl motion-safe:animate-[md-rise_500ms_var(--md-ease)_both]">
            <div className="p-7">
              <p className="text-title-small font-medium text-md-on-surface">What your account holds</p>
              <ul className="mt-5 flex flex-col gap-4 text-body-small leading-relaxed text-md-on-surface-variant">
                <li className="flex gap-3">
                  <Icon name="shieldCheck" size={16} className="mt-0.5 shrink-0 text-md-on-surface" />
                  <span>
                    Your websites, their scans, and the consent decisions your visitors make — kept as an
                    append-only record that cannot be edited after the fact.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Icon name="layers" size={16} className="mt-0.5 shrink-0 text-md-on-surface" />
                  <span>
                    Your password is hashed with scrypt and never stored. Your session is a token this
                    page cannot read and the server can revoke.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Icon name="scans" size={16} className="mt-0.5 shrink-0 text-md-on-surface" />
                  <span>
                    Rift only ever reads what a visitor to your site would. It never signs in to your
                    website and never submits a form on it.
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
