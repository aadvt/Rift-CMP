import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BlurField, Card, Chip, Icon, RiftMark, type IconName } from '@rift/ui';
import { LandingScanForm } from '@/components/LandingScanForm';
import { readSessionToken } from '@/lib/auth/session';

export const metadata = {
  title: 'Rift — see what your website actually does',
  description:
    'Scan your website, see the trackers, cookies and cross-border transfers it really has, and turn that into working consent with one snippet.',
};
export const dynamic = 'force-dynamic';

/**
 * The first screen, for somebody who has never seen Rift.
 *
 * ## It answers before it asks
 *
 * The page leads with a scan, not a sign-up form. A stranger came here to find
 * something out about their own site; making them create an account first means
 * charging them before they know whether the product is worth anything. So the
 * scan runs for anybody, it is real rather than a canned demo, and the account
 * is proposed only once there is a result on the screen worth keeping.
 *
 * Nothing about a preview scan is stored — see `LandingScanForm` for why that
 * constraint exists and what it costs.
 *
 * ## Why there is this much prose
 *
 * Consent tooling is a market full of products that look identical from the
 * outside: they all show a banner. The difference is whether anything is
 * actually stopped from running before somebody agrees, and whether there is a
 * record afterwards that would survive being asked about. That difference
 * cannot be conveyed by a headline, so the page explains it.
 *
 * Somebody already signed in has no business here and goes straight through.
 */
export default async function Home() {
  if (await readSessionToken()) redirect('/dashboard');

  return (
    <main className="min-h-dvh bg-md-surface">
      <SiteHeader />

      {/* ── Hero: one field, and the reason to use it ── */}
      <section className="px-5 pb-14 md:px-8">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-md-surface-container px-6 py-12 md:px-12 md:py-16">
          <BlurField variant="hero" />

          <div className="relative mx-auto max-w-[760px] motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
            <Chip tone="primary" glyph="sparkle">
              No account needed to scan
            </Chip>

            <h1 className="mt-5 text-headline-large font-normal leading-[1.08] tracking-[-0.015em] text-md-on-surface">
              See what your website actually does
            </h1>

            <p className="mt-5 max-w-[58ch] text-body-large leading-relaxed text-md-on-surface-variant">
              Enter your address and Rift opens your site in a real browser, follows a few links, and
              reports every third party it contacts, every cookie it sets and every border the data
              crosses. Then it can turn that into working consent — one snippet, no legal homework.
            </p>

            <LandingScanForm className="mt-8" />
          </div>
        </div>
      </section>

      <HowItWorks />
      <WhatYouGet />
      <TheDifference />
      <Trust />
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
          className="rounded-full bg-md-primary px-5 py-2 text-label-large font-medium text-md-on-primary transition-transform active:scale-95"
        >
          Create account
        </Link>
      </nav>
    </header>
  );
}

const STEPS: Array<[string, string]> = [
  [
    'Rift scans your website',
    'A real browser loads your pages and records what happens: scripts, cookies, storage, network requests and the third parties behind them. No tag list to fill in — Rift finds them.',
  ],
  [
    'Rift works out what applies',
    'Each third party is matched against a catalogue that knows what it is for and where it operates, and read against the markets you actually sell to. Nothing is guessed in the permissive direction.',
  ],
  [
    'Rift writes the configuration',
    'Consent categories, which scripts belong in each, banner copy and regional behaviour — proposed as a change you approve, with the evidence that produced it attached.',
  ],
  [
    'You paste one snippet',
    'A single script tag. From then on Rift shows the banner, blocks what has not been agreed to, keeps a signed record of every decision, and tells you when your site changes underneath it.',
  ],
];

