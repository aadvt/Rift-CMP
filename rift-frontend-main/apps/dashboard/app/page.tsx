import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BlurField, Card, Icon, RiftMark, type IconName } from '@rift/ui';
import { LandingScanForm } from '@/components/LandingScanForm';
import { HeroIntro } from '@/components/landing/HeroIntro';
import { RegimeStrip } from '@/components/landing/RegimeStrip';
import { ShieldHero, ShieldStatic } from '@/components/landing/ShieldHero';
import { Reveal } from '@/components/motion/Reveal';
import { readSessionToken } from '@/lib/auth/session';

export const metadata = {
  title: 'Rift — see what your website actually does',
  description:
    'Scan your site, see every tracker, cookie and cross-border transfer, and configure consent for GDPR, ePrivacy, CCPA and India’s DPDP Act in one place.',
};
export const dynamic = 'force-dynamic';

/**
 * The first screen, for somebody who has never seen Rift.
 *
 * ## It answers before it asks
 *
 * The page leads with a scan, not a sign-up form. A stranger came to find
 * something out about their own site; asking them to create an account first
 * charges them before they know whether this is worth anything.
 *
 * ## Short on purpose
 *
 * An earlier version of this page explained itself at length and nobody was
 * going to read it. The argument is made by the scan — somebody's own site,
 * their own trackers, in about twenty seconds — so the prose around it only has
 * to get them to the field and label what they are looking at afterwards. Every
 * section here is a heading and one line.
 *
 * Somebody already signed in has no business here and goes straight through.
 */
export default async function Home() {
  if (await readSessionToken()) redirect('/dashboard');

  return (
    <main className="min-h-dvh overflow-x-hidden bg-md-surface">
      <SiteHeader />

      {/* The shield is a sibling of the panel, not a child of it.

          Placed inside, it would be clipped by the panel's rounded corner and
          bounded by its padding — a picture hanging on the frame. Positioned
          against the section instead, it crosses the panel's top and right
          edges and, once the scroll carries it down, its bottom edge too. An
          object that overlaps its container is in front of the page.

          The grid still reserves the right-hand column at `lg`, so the text
          never runs under it. The column is empty on purpose: the shield is
          absolutely positioned and takes no space, and something has to hold
          the space open for it.

          `overflow-hidden` sits on its own layer behind the content rather than
          on the panel, because the blur field needs clipping and the shield
          must not have it. */}
      <section className="relative px-5 pb-10 md:px-8">
        <div className="relative mx-auto max-w-[1200px] rounded-3xl bg-md-surface-container px-6 py-14 md:px-12 md:py-16">
          {/* Everything decorative, clipped to the panel's rounded corners and
              sitting behind the content that follows it. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            <BlurField variant="hero" />

            {/* The phone's shield. It hangs off the right edge, upper area,
                behind the copy rather than above it.

                Stacked on top it pushed the heading and the field down the
                screen and read as a splash image the reader had to get past.
                Here it does what the desktop one does — occupies the space the
                text does not use — and the first thing on the screen is still
                the sentence saying what this is.

                Two thirds of its width sits past the panel edge on purpose: a
                partial object reads as something continuing beyond the frame,
                where a whole one centred in the margin reads as an icon that
                did not fit. Held at 55% so the copy crossing it stays the
                darkest thing on the panel. */}
            <ShieldStatic className="absolute -right-[26%] top-[-4%] w-[64%] opacity-50" />
          </div>

          <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.9fr)] lg:gap-8">
            <div className="max-w-[620px]">
              <HeroIntro />
              <LandingScanForm className="mt-9" />
            </div>

            <div aria-hidden="true" className="hidden lg:block" />
          </div>
        </div>

        {/* Deliberately hung past the panel on two edges. The offset is
            measured from the centre so it tracks the 1200px panel rather than
            the viewport, and the `max` floor stops it running off-screen on a
            narrow desktop — where it bleeds a little, which is the point. */}
        <ShieldHero className="right-[max(-1.5rem,calc(50%-39rem))] top-[-4.5rem] w-[clamp(32rem,42vw,42rem)]" />
      </section>

      <RegimeStrip />
      <HowItWorks />
      <WhatYouGet />
      <Limits />
      <ClosingCta />
      <SiteFooter />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-6 md:px-8 md:py-8">
      <span className="flex items-center gap-2.5">
        <RiftMark />
        <span className="text-title-medium font-medium text-md-on-surface">Rift</span>
      </span>
      <nav className="flex items-center gap-1">
        <Link
          href="/signin"
          className="rounded-full px-4 py-2 text-label-large text-md-on-surface-variant transition-colors hover:bg-md-surface-container hover:text-md-on-surface"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-md-primary px-5 py-2 text-label-large font-medium text-md-on-primary transition-transform duration-[--md-duration-fast] hover:scale-[1.03] active:scale-95"
        >
          Create account
        </Link>
      </nav>
    </header>
  );
}

const STEPS: Array<[IconName, string, string]> = [
  ['scans', 'Scan', 'A real browser loads your pages and records what runs.'],
  ['layers', 'Resolve', 'Each third party is matched to a vendor, a purpose and a country.'],
  ['consent', 'Configure', 'Rift writes the categories and the banner. You approve it.'],
  ['code', 'Install', 'One script tag. Rift enforces and records from there.'],
];

