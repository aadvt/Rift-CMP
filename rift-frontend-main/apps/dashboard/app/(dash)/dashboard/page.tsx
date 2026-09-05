import Link from 'next/link';
import {
  BlurField, Button, Card, CardBody, CardHeader, Chip, EmptyState, Icon, Notice, StatBlock, StatusDot,
} from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { SitesTable } from '@/components/SitesTable';
import { listSites, listChanges, getConsentOverview } from '@/lib/api/endpoints';
import { currentSiteId } from '@/lib/current-site';
import { series } from '@rift/tokens';
import type { ChangeEntry } from '@/lib/api/types';

export const metadata = { title: 'Overview' };

export default async function OverviewPage() {
  // The change feed is per site; the overview shows the one in focus, which is
  // the same site the shell's switcher is pointing at.
  const siteId = await currentSiteId();
  const [sites, changes, consent] = await Promise.all([
    listSites(),
    siteId ? listChanges(siteId) : Promise.resolve([]),
    siteId ? getConsentOverview(siteId, 7) : Promise.resolve(null),
  ]);

  const decisions = consent?.decisions ?? 0;
  // Percentages of nothing are still nothing. A split is only shown once there
  // is something to split.
  const split = decisions
    ? ([
        ['Accepted all', Math.round((consent!.breakdown.acceptedAll / decisions) * 100)],
        ['Rejected non-essential', Math.round((consent!.breakdown.rejectedNonEssential / decisions) * 100)],
        ['Custom preferences', Math.round((consent!.breakdown.custom / decisions) * 100)],
      ] as const)
    : ([] as ReadonlyArray<readonly [string, number]>);

  // "Protected" means the runtime is on the page and reporting. A site with
  // rows still waiting on a person is protected too — the configuration is
  // live and enforcing; there is simply something left to decide. Counting only
  // `connected` reported a site that was recording consent as not connected.
  const protectedSites = sites.filter(
    (s) => s.status === 'connected' || s.status === 'needs_review',
  ).length;
  const notConnected = sites.length - protectedSites;
  const unresolved = sites.reduce((n, s) => n + s.counts.unresolved, 0);
  const rated = sites.filter((s) => s.consentRate !== null);
  const avgConsent = rated.length
    ? (rated.reduce((n, s) => n + (s.consentRate ?? 0), 0) / rated.length).toFixed(1)
    : '—';

  return (
    <>
      <ScreenHeader
        title="Overview"
        actions={
          <Link href="/dashboard/sites/new">
            <Button variant="filled" icon="plus">Add website</Button>
          </Link>
        }
      />

      <Screen>
        <div className="flex flex-col gap-5">
          {/* The stat band is the first thing on the screen, so it carries the
              atmospheric layer and the largest radius on the page. */}
          <Card className="relative overflow-hidden rounded-2xl">
            <BlurField variant="panel" />
            <CardBody className="relative grid grid-cols-2 gap-y-8 p-7 lg:grid-cols-4 lg:gap-y-0">
              <StatBlock
                label="Sites protected"
                value={<>{protectedSites}<span className="text-[19px] font-semibold tracking-normal text-md-on-surface-variant/75"> / {sites.length}</span></>}
                meta={
                  notConnected > 0
                    ? <><StatusDot tone="neutral" /> {notConnected} not connected yet</>
                    : <><StatusDot tone="success" /> Every website is reporting</>
                }
                className="lg:pr-8"
              />
              <StatBlock
                label="Consent decisions"
                value={decisions.toLocaleString('en-US')}
                meta="Last 7 days"
                className="lg:border-l lg:border-md-outline-variant/60 lg:px-8"
              />
              <StatBlock
                label="Consent capture rate"
                value={avgConsent}
                unit="%"
                meta="Visitors who reached a decision"
                className="lg:border-l lg:border-md-outline-variant/60 lg:px-8"
              />
              <StatBlock
                label="Needs your attention"
                value={unresolved}
                meta={
                  unresolved > 0
                    ? <Link href={`/dashboard/sites/${siteId}`} className="font-semibold text-md-primary hover:underline">Review finding</Link>
                    : 'Nothing waiting on you'
                }
                className="lg:border-l lg:border-md-outline-variant/60 lg:pl-8"
              />
            </CardBody>
          </Card>

          <Card className="overflow-hidden rounded-2xl">
            <div className="p-7">
              <CardHeader title="Websites" sub="Select a row to open the site." />
            </div>
            <SitesTable sites={sites} />
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader
                  title="Recent changes"
                  action={<Link href={`/dashboard/sites/${siteId}/changes`}><Button variant="text" size="sm" iconAfter="chevronRight">View all</Button></Link>}
                />
                <div className="mt-3.5 flex flex-col">
                  {changes.slice(0, 5).map((c, i, arr) => (
                    <ChangeRow key={c.changeId} change={c} last={i === arr.length - 1} />
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-5">
              {unresolved > 0 ? (
                <Notice
                  tone="warning"
                  icon="question"
                  title={`${unresolved} unresolved technolog${unresolved === 1 ? 'y' : 'ies'}`}
                  actions={<>
                    <Link href={`/dashboard/sites/${siteId}/changes`}>
                      <Button size="sm" variant="tonal">Review</Button>
                    </Link>
                    <Button size="sm" variant="text">Leave unresolved</Button>
                  </>}
                >
                  Rift could not confidently determine what these do, so it left them unclassified. Nothing has been
                  blocked and no claim has been made about whether they require consent.
                </Notice>
              ) : (
                <Card>
                  <EmptyState
                    icon="check"
                    title="Nothing needs your attention"
                    body="Rift handled every change this week on its own. It will only interrupt you when a decision is genuinely yours."
                  />
                </Card>
              )}

              <Card className="rounded-2xl">
                <CardBody className="p-7">
                  <CardHeader title="Consent this week" action={<Link href="/dashboard/consent" className="text-label-medium font-medium text-md-primary hover:underline">Open consent</Link>} />
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-headline-large font-normal leading-none tracking-[-0.01em] text-md-on-surface tabular-nums">
                      {decisions.toLocaleString('en-US')}
                    </span>
                    <span className="text-label-medium text-md-on-surface-variant">decisions</span>
                  </div>

                  {split.length ? (
                    <>
                      <div className="mt-6 flex flex-col gap-3">
                        {split.map(([label, pct], i) => (
                          <div key={label} className="flex items-center gap-3">
                            <span className="h-2.5 w-4 shrink-0 rounded-full" style={{ background: series[i] }} />
                            <span className="min-w-0 flex-1 text-label-medium text-md-on-surface-variant">{label}</span>
                            <span className="text-label-medium font-medium text-md-on-surface tabular-nums">{pct}%</span>
                          </div>
                        ))}
                      </div>
                      {/* A single stacked bar reads the split faster than three numbers. */}
                      <div className="mt-5 flex h-3 gap-1 overflow-hidden rounded-full">
                        {split.map(([label, pct], i) => (
                          <span
                            key={label}
                            className="rounded-full transition-all duration-[--md-duration-xslow] ease-md"
                            style={{ width: `${pct}%`, background: series[i] }}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-label-medium leading-relaxed text-md-on-surface-variant">
                      No visitor has made a choice yet. Decisions appear here as soon as the Rift
                      snippet is live on your website.
                    </p>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function ChangeRow({ change, last }: { change: ChangeEntry; last: boolean }) {
  const kind = {
    added: { icon: 'plus', text: 'text-md-on-success-container', bg: 'bg-md-success-container' },
    removed: { icon: 'minus', text: 'text-md-on-surface-variant', bg: 'bg-md-surface-variant' },
    changed: { icon: 'refresh', text: 'text-md-on-secondary-container', bg: 'bg-md-secondary-container' },
  }[change.kind];

  return (
    <div className={`flex gap-4 py-4 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${kind.bg} ${kind.text}`}>
        <Icon name={kind.icon as 'plus'} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-body-medium font-medium text-md-on-surface">{change.title}</span>
          <span className="text-label-medium text-md-on-surface-variant">{change.detail}</span>
        </div>
        <div className="mt-1 text-label-medium text-md-on-surface-variant">{change.note}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="whitespace-nowrap text-label-small text-md-on-surface-variant">
          {new Date(change.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        {change.handling === 'automatic'
          ? <Chip tone="success" glyph="check">Handled</Chip>
          : <Chip tone="warning">Needs review</Chip>}
      </div>
    </div>
  );
}
