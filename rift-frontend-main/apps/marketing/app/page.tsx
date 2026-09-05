import { BlurField, Button, Card, CardBody, Chip, CodeBlock, Confidence, Icon, RiftMark, cn } from '@rift/ui';
import { ScanField } from '@/components/ScanField';
import { SiteHeader } from '@/components/SiteHeader';

/* The steps are a real sequence — the order is the product — so they are
   numbered. Nothing else on the page is. */
const STEPS = [
  ['You enter your website', 'One URL. No account setup questions, no cookie inventory, no asking you which regulations apply.'],
  ['Rift scans it', 'Pages, cookies, scripts, storage, network activity and third-party services — read-only, the way a visitor sees your site.'],
  ['Rift works out what applies', 'Which requirements reach your visitors, based on where they are and what your site actually does.'],
  ['Rift writes the configuration', 'Consent categories, tracking controls, banner, regional behaviour. You review it. You don’t build it.'],
  ['You paste one script tag', 'Consent, tracking enforcement, consent records and analytics — from a single install, updated without redeploying.'],
] as const;

const DIFFERENCES = [
  {
    icon: 'sparkle' as const,
    title: 'The configuration is written for you',
    body: 'Most consent tools hand you an empty dashboard and a cookie table. Rift arrives with the configuration already built from your scan — the primary action is to use it, not to assemble it.',
  },
  {
    icon: 'layers' as const,
    title: 'One install, not seven',
    body: 'No separate snippets for analytics, consent, tracking control, consent logs and reporting. One script tag fetches its configuration at runtime, so changes never mean touching your site again.',
  },
  {
    icon: 'scans' as const,
    title: 'It keeps watching after install',
    body: 'Rift rescans on a schedule, classifies what it finds and applies what it safely can. You only hear from it when a decision is genuinely yours to make.',
  },
];

const REGULATIONS = [
  {
    code: 'EU',
    name: 'GDPR and ePrivacy',
    body: 'Consent before non-essential tracking, withdrawal that actually changes behaviour, and a record of each decision against the configuration version that was live at the time.',
  },
  {
    code: 'IN',
    name: 'India’s DPDP Act',
    body: 'Notice and consent handling oriented to DPDP, with consent records and withdrawal kept as first-class parts of the configuration rather than bolted on.',
  },
  {
    code: 'US',
    name: 'US state privacy laws',
    body: 'Regional controls for CCPA/CPRA and the other state regimes, applied per visitor at request time rather than guessed once at install.',
  },
];

const SNIPPET = `<script
  src="https://cdn.rift.dev/rift.js"
  data-site="site_9fb2c41a"
  async></script>`;

