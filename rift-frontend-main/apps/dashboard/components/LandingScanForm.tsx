'use client';
import * as React from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { Button, Card, Chip, Field, Icon, Input, Notice, StatBlock, cn } from '@rift/ui';
import { CountUp } from '@/components/motion/CountUp';
import { ScanOrbit } from '@/components/motion/ScanOrbit';
import { guardAnimation, shouldAnimate, withGsap } from '@/components/motion/gsap';
import { recommend, type PreviewScanResult } from '@/lib/preview-recommendations';

/**
 * The landing page's scan.
 *
 * It runs a real crawl of the address somebody types and shows what came back.
 * Nothing is stored: a scan belongs to a site, a site to an organisation, an
 * organisation to a person, and a visitor has none of those — so the result
 * lives in this component's state and nowhere else. The account is proposed
 * afterwards, next to a result worth keeping.
 *
 * `likely_needs_consent` is a heuristic over the scanner's category, so the copy
 * says "typically" wherever it appears. The real answer comes from the policy
 * engine once an operator has declared their markets, and neither exists for
 * somebody who has not signed up.
 */

const schema = z
  .string()
  .trim()
  .min(1, 'Enter the website you want Rift to scan.')
  .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
  .refine(
    (v) => {
      try {
        return Boolean(new URL(v).hostname.includes('.'));
      } catch {
        return false;
      }
    },
    'That doesn’t look like a website address. Try northwind-retail.com.',
  );

/**
 * What the visitor is told while they wait.
 *
 * The crawl's real phases in order, not a fake percentage — the endpoint answers
 * once, so there is no progress to report honestly. The elapsed counter beside
 * them is the only number here that means anything.
 */
const PHASES = [
  'Opening your site',
  'Following links',
  'Watching what loads',
  'Recording cookies',
  'Matching third parties',
];

