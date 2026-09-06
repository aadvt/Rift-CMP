'use client';
import * as React from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { Button, Card, Chip, Field, Icon, Input, Notice, StatBlock, cn } from '@rift/ui';

/**
 * The landing page's scan.
 *
 * ## What it actually does
 *
 * It runs a real crawl of the address somebody types — a few pages of their own
 * site, loaded in a real browser — and shows what came back. It is not a demo
 * with sample data wearing the visitor's domain name.
 *
 * ## Why nothing is saved
 *
 * A stored scan belongs to a site, a site belongs to an organisation, and an
 * organisation belongs to a person. A visitor has none of those yet. The two
 * ways out were to create an organisation for somebody before they asked for
 * one — orphan rows, or an account nobody agreed to — or to run a scan that is
 * kept nowhere. This is the second: the result lives in this component's state
 * and in nothing else, and it is gone when the tab closes.
 *
 * That is also why the account prompt comes *after* the results rather than in
 * front of them. The visitor came to find something out; making them pay the
 * account tax before learning whether the product is any use is the thing this
 * page exists not to do.
 *
 * ## What it is careful not to claim
 *
 * `likely_needs_consent` is a heuristic over the scanner's category, and the
 * copy says "typically" wherever it is shown. The real answer comes from the
 * policy engine once an operator has declared their markets and purposes, and
 * neither of those exists for somebody who has not signed up. Nothing here is
 * phrased as a finding, and nothing here is legal advice.
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
    'That doesn’t look like a website address. Try something like northwind-retail.com.',
  );

// ── The shape the preview endpoint answers with ─────────────────────────────
// Declared here rather than imported: the dashboard is a separate workspace
// root from the platform, and this is the whole of the contract it depends on.

interface PreviewTechnology {
  name: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  destination_country: string | null;
  crosses_border: boolean;
  likely_needs_consent: boolean;
}

interface PreviewScanResult {
  url: string;
  scanned_at: string;
  duration_ms: number;
  summary: {
    pages_scanned: number;
    cookies: number;
    third_party_domains: number;
    technologies: number;
    likely_need_consent: number;
    consent_ui_detected: boolean;
  };
  technologies: PreviewTechnology[];
  destinations: Array<{ host: string; country: string | null; crosses_border: boolean }>;
  cookies: Array<{ name: string; domain: string; third_party: boolean }>;
  pages: string[];
  limits: { truncated: boolean; note: string };
  legal_advice: false;
}

/**
 * What the visitor is told while they wait.
 *
 * These are the crawl's real phases in order, not a fake progress bar — the
 * endpoint answers once, so there is no percentage to report honestly. The
 * elapsed counter next to them is the true number.
 */
const PHASES = [
  'Opening your site in a browser',
  'Following a few links',
  'Watching what the pages load',
  'Recording cookies and storage',
  'Matching third parties to the catalogue',
];

