'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  BlurField, Button, Card, CardBody, CardHeader, Chip, Confidence, Icon, Notice, Stepper, type Step,
} from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { FindingsExplorer } from '@/components/FindingsExplorer';
import { useScanProgress } from '@/hooks/useScanProgress';
import { RunScanButton } from '@/components/RunScanButton';
import { CancelScanButton } from '@/components/CancelScanButton';
import { CountUp } from '@/components/motion/CountUp';
import { ScanOrbit } from '@/components/motion/ScanOrbit';
import { ExportReportButton } from '@/components/ExportReportButton';
import type { Finding, Scan } from '@/lib/api/types';

/**
 * The scan screen holds four states on one route: running, completed,
 * completed-with-limitations, and failed. They are the same screen at
 * different moments, not different pages — the operator's context never
 * resets underneath them.
 */
export function ScanScreen({
  initial,
  findings,
  host,
  siteId,
}: {
  initial: Scan;
  findings: Finding[];
  host: string;
  siteId: string;
}) {
  const { scan, transport, done } = useScanProgress(initial.scanId, initial);
  const partial = scan.status === 'completed_with_limitations';
  const failed = scan.status === 'failed';

  return (
    <>
      <ScreenHeader
        title={done ? (partial ? 'Scan results' : 'Your website is understood') : `Scanning ${host}`}
        crumb={[{ label: 'Scans', href: '/dashboard/scans' }, { label: scan.scanId }]}
        badge={
          failed ? <Chip tone="error" dot>Failed</Chip>
          : partial ? <Chip tone="warning" dot>Completed with limitations</Chip>
          : done ? <Chip tone="success" glyph="check">Completed</Chip>
          : <Chip tone="primary" dot>Scanning</Chip>
        }
        actions={
          done ? (
            <>
              <ExportReportButton label="Save as PDF" />
              <Link href={`/dashboard/sites/${siteId}/privacy`}>
                <Button variant="filled" iconAfter="arrowRight">Review Rift configuration</Button>
              </Link>
            </>
          ) : (
            <CancelScanButton scanId={scan.scanId} />
          )
        }
      />

      <Screen>
        <div className="flex flex-col gap-5" data-print-region>
          {/* On screen the site and date are in the header bar, which does not
              print. A report that does not say which site it is about, or when
              it was taken, is not a report. */}
          <div className="hidden print:block">
            <h1 className="text-headline-medium text-md-on-surface">Rift scan report — {host}</h1>
            <p className="mt-1 text-body-small text-md-on-surface-variant">
              Scan {scan.scanId} · {new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })} · Reports what
              this website does. Not legal advice.
            </p>
          </div>

          {partial ? <LimitationsNotice scan={scan} siteId={siteId} /> : null}
          {done ? <Outcome scan={scan} partial={partial} host={host} /> : <Progress scan={scan} transport={transport} />}
          {done ? <ConfidenceKey /> : null}
          {done ? (
            <FindingsExplorer findings={findings} siteId={siteId} host={host} scanId={scan.scanId} />
          ) : null}
          {partial && scan.limitations?.unreachable.length ? <Unreachable scan={scan} /> : null}
        </div>
      </Screen>
    </>
  );
}

/* ── running ───────────────────────────────────────────────────────────── */