export function LandingScanForm({ className }: { className?: string }) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState<PreviewScanResult>();
  const [phase, setPhase] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!scanning) return;
    const started = Date.now();
    const id = setInterval(() => {
      const s = Math.round((Date.now() - started) / 1000);
      setElapsed(s);
      setPhase(Math.min(PHASES.length - 1, Math.floor(s / 4)));
    }, 500);
    return () => clearInterval(id);
  }, [scanning]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the address and try again.');
      return;
    }

    setError(undefined);
    setResult(undefined);
    setElapsed(0);
    setPhase(0);
    setScanning(true);

    try {
      const res = await fetch('/api/preview-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.data }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { scan?: PreviewScanResult; message?: string }
        | null;

      if (!res.ok || !payload?.scan) {
        setError(payload?.message ?? 'The scan could not be completed. Try again in a moment.');
        return;
      }
      setResult(payload.scan);
    } catch {
      setError('The scan could not be completed — check your connection and try again.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className={className} data-hero="form">
      <form onSubmit={onSubmit} noValidate>
        <Field label="Your website" htmlFor="website" {...(error ? { error } : {})}>
          <Input
            id="website"
            name="website"
            inputMode="url"
            autoComplete="url"
            placeholder="northwind-retail.com"
            value={value}
            invalid={Boolean(error)}
            disabled={scanning}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
          />
        </Field>

        <Button
          type="submit"
          variant="filled"
          size="lg"
          iconAfter="arrowRight"
          disabled={scanning}
          className="mt-4 transition-transform duration-[--md-duration-fast] hover:scale-[1.02]"
        >
          {scanning ? 'Scanning…' : result ? 'Scan again' : 'Scan my website'}
        </Button>
      </form>

      {scanning ? <ScanProgress phase={phase} elapsed={elapsed} /> : null}
      {result && !scanning ? <ScanResults result={result} /> : null}
    </div>
  );
}

function ScanProgress({ phase, elapsed }: { phase: number; elapsed: number }) {
  return (
    <Card tone="low" className="mt-7 overflow-hidden rounded-2xl motion-safe:animate-[md-rise_400ms_var(--md-ease)_both]">
      <div className="flex flex-col items-center gap-7 p-8 sm:flex-row sm:items-center sm:gap-9">
        <ScanOrbit size={124} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-title-small font-medium text-md-on-surface">Reading your site</p>
            <span className="text-label-medium tabular-nums text-md-on-surface-variant">{elapsed}s</span>
          </div>

          <ol className="mt-4 flex flex-col gap-2" aria-live="polite">
            {PHASES.map((label, i) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-2.5 text-body-small transition-all duration-[--md-duration-base] ease-md',
                  i < phase && 'text-md-on-surface-variant',
                  i === phase && 'translate-x-0.5 font-medium text-md-on-surface',
                  i > phase && 'text-md-on-surface-variant/45',
                )}
              >
                <span className="inline-flex size-4 shrink-0 items-center justify-center">
                  {i < phase ? (
                    <Icon name="check" size={14} strokeWidth={2.2} />
                  ) : i === phase ? (
                    <span className="size-2 rounded-full bg-md-primary motion-safe:animate-[md-breathe_1.4s_ease-in-out_infinite]" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current opacity-60" />
                  )}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}

function ScanResults({ result }: { result: PreviewScanResult }) {
  const ref = React.useRef<HTMLElement>(null);
  const s = result.summary;
  const host = safeHost(result.url);
  const crossBorder = result.destinations.filter((d) => d.crosses_border).length;
  const gated = result.technologies.filter((t) => t.likely_needs_consent);
  const steps = recommend(result);

  // Results replace a spinner in place, so nothing about the page tells you the
  // answer arrived. The card lifting in is that signal.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;
    const gsap = withGsap();
    let unguard = () => {};

    const ctx = gsap.context(() => {
      const anim = gsap.from('[data-result="block"]', {
        opacity: 0,
        y: 16,
        duration: 0.55,
        stagger: 0.07,
        ease: 'power3.out',
      });
      // These are the answer somebody waited twenty seconds for. They appear
      // whether or not the animation does.
      unguard = guardAnimation(anim);
    }, el);

    return () => {
      unguard();
      ctx.revert();
    };
  }, []);

  return (
    <section ref={ref} className="mt-8" aria-label={`Scan results for ${host}`}>
      <Card tone="low" data-result="block" className="overflow-hidden rounded-2xl">
        <div className="border-b border-md-outline-variant p-6 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-title-medium font-medium text-md-on-surface">{host}</p>
            <span className="text-label-medium tabular-nums text-md-on-surface-variant">
              {s.pages_scanned} {s.pages_scanned === 1 ? 'page' : 'pages'} · {(result.duration_ms / 1000).toFixed(1)}s
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
            <StatBlock label="Third parties" value={<CountUp value={s.third_party_domains} />} meta="domains contacted" />
            <StatBlock label="Cookies" value={<CountUp value={s.cookies} />} meta="set while loading" />
            <StatBlock label="Leaves the EU" value={<CountUp value={crossBorder} />} meta="destinations" />
            <StatBlock label="Typically gated" value={<CountUp value={s.likely_need_consent} />} meta="need consent" />
          </div>
        </div>

        <div className="p-6 md:p-7">
          <div data-result="block">
            {s.pages_scanned === 0 ? (
              // Nothing below this point was measured against a page that
              // finished loading, so the confident readings are withheld
              // rather than shown with a caveat nobody would read.
              <Notice tone="warning" icon="alert" title="Your site did not finish loading in time">
                A preview gives each page twelve seconds. Nothing completed in that window, so treat
                the numbers above as partial — this is not a finding that your site is clean.
              </Notice>
            ) : s.consent_ui_detected ? (
              <Notice tone="neutral" icon="info" title="A consent interface is already there">
                Whether it stops any of this from running before somebody agrees is the question Rift answers.
              </Notice>
            ) : s.likely_need_consent > 0 ? (
              <Notice tone="warning" icon="alert" title="No consent interface was seen">
                {s.likely_need_consent} {s.likely_need_consent === 1 ? 'technology' : 'technologies'} here would
                ordinarily need consent first.
              </Notice>
            ) : (
              <Notice tone="success" icon="check" title="Nothing here obviously needs gating">
                A preview reads a few pages, so this is a good sign rather than a clean bill of health.
              </Notice>
            )}
          </div>

          {steps.length > 0 ? (
            <div data-result="block" className="mt-7">
              <h3 className="text-title-small font-medium text-md-on-surface">What to do about it</h3>
              <ol className="mt-4 flex flex-col divide-y divide-md-outline-variant">
                {steps.map((step, i) => (
                  <li key={step.title} className="flex gap-4 py-4">
                    <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-label-small font-medium text-md-on-secondary-container tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-body-medium font-medium text-md-on-surface">{step.title}</span>
                        <Chip tone={step.tone}>{step.effort}</Chip>
                      </span>
                      <span className="mt-1 block text-body-small leading-relaxed text-md-on-surface-variant">
                        {step.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {gated.length > 0 ? (
            <div data-result="block" className="mt-7">
              <h3 className="text-title-small font-medium text-md-on-surface">Would normally need consent</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {gated.slice(0, 10).map((t) => (
                  <Chip key={t.name} tone={t.crosses_border ? 'warning' : 'neutral'}>
                    {t.name}
                    {t.destination_country ? ` · ${t.destination_country}` : ''}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {result.destinations.length > 0 ? (
            <div data-result="block" className="mt-7">
              <h3 className="text-title-small font-medium text-md-on-surface">Where browsers connected</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.destinations.slice(0, 14).map((d) => (
                  <Chip key={d.host} tone={d.crosses_border ? 'warning' : 'neutral'}>
                    {d.host}
                  </Chip>
                ))}
                {result.destinations.length > 14 ? (
                  <Chip tone="neutral">+{result.destinations.length - 14}</Chip>
                ) : null}
              </div>
            </div>
          ) : null}

          <p data-result="block" className="mt-7 text-label-medium leading-relaxed text-md-on-surface-variant">
            <Icon name="info" size={14} className="mr-1 inline align-[-2px]" />
            {result.limits.note} Nothing was stored, and none of this is legal advice.
          </p>
        </div>
      </Card>

      <Card data-result="block" className="mt-4 rounded-2xl">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="max-w-[46ch]">
            <p className="text-title-small font-medium text-md-on-surface">Scan {host} properly</p>
            <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">
              The whole site, kept so you can see what changes, with the consent configuration written for you.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link href={`/signup?website=${encodeURIComponent(result.url)}`}>
              <Button variant="filled" size="lg" iconAfter="arrowRight" className="transition-transform hover:scale-[1.02]">
                Create an account
              </Button>
            </Link>
            <Link href="/signin">
              <Button variant="text" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