export default function Home() {
  return (
    <>
      <SiteHeader />

      <main id="top">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-5 pb-24 pt-16 md:px-8 md:pb-32 md:pt-24">
          <BlurField variant="hero" />

          <div className="relative mx-auto max-w-[880px] text-center">
            <div className="rise">
              <Chip tone="primary" className="h-9 px-5">
                <Icon name="sparkle" size={16} />
                Scan → decide → configure → install once
              </Chip>
            </div>

            <h1 className="rise rise-1 mt-7 text-[clamp(2.5rem,7vw,4rem)] font-normal leading-[1.05] tracking-[-0.02em] text-md-on-surface [text-wrap:balance]">
              Privacy infrastructure that configures itself
            </h1>

            <p className="rise rise-2 mx-auto mt-6 max-w-[620px] text-body-large leading-relaxed text-md-on-surface-variant">
              Rift scans your website, works out which rules reach your visitors, writes the consent and tracking
              configuration, and hands you one script tag. You review it — you don’t build it.
            </p>

            <div className="rise rise-3 mt-12">
              <ScanField />
            </div>

            {/* Honest trust line: what Rift is built for, not a wall of logos
                we haven't earned. */}
            <div className="rise rise-3 mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {['GDPR + ePrivacy', 'India DPDP', 'US state laws'].map((r) => (
                <span key={r} className="inline-flex items-center gap-2 text-label-medium text-md-on-surface-variant">
                  <Icon name="check" size={16} className="text-md-success" strokeWidth={2.2} />
                  {r}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section id="how" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1160px]">
            <SectionHead
              eyebrow="How it works"
              title="Five steps, and you only do two of them"
              sub="The rest is Rift’s job. That split is the whole point of the product."
            />

            <ol className="mt-14 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="group flex gap-5">
                  <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-title-large font-medium text-md-on-secondary-container">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-full bg-md-primary opacity-0 blur-lg transition-opacity duration-[--md-duration-base] ease-md group-hover:opacity-30"
                    />
                    <span className="relative tabular-nums">{i + 1}</span>
                  </span>
                  <div className="min-w-0 pt-1.5">
                    <h3 className="text-title-large font-medium leading-snug text-md-on-surface">{title}</h3>
                    <p className="mt-2.5 text-body-medium leading-relaxed text-md-on-surface-variant">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── What's different ─────────────────────────────────────────── */}
        <section className="px-5 py-8 md:px-8">
          <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-3xl bg-md-surface-container px-6 py-20 md:px-12">
            <BlurField variant="section" />
            <div className="relative">
              <SectionHead
                eyebrow="Why it feels different"
                title="You should not have to become a privacy engineer"
                sub="Consent tooling has historically handed the hardest decisions back to the person least equipped to make them."
              />

              <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
                {DIFFERENCES.map((d) => (
                  <Card key={d.title} tone="low" interactive className="rounded-2xl">
                    <CardBody className="p-8">
                      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-md-primary text-md-on-primary">
                        <Icon name={d.icon} size={26} />
                      </span>
                      <h3 className="mt-6 text-title-large font-medium leading-snug text-md-on-surface">{d.title}</h3>
                      <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">{d.body}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Confidence ───────────────────────────────────────────────── */}
        <section id="confidence" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto grid max-w-[1160px] grid-cols-1 items-start gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div>
              <SectionHead
                align="left"
                eyebrow="What Rift will and won’t claim"
                title="It tells you when it isn’t sure"
                sub="A scanner that labels everything with confidence it doesn’t have is worse than one that admits the gap."
              />
              <p className="mt-8 max-w-[54ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                Every technology Rift finds carries one of three levels. The third one matters most: <strong className="font-medium text-md-on-surface">unresolved
                does not mean unlawful, blocked, or consent-requiring.</strong> It means Rift needs more information, and
                it says so rather than guessing on your behalf.
              </p>
              <p className="mt-4 max-w-[54ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                Rift also keeps its own recommendation separate from your decision. When you override something, the
                dashboard shows both side by side and keeps a path back — which is what makes the trail worth anything
                later.
              </p>
            </div>

            <Card className="rounded-2xl">
              <CardBody className="p-8">
                <ul className="flex flex-col gap-7">
                  {([
                    ['confirmed', 'Strong evidence — a known technology matched on host, script and cookie behaviour. Rift configures it and moves on.'],
                    ['likely', 'Evidence, but not certainty. Rift configures it and asks you to confirm the category before treating it as settled.'],
                    ['unresolved', 'Rift could not classify it. It is not blocked, not flagged, and no consent claim is made about it. It waits for you.'],
                  ] as const).map(([level, body]) => (
                    <li key={level}>
                      <Confidence level={level} />
                      <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">{body}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ── Install ──────────────────────────────────────────────────── */}
        <section id="install" className="px-5 py-8 md:px-8">
          <div className="mx-auto max-w-[1160px]">
            <SectionHead
              eyebrow="Installation"
              title="One script tag. That’s the whole install."
              sub="No separate snippets for analytics, consent, tracking control, logs or reporting."
            />

            <div className="mt-14 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <CodeBlock
                code={SNIPPET}
                label="Add this to your website"
                sub="Inside <head>, before any other analytics or tracking script."
                meta={
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                    <Meta label="Size" value="14.2 kB gzipped" />
                    <Meta label="Configuration" value="fetched at runtime" />
                    <span className="text-label-medium text-md-inverse-on-surface/70">
                      The snippet never changes — updates land without a redeploy.
                    </span>
                  </div>
                }
              />

              <Card tone="low" className="rounded-2xl">
                <CardBody className="p-8">
                  <h3 className="text-title-large font-medium text-md-on-surface">What that one tag covers</h3>
                  <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {[
                      'Consent experience', 'Tracking controls', 'Consent records', 'Analytics',
                      'Regional configuration', 'Configuration updates', 'Future scan findings', 'Consent withdrawal',
                    ].map((h) => (
                      <li key={h} className="flex items-center gap-3">
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-md-success-container text-md-on-success-container">
                          <Icon name="check" size={16} strokeWidth={2.2} />
                        </span>
                        <span className="text-body-medium text-md-on-surface">{h}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-7 border-t border-md-outline-variant/50 pt-6 text-body-medium leading-relaxed text-md-on-surface-variant">
                    After you paste it, Rift checks the install itself — and if something hasn’t activated, it tells you
                    the likely cause and what to change, rather than the word “failed”.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        </section>

        {/* ── Regulations ──────────────────────────────────────────────── */}
        <section id="regulations" className="px-5 py-20 md:px-8 md:py-28">
          <div className="mx-auto max-w-[1160px]">
            <SectionHead
              eyebrow="Coverage"
              title="Built for the regimes your visitors actually fall under"
              sub="Rift decides applicability from where your visitors are and what your site does — per request, not once at install."
            />

            <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
              {REGULATIONS.map((r) => (
                <Card key={r.code} interactive className="rounded-2xl">
                  <CardBody className="p-8">
                    <span className="inline-flex h-11 items-center rounded-full bg-md-tertiary-container px-5 font-mono text-label-medium font-medium text-md-on-tertiary-container">
                      {r.code}
                    </span>
                    <h3 className="mt-6 text-title-large font-medium text-md-on-surface">{r.name}</h3>
                    <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">{r.body}</p>
                  </CardBody>
                </Card>
              ))}
            </div>

            <div className="mt-8 flex gap-4 rounded-2xl bg-md-surface-variant p-6 md:p-7">
              <Icon name="info" size={24} className="mt-0.5 shrink-0 text-md-on-surface-variant" />
              <p className="max-w-[80ch] text-body-medium leading-relaxed text-md-on-surface-variant">
                <strong className="font-medium text-md-on-surface">Rift gives you an assessment, not legal advice.</strong>{' '}
                It shows what it observed, which requirements it believes apply, and how confident it is — and it keeps
                scanner evidence, regulation applicability and its own interpretation visibly separate, so you can see
                where the reasoning ends. Where it can’t be confident, it says so and leaves the decision with you.
              </p>
            </div>
          </div>
        </section>

        {/* ── Close ────────────────────────────────────────────────────── */}
        <section className="px-5 pb-24 md:px-8">
          <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-3xl bg-md-surface-container px-6 py-20 text-center md:px-12 md:py-24">
            <BlurField variant="hero" />
            <div className="relative mx-auto max-w-[680px]">
              <h2 className="text-[clamp(2rem,5vw,3rem)] font-normal leading-[1.1] tracking-[-0.015em] text-md-on-surface [text-wrap:balance]">
                Start with the scan. Decide afterwards.
              </h2>
              <p className="mx-auto mt-5 max-w-[520px] text-body-large leading-relaxed text-md-on-surface-variant">
                You’ll see everything Rift found on your site, and the configuration it would write, before you install
                anything.
              </p>
              <div className="mt-10">
                <ScanField />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 pb-16 md:px-8">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-6 border-t border-md-outline-variant pt-10">
          <div className="flex items-center gap-3">
            <RiftMark size={30} />
            <span className="text-title-large font-medium tracking-tight text-md-on-surface">Rift</span>
          </div>
          <p className="text-label-medium text-md-on-surface-variant">
            A website privacy control plane.
          </p>
          <nav className="ml-auto flex flex-wrap gap-x-7 gap-y-2">
            {['Privacy', 'Terms', 'Security', 'Contact'].map((l) => (
              <a
                key={l}
                href="#top"
                className="text-label-medium text-md-on-surface-variant transition-colors hover:text-md-primary"
              >
                {l}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}

function SectionHead({
  eyebrow, title, sub, align = 'center',
}: { eyebrow: string; title: string; sub?: string; align?: 'center' | 'left' }) {
  return (
    <div className={cn('max-w-[720px]', align === 'center' && 'mx-auto text-center')}>
      <div className="text-label-medium font-medium uppercase tracking-[0.12em] text-md-primary">{eyebrow}</div>
      <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.75rem)] font-normal leading-[1.12] tracking-[-0.015em] text-md-on-surface [text-wrap:balance]">
        {title}
      </h2>
      {sub ? (
        <p className={cn('mt-5 text-body-large leading-relaxed text-md-on-surface-variant', align === 'center' && 'mx-auto')}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-label-small uppercase tracking-[0.08em] text-md-inverse-on-surface/60">{label}</div>
      <div className="mt-1 font-mono text-label-medium text-md-inverse-on-surface">{value}</div>
    </div>
  );
}