function Progress({ scan, transport }: { scan: Scan; transport: 'stream' | 'poll' }) {
  const steps: Step[] = scan.stages.map((s) => ({
    id: s.id,
    label: s.label,
    state: s.state === 'running' ? 'active' : s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : 'pending',
    ...(s.note ? { note: s.note } : s.state === 'running' ? { note: 'Working…' } : {}),
  }));

  const completed = scan.stages.filter((s) => s.state === 'done').length;
  const percent = Math.round((completed / scan.stages.length) * 100);

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <Card className="relative overflow-hidden rounded-2xl">
        <BlurField variant="panel" />
        <CardBody className="relative p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
                Discovering your website
              </h2>
              <p className="mt-3 max-w-[520px] text-body-medium leading-relaxed text-md-on-surface-variant">
                Rift is working through your website one stage at a time. Completed stages stay visible so you can see
                exactly what has been checked.
              </p>
            </div>
            {/* The orbit says "working", the percentage says "how far". Neither
                alone is enough: a spinner with no number is opaque, and a number
                that only moves nine times looks stuck between stages. */}
            <div className="flex shrink-0 items-center gap-6">
              <div className="text-right">
                <div className="text-display-large font-normal leading-none tracking-[-0.02em] text-md-primary tabular-nums">
                  <CountUp value={percent} duration={0.6} />
                  <span className="text-headline-medium text-md-on-surface-variant">%</span>
                </div>
                <div className="mt-2 text-label-medium text-md-on-surface-variant">
                  Stage {Math.min(completed + 1, 9)} of 9
                </div>
              </div>
              <ScanOrbit size={96} className="hidden sm:block" />
            </div>
          </div>

          <div className="mt-7 flex h-2 items-center gap-1.5 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-md-primary transition-[width] duration-[--md-duration-xslow] ease-md"
              style={{ width: `${percent}%` }}
            />
            <div className="h-full flex-1 rounded-full bg-md-primary/20" />
          </div>

          <Stepper steps={steps} className="mt-9" />
        </CardBody>
      </Card>

      <div className="flex flex-col gap-5">
        <FoundSoFar scan={scan} />
        <Notice tone="neutral" icon="info" title="You don’t need to stay on this page">
          Rift will email you and put the results in <span className="font-medium">Scans</span> when it finishes.
          {transport === 'poll' ? ' The live connection dropped, so this page is checking every few seconds instead.' : ''}
        </Notice>
      </div>
    </div>
  );
}

function FoundSoFar({ scan }: { scan: Scan }) {
  const c = scan.counts;
  return (
    <Card className="rounded-2xl">
      <CardBody className="p-7">
        <CardHeader title="What Rift has found so far" sub="Counts update as each stage completes." />
        <dl className="mt-5">
          <Counter label="Pages discovered" value={c.pages} />
          <Counter label="Cookies detected" value={c.cookies} />
          <Counter label="Third-party services" value={c.services} />
          <Counter label="Technologies identified" value={c.technologies} />
          <Counter label="Unresolved so far" value={c.unresolved} tone="warning" last />
        </dl>
      </CardBody>
    </Card>
  );
}

function Counter({ label, value, tone, last }: { label: string; value: number; tone?: 'warning'; last?: boolean }) {
  const shown = value > 0;
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <dt className="text-body-medium text-md-on-surface-variant">{label}</dt>
      <dd
        className={`text-title-large font-normal tabular-nums transition-colors duration-[--md-duration-slow] ease-md ${
          !shown ? 'text-md-on-surface-variant/50' : tone === 'warning' ? 'text-md-warning' : 'text-md-on-surface'
        }`}
      >
        {/* Counting rather than swapping is what makes this read as a live
            feed: a number that ticks 12 → 15 while you watch says three more
            were found, where a silent replacement says nothing happened. */}
        {shown ? <CountUp value={value} duration={0.6} /> : '—'}
      </dd>
    </div>
  );
}

/* ── completed ─────────────────────────────────────────────────────────── */