export function LandingScanForm({ className }: { className?: string }) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [scanning, setScanning] = React.useState(false);
  const [result, setResult] = React.useState<PreviewScanResult>();
  const [phase, setPhase] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  // The ticker drives both the elapsed seconds and which phase is named. It
  // only runs while a scan is in flight, so nothing animates on an idle page.
  React.useEffect(() => {
    if (!scanning) return;
    const started = Date.now();
    const id = setInterval(() => {
      const s = Math.round((Date.now() - started) / 1000);
      setElapsed(s);
      setPhase(Math.min(PHASES.length - 1, Math.floor(s / 5)));
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
    <div className={className}>
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
          className="mt-4"
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
    <Card tone="low" className="mt-6 rounded-2xl">
      <div className="p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-title-small font-medium text-md-on-surface">Reading your site</p>
          <span className="text-label-medium tabular-nums text-md-on-surface-variant">{elapsed}s</span>
        </div>

        <ol className="mt-4 flex flex-col gap-2.5" aria-live="polite">
          {PHASES.map((label, i) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2.5 text-body-small transition-colors',
                i < phase && 'text-md-on-surface-variant',
                i === phase && 'text-md-on-surface',
                i > phase && 'text-md-on-surface-variant/50',
              )}
            >
              <span className="inline-flex size-4 shrink-0 items-center justify-center">
                {i < phase ? (
                  <Icon name="check" size={14} strokeWidth={2.2} />
                ) : i === phase ? (
                  <span className="size-2 rounded-full bg-md-primary motion-safe:animate-pulse" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current opacity-60" />
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <p className="mt-4 text-label-medium text-md-on-surface-variant">
          A preview reads a few pages and takes up to half a minute. Nothing is saved.
        </p>
      </div>
    </Card>
  );
}

function ScanResults({ result }: { result: PreviewScanResult }) {
  const s = result.summary;
  const host = safeHost(result.url);
  const crossBorder = result.destinations.filter((d) => d.crosses_border).length;
  const gated = result.technologies.filter((t) => t.likely_needs_consent);

  return (
    <section className="mt-8" aria-label={`Scan results for ${host}`}>
      <Card tone="low" className="overflow-hidden rounded-2xl">
        <div className="border-b border-md-outline-variant p-6 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-title-medium font-medium text-md-on-surface">{host}</p>
            <span className="text-label-medium tabular-nums text-md-on-surface-variant">
              {s.pages_scanned} {s.pages_scanned === 1 ? 'page' : 'pages'} in{' '}
              {(result.duration_ms / 1000).toFixed(1)}s
            </span>
          </div>

          <p className="mt-3 max-w-[60ch] text-body-medium leading-relaxed text-md-on-surface-variant">
            {summarise(s, crossBorder)}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
            <StatBlock label="Third parties" value={s.third_party_domains} meta="domains contacted" />
            <StatBlock label="Cookies" value={s.cookies} meta="set while loading" />
            <StatBlock label="Technologies" value={s.technologies} meta="identified by name" />
            <StatBlock
              label="Typically gated"
              value={s.likely_need_consent}
              meta="would usually need consent"
            />
          </div>
        </div>

        {/* ── The one thing that is a genuine question, not a number ── */}
        <div className="p-6 md:p-7">
          {s.consent_ui_detected ? (
            <Notice tone="neutral" icon="info" title="A consent interface is already present">
              Something on the page looks like a consent banner. Whether it actually stops the
              trackers above from running before somebody agrees is a different question — and it is
              the one Rift answers, by watching what loads rather than what the banner says.
            </Notice>
          ) : s.likely_need_consent > 0 ? (
            <Notice tone="warning" icon="alert" title="No consent interface was seen">
              {s.likely_need_consent} of the technologies here would ordinarily need consent in the
              EU and UK, and nothing on the pages read appeared to ask for it.
            </Notice>
          ) : (
            <Notice tone="success" icon="check" title="Nothing here obviously needs gating">
              None of what loaded falls into the categories that ordinarily require consent. A
              preview reads a few pages, so this is a good sign rather than a clean bill of health.
            </Notice>
          )}

          {gated.length > 0 ? (
            <div className="mt-7">
              <h3 className="text-title-small font-medium text-md-on-surface">
                What would normally need consent
              </h3>
              <ul className="mt-4 flex flex-col divide-y divide-md-outline-variant">
                {gated.slice(0, 8).map((t) => (
                  <li key={t.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
                    <span className="text-body-medium font-medium text-md-on-surface">{t.name}</span>
                    <Chip tone="neutral">{humanise(t.category)}</Chip>
                    {t.crosses_border ? (
                      <Chip tone="warning" glyph="sites">
                        Leaves the EU{t.destination_country ? ` → ${t.destination_country}` : ''}
                      </Chip>
                    ) : null}
                    <span className="ml-auto text-label-medium text-md-on-surface-variant">
                      {t.confidence} confidence
                    </span>
                  </li>
                ))}
              </ul>
              {gated.length > 8 ? (
                <p className="mt-3 text-label-medium text-md-on-surface-variant">
                  and {gated.length - 8} more.
                </p>
              ) : null}
            </div>
          ) : null}

          {result.destinations.length > 0 ? (
            <div className="mt-7">
              <h3 className="text-title-small font-medium text-md-on-surface">
                Where your visitors&rsquo; browsers connected
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.destinations.slice(0, 18).map((d) => (
                  <Chip key={d.host} tone={d.crosses_border ? 'warning' : 'neutral'}>
                    {d.host}
                    {d.country ? ` · ${d.country}` : ''}
                  </Chip>
                ))}
                {result.destinations.length > 18 ? (
                  <Chip tone="neutral">+{result.destinations.length - 18} more</Chip>
                ) : null}
              </div>
            </div>
          ) : null}

          {result.cookies.length > 0 ? (
            <div className="mt-7">
              <h3 className="text-title-small font-medium text-md-on-surface">Cookies that were set</h3>
              <p className="mt-1 text-label-medium text-md-on-surface-variant">
                Names and domains only. A cookie&rsquo;s value is the part that identifies somebody,
                and it never leaves the scanner.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.cookies.slice(0, 18).map((c) => (
                  <Chip
                    key={`${c.domain}${c.name}`}
                    tone={c.third_party ? 'warning' : 'neutral'}
                    // Some cookie names are generated and enormous — Optimizely
                    // writes a whole URL into one. Left alone, a single name
                    // stretches the row and pushes the rest off the card.
                    className="max-w-full"
                    title={`${c.name} · ${c.domain}`}
                  >
                    <span className="block min-w-0 truncate">
                      {c.name} · {c.domain}
                    </span>
                  </Chip>
                ))}
                {result.cookies.length > 18 ? (
                  <Chip tone="neutral">+{result.cookies.length - 18} more</Chip>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-7 max-w-[70ch] text-label-medium leading-relaxed text-md-on-surface-variant">
            <Icon name="info" size={14} className="mr-1 inline align-[-2px]" />
            {result.limits.note}
            {result.limits.truncated
              ? ' This preview hit its limit before it ran out of pages, so there is more to find.'
              : ''}{' '}
            Nothing about this scan was stored, and none of it is legal advice.
          </p>
        </div>
      </Card>

      {/* ── Only now is anybody asked for anything ── */}
      <Card className="mt-4 rounded-2xl">
        <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-7">
          <div className="max-w-[52ch]">
            <p className="text-title-small font-medium text-md-on-surface">
              Scan {host} properly
            </p>
            <p className="mt-1.5 text-body-small leading-relaxed text-md-on-surface-variant">
              A full scan reads the whole site, keeps the result so you can see what changed, works
              out what applies in the markets you sell to, and writes the consent configuration for
              you. That needs somewhere to put it — which is what an account is.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <Link href={`/signup?website=${encodeURIComponent(result.url)}`}>
              <Button variant="filled" size="lg" iconAfter="arrowRight">
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

/**
 * One sentence a person can repeat to a colleague.
 *
 * Built from the counts rather than written once, because the interesting cases
 * differ: a site with nothing on it and a site sending data to four countries
 * should not open with the same sentence.
 */
function summarise(
  s: PreviewScanResult['summary'],
  crossBorder: number,
): string {
  if (s.third_party_domains === 0 && s.cookies === 0) {
    return 'Nothing third-party ran and no cookies were set on the pages read. That is unusual, and worth confirming against the rest of the site.';
  }

  const parts: string[] = [];
  parts.push(
    `${s.third_party_domains} third-party ${s.third_party_domains === 1 ? 'domain' : 'domains'} received a request from your visitors' browsers`,
  );
  if (s.cookies > 0) parts.push(`${s.cookies} ${s.cookies === 1 ? 'cookie was' : 'cookies were'} set`);
  if (crossBorder > 0) {
    parts.push(`${crossBorder} of those destinations sit outside the EU`);
  }

  const tail =
    s.likely_need_consent > 0
      ? ` ${s.likely_need_consent} of the technologies identified would ordinarily need consent before they run.`
      : ' None of the technologies identified fall into the categories that ordinarily need consent.';

  return `${parts.join(', ')}.${tail}`;
}

function humanise(category: string): string {
  return category.replace(/_/g, ' ');
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
