import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BlurField, Card, Icon, RiftMark } from '@rift/ui';
import { LandingScanForm } from '@/components/LandingScanForm';
import { readSessionToken } from '@/lib/auth/session';

export const metadata = { title: 'Rift — website privacy control plane' };
export const dynamic = 'force-dynamic';

const STEPS = [
  ['Rift scans your website', 'Pages, cookies, scripts, storage, network activity and third-party services.'],
  ['Rift determines what applies', 'Applicable privacy requirements for the regions your visitors come from.'],
  ['Rift writes the configuration', 'Consent categories, tracking controls, banner and regional behaviour.'],
  ['You paste one snippet', 'A single script tag. Rift handles consent, tracking, records and analytics from there.'],
];

/**
 * The first screen, for somebody who has never seen Rift.
 *
 * It asks for a website, not for an account. The website is what the visitor
 * came to find out about; the account is the tax, and asking for it first
 * makes a stranger pay before learning whether the thing is any use. The
 * address is carried through to sign-up, so the first thing they see after
 * creating an account is their own site being scanned rather than an empty
 * dashboard asking them to start over.
 *
 * Somebody already signed in has no business here and goes straight through.
 */
export default async function Home() {
  if (await readSessionToken()) redirect('/dashboard');

  return (
    <main className="min-h-dvh bg-md-surface px-5 py-10 md:px-8 md:py-14">
      <header className="mx-auto mb-10 flex max-w-[1200px] items-center justify-between">
        <span className="flex items-center gap-2.5">
          <RiftMark />
          <span className="text-title-medium font-medium text-md-on-surface">Rift</span>
        </span>
        <Link
          href="/signin"
          className="rounded-full px-4 py-2 text-label-large text-md-on-surface-variant transition-colors hover:bg-md-surface-container hover:text-md-on-surface"
        >
          Sign in
        </Link>
      </header>

      {/* The same hero shell the Add-a-website screen uses, so arriving in the
          product afterwards feels like the same place rather than a handoff. */}
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-md-surface-container p-8 md:p-12">
        <BlurField variant="hero" />

        <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
            <h1 className="text-headline-large font-normal leading-[1.1] tracking-[-0.01em] text-md-on-surface">
              Protect your website with Rift
            </h1>
            <p className="mt-4 max-w-[520px] text-body-large leading-relaxed text-md-on-surface-variant">
              Enter your website and Rift will scan it, identify tracking technologies, determine the
              privacy configuration, and prepare your installation.
            </p>

            <LandingScanForm className="mt-7 max-w-[520px]" />

            <p className="mt-4 max-w-[520px] text-label-medium text-md-on-surface-variant">
              No code to start. Rift scans your website before asking you to configure anything — you
              won&rsquo;t be asked about regulations, cookies or consent categories up front.
            </p>
          </div>

          <Card tone="low" className="rounded-2xl motion-safe:animate-[md-rise_500ms_var(--md-ease)_both]">
            <div className="p-7">
              <p className="text-title-small font-medium text-md-on-surface">What happens next</p>
              <ol className="mt-5 flex flex-col gap-5">
                {STEPS.map(([title, body], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-label-medium font-medium text-md-on-secondary-container tabular-nums">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block text-body-medium font-medium text-md-on-surface">{title}</span>
                      <span className="mt-1 block text-body-small leading-relaxed text-md-on-surface-variant">
                        {body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
        </div>
      </div>

      <p className="mx-auto mt-8 flex max-w-[1200px] items-center gap-2 text-label-medium text-md-on-surface-variant">
        <Icon name="shieldCheck" size={16} />
        Rift reads only what any visitor to your site would. It never signs in, and never submits a form.
      </p>
    </main>
  );
}