function Outcome({ scan, partial, host }: { scan: Scan; partial: boolean; host: string }) {
  const c = scan.counts;
  const stats: Array<[number, string, boolean?]> = [
    [c.cookies, 'cookies'],
    [c.services, 'third-party services'],
    [c.technologies, 'technologies'],
    [c.unresolved, 'unresolved', true],
  ];

  return (
    <Card className="relative overflow-hidden rounded-2xl">
      <BlurField variant="panel" />
      <CardBody className="relative p-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-[560px]">
            <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
              {partial ? 'Scan completed with limitations' : 'Your website is understood'}
            </h2>
            <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
              {partial
                ? 'Partial results are more trustworthy than a scan that pretends to be complete. Rift can still generate a configuration from what it found.'
                : <>Rift scanned {c.pages} {c.pages === 1 ? 'page' : 'pages'} of <span className="font-mono text-label-medium text-md-on-surface">{host}</span> and has enough information to prepare your consent configuration.</>}
            </p>
          </div>

          <div className="flex flex-wrap gap-8">
            {stats.map(([value, label, warn]) => (
              <div key={label}>
                <div className={`text-headline-medium font-normal leading-none tabular-nums ${warn && value > 0 ? 'text-md-warning' : 'text-md-on-surface'}`}>
                  {value}
                </div>
                <div className="mt-2 max-w-[92px] text-label-medium leading-snug text-md-on-surface-variant">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/** Teaching the three-level pattern is what stops "unresolved" being read as
 *  "violation" the first time an operator meets it. */
function ConfidenceKey() {
  const levels = [
    ['confirmed', 'Rift has strong evidence — a known technology matched on host, script and cookie behaviour.'],
    ['likely', 'Rift has evidence but the classification is not certain. It is configured, and you can change it.'],
    ['unresolved', 'Rift could not classify this item. It is not blocked, not flagged as unlawful, and does not require consent because of this.'],
  ] as const;

  return (
    <Card tone="low" className="rounded-2xl">
      <CardBody className="grid grid-cols-1 gap-6 p-7 md:grid-cols-3">
        {levels.map(([level, text]) => (
          <div key={level}>
            <Confidence level={level} />
            <p className="mt-3 text-label-medium leading-relaxed text-md-on-surface-variant">{text}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

/* ── partial ───────────────────────────────────────────────────────────── */

function LimitationsNotice({ scan, siteId }: { scan: Scan; siteId: string }) {
  const l = scan.limitations;
  if (!l) return null;

  // A budget is not a failure. Rift chose to stop; the website is fine, and the
  // heading has to say so or every large site looks broken on first scan.
  const budget = l.kind === 'budget';

  return (
    <Notice
      tone={budget ? 'neutral' : 'warning'}
      icon={budget ? 'info' : 'alert'}
      title={budget ? 'Rift scanned part of your website' : 'Some pages didn’t respond'}
      actions={
        <>
          {/* The unreachable pages are already tabled further down this
              screen, so this jumps to them rather than opening anything. A
              second surface showing the same rows is a second place for them to
              disagree. */}
          {l.unreachable.length ? (
            <a href="#unreachable">
              <Button size="sm" variant="tonal">View limitations</Button>
            </a>
          ) : null}
          <RunScanButton siteId={siteId} size="sm" variant="outlined">Scan again</RunScanButton>
        </>
      }
    >
      <strong className="font-medium">
        {l.pagesReached} of {l.pagesTotal} pages
      </strong>{' '}
      inspected. {l.reason} Nothing was discarded — everything below is real, and the
      configuration Rift generates uses it.
    </Notice>
  );
}

function Unreachable({ scan }: { scan: Scan }) {
  const l = scan.limitations;
  if (!l) return null;
  return (
    <Card id="unreachable" className="scroll-mt-24 overflow-hidden rounded-2xl">
      <div className="p-7">
        <CardHeader title="Pages Rift could not reach" sub="Each was attempted more than once before Rift moved on." />
      </div>
      <div className="overflow-x-auto">
        <table
                data-stack
                className="w-full border-collapse"
                style={{ ['--md-table-min' as string]: '620px' } as React.CSSProperties}
              >
          <thead>
            <tr>
              {['Page', 'What happened', 'Attempts'].map((h, i) => (
                <th
                  key={h}
                  className={`h-14 bg-md-surface-container px-7 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant ${i === 2 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {l.unreachable.map((u) => (
              <tr key={u.path} className="border-b border-md-outline-variant/40">
                <td data-label="Page" className="px-7 py-4 font-mono text-label-medium text-md-on-surface">{u.path}</td>
                <td data-label="What happened" className="px-7 py-4 text-body-medium text-md-on-surface-variant">{u.reason}</td>
                <td data-label="Attempts" className="px-7 py-4 text-right text-body-medium text-md-on-surface-variant tabular-nums">{u.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-7 py-5 text-label-medium text-md-on-surface-variant">
        These pages are queued for the next scan. You don&rsquo;t need to do anything.
      </p>
    </Card>
  );
}