function HowItWorks() {
  return (
    <Section
      eyebrow="How it works"
      title="Four steps, and only one of them is yours"
      lede="Most consent tools hand you a configuration screen and a legal question. Rift starts from what your site does, because that is the only part anybody can check."
    >
      <ol className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {STEPS.map(([title, body], i) => (
          <li key={title}>
            <Card tone="low" className="h-full rounded-2xl">
              <div className="flex h-full gap-4 p-6">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-label-large font-medium text-md-on-secondary-container tabular-nums">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-title-small font-medium text-md-on-surface">{title}</span>
                  <span className="mt-2 block text-body-small leading-relaxed text-md-on-surface-variant">
                    {body}
                  </span>
                </span>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const FEATURES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'scans',
    title: 'Continuous discovery',
    body: 'Sites change without anybody deciding to. Rift re-scans, and tells you what appeared, what moved and what started sending data somewhere new — with the two scans side by side.',
  },
  {
    icon: 'shieldCheck',
    title: 'Enforcement, not decoration',
    body: 'A banner that does not stop anything is theatre. Rift blocks scripts, images, iframes, cookies and requests before they run, and keeps an audit trail of what it blocked and why.',
  },
  {
    icon: 'consent',
    title: 'Consent records that hold up',
    body: 'Every decision is recorded with the policy version it was made against and signed with a key, chained per person. A record can be verified later without trusting the database it came from.',
  },
  {
    icon: 'layers',
    title: 'Data flow map',
    body: 'A graph of what runs on your site, which vendor it belongs to, which purpose it serves, where it sends data and which consent gates it. Every edge says how it is known.',
  },
  {
    icon: 'analytics',
    title: 'Analytics without the tracking',
    body: 'First-party, no cross-site identifiers, no personal data leaving your control. The numbers you needed the third-party tag for, from something you do not need consent to run.',
  },
  {
    icon: 'wave',
    title: 'Simulate before you commit',
    body: 'Ask what happens if a market is added, a vendor dropped or a purpose withdrawn — and see the answer against your real graph, without changing anything.',
  },
];

function WhatYouGet() {
  return (
    <Section
      eyebrow="What Rift does"
      title="A control plane, not a cookie banner"
      lede="The banner is the smallest part. What matters is what runs before somebody agrees, what is recorded when they do, and whether you find out when it changes."
      tone="container"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="h-full rounded-2xl">
            <div className="p-6">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-md-secondary-container text-md-on-secondary-container">
                <Icon name={f.icon} size={20} />
              </span>
              <p className="mt-4 text-title-small font-medium text-md-on-surface">{f.title}</p>
              <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">{f.body}</p>
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

const CONTRASTS: Array<[string, string]> = [
  [
    'A banner appears and the trackers load anyway',
    'Nothing in a gated category runs until it has been agreed to — enforced in the page, and recorded when it is blocked.',
  ],
  [
    'You maintain a list of tags by hand',
    'Rift finds them by watching the site, so a tag somebody added last Tuesday is not invisible until the next audit.',
  ],
  [
    '“Consent given” with nothing behind it',
    'A signed, chained record naming the policy version, the categories and the moment — verifiable without trusting the store.',
  ],
  [
    'A dashboard of numbers with no provenance',
    'Every claim carries how it is known: observed in a scan, configured by you, enforced at runtime, or inferred — and inferred says so.',
  ],
];

function TheDifference() {
  return (
    <Section
      eyebrow="The difference"
      title="The part everyone skips"
      lede="Consent products look identical from the outside. This is where they stop being identical."
    >
      <ul className="flex flex-col divide-y divide-md-outline-variant">
        {CONTRASTS.map(([before, after]) => (
          <li key={before} className="grid grid-cols-1 gap-3 py-6 md:grid-cols-2 md:gap-10">
            <p className="flex gap-3 text-body-medium leading-relaxed text-md-on-surface-variant">
              <Icon name="x" size={18} className="mt-0.5 shrink-0 text-md-error" />
              {before}
            </p>
            <p className="flex gap-3 text-body-medium leading-relaxed text-md-on-surface">
              <Icon name="check" size={18} className="mt-0.5 shrink-0 text-md-success" />
              {after}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const TRUST: Array<[IconName, string, string]> = [
  [
    'user',
    'It reads only what a visitor would',
    'The scanner never signs in, never submits a form and never touches anything behind a login. If a visitor could not see it, Rift does not either.',
  ],
  [
    'file',
    'A preview keeps nothing',
    'The scan on this page creates no account, no site and no stored result. It runs, it answers, and it is gone.',
  ],
  [
    'consent',
    'Cookie values never leave the scanner',
    'Names and domains are what tell you a cookie is there. The value is the part that identifies somebody, and it is not reported.',
  ],
  [
    'info',
    'It does not pretend to be a lawyer',
    'Rift reports what your site does and what typically applies. It says which parts are observed and which are inferred, and it never calls a heuristic a finding.',
  ],
];

function Trust() {
  return (
    <Section
      eyebrow="What Rift will not do"
      title="Limits, stated up front"
      lede="A privacy product that is vague about its own behaviour has already lost the argument."
      tone="container"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {TRUST.map(([icon, title, body]) => (
          <div key={title} className="flex gap-4">
            <span className="mt-0.5 shrink-0 text-md-primary">
              <Icon name={icon} size={20} />
            </span>
            <div>
              <p className="text-title-small font-medium text-md-on-surface">{title}</p>
              <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ClosingCta() {
  return (
    <section className="px-5 pb-16 md:px-8">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-3xl bg-md-surface-container p-8 text-center md:p-14">
        <BlurField variant="hero" />
        <div className="relative">
          <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
            Start with your own website
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-body-large leading-relaxed text-md-on-surface-variant">
            Scroll back up and scan it — it takes half a minute and costs you nothing, not even an
            email address. Create an account when the result is worth keeping.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-md-primary px-6 py-3 text-label-large font-medium text-md-on-primary transition-transform active:scale-95"
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
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-md-outline-variant px-5 py-8 md:px-8">
      <span className="flex items-center gap-2.5">
        <RiftMark />
        <span className="text-label-large text-md-on-surface-variant">
          Rift — website privacy control plane
        </span>
      </span>
      <span className="flex items-center gap-2 text-label-medium text-md-on-surface-variant">
        <Icon name="shieldCheck" size={16} />
        Rift reads only what any visitor to your site would. It never signs in, and never submits a
        form.
      </span>
    </footer>
  );
}

/** One section shell, so the rhythm down the page is set in one place. */
function Section({
  eyebrow,
  title,
  lede,
  tone = 'surface',
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  tone?: 'surface' | 'container';
  children: React.ReactNode;
}) {
  return (
    <section className={tone === 'container' ? 'bg-md-surface-low px-5 py-16 md:px-8 md:py-20' : 'px-5 py-16 md:px-8 md:py-20'}>
      <div className="mx-auto max-w-[1200px]">
        <p className="text-label-small font-medium uppercase tracking-[0.08em] text-md-primary">
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-[24ch] text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
          {title}
        </h2>
        <p className="mt-4 max-w-[62ch] text-body-large leading-relaxed text-md-on-surface-variant">
          {lede}
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