function HowItWorks() {
  return (
    <Section eyebrow="How it works" title="Four steps, one of them yours">
      <Reveal as="ol" stagger={0.08} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([icon, title, body], i) => (
          <li key={title}>
            <Card tone="low" className="group h-full rounded-2xl transition-shadow duration-[--md-duration-base] hover:shadow-e2">
              <div className="p-6">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-md-secondary-container text-md-on-secondary-container transition-transform duration-[--md-duration-base] ease-md group-hover:scale-110">
                  <Icon name={icon} size={22} />
                </span>
                <p className="mt-5 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="mt-1 text-title-small font-medium text-md-on-surface">{title}</p>
                <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">{body}</p>
              </div>
            </Card>
          </li>
        ))}
      </Reveal>
    </Section>
  );
}

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'scans', title: 'Continuous discovery', body: 'Rift re-scans and shows what changed.' },
  { icon: 'shieldCheck', title: 'Real enforcement', body: 'Scripts and cookies are blocked, not just hidden behind a banner.' },
  { icon: 'consent', title: 'Signed consent records', body: 'Chained per person, verifiable without trusting the database.' },
  { icon: 'layers', title: 'Data flow map', body: 'What runs, who owns it, where it sends data, what gates it.' },
  { icon: 'analytics', title: 'Analytics without tracking', body: 'First-party, no cross-site identifiers.' },
  { icon: 'wave', title: 'Simulate a change', body: 'Add a market or drop a vendor and see the effect first.' },
];

function WhatYouGet() {
  return (
    <Section
      eyebrow="What Rift does"
      title="A control plane, not a cookie banner"
      tone="container"
    >
      <Reveal stagger={0.06} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card
            key={f.title}
            className="group h-full rounded-2xl transition-all duration-[--md-duration-base] ease-md hover:-translate-y-1 hover:shadow-e2"
          >
            <div className="p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-md-secondary-container text-md-on-secondary-container transition-transform duration-[--md-duration-base] ease-md group-hover:rotate-6 group-hover:scale-110">
                <Icon name={f.icon} size={20} />
              </span>
              <p className="mt-4 text-title-small font-medium text-md-on-surface">{f.title}</p>
              <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">{f.body}</p>
            </div>
          </Card>
        ))}
      </Reveal>
    </Section>
  );
}

const LIMITS: Array<[IconName, string]> = [
  ['user', 'Reads only what a visitor would. Never signs in.'],
  ['file', 'A preview scan stores nothing at all.'],
  ['consent', 'Cookie names and domains only — never values.'],
  ['info', 'Says what is observed and what is inferred.'],
];

function Limits() {
  return (
    <Section eyebrow="Limits" title="Stated up front">
      <Reveal stagger={0.06} className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
        {LIMITS.map(([icon, text]) => (
          <p key={text} className="flex items-start gap-3 text-body-medium leading-relaxed text-md-on-surface-variant">
            <span className="mt-0.5 shrink-0 text-md-primary">
              <Icon name={icon} size={18} />
            </span>
            {text}
          </p>
        ))}
      </Reveal>
    </Section>
  );
}

function ClosingCta() {
  return (
    <section className="px-5 pb-16 md:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-md-surface-container p-10 text-center md:p-16">
          <BlurField variant="hero" />
          <div className="relative">
            <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
              Start with your own website
            </h2>
            <p className="mx-auto mt-3 max-w-[46ch] text-body-large text-md-on-surface-variant">
              Twenty seconds, no email address.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-md-primary px-6 py-3 text-label-large font-medium text-md-on-primary transition-transform duration-[--md-duration-fast] hover:scale-[1.03] active:scale-95"
              >
                Create an account
              </Link>
              <Link
                href="/signin"
                className="rounded-full px-6 py-3 text-label-large font-medium text-md-on-surface-variant transition-colors hover:bg-md-surface-high hover:text-md-on-surface"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-md-outline-variant px-5 py-8 md:px-8">
      <span className="flex items-center gap-2.5">
        <RiftMark />
        <span className="text-label-large text-md-on-surface-variant">Rift — website privacy control plane</span>
      </span>
      <span className="text-label-medium text-md-on-surface-variant">
        Reports what your site does. Not legal advice.
      </span>
    </footer>
  );
}

/** One section shell, so the rhythm down the page is set in one place. */
function Section({
  eyebrow,
  title,
  tone = 'surface',
  children,
}: {
  eyebrow: string;
  title: string;
  tone?: 'surface' | 'container';
  children: React.ReactNode;
}) {
  return (
    <section className={tone === 'container' ? 'bg-md-surface-low px-5 py-16 md:px-8 md:py-20' : 'px-5 py-16 md:px-8 md:py-20'}>
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <p className="text-label-small font-medium uppercase tracking-[0.08em] text-md-primary">{eyebrow}</p>
          <h2 className="mt-3 max-w-[22ch] text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
            {title}
          </h2>
        </Reveal>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
