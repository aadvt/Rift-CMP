import Link from 'next/link';
import type { Route } from 'next';
import { Button, Card, CardBody, CardHeader, Chip, Icon, Notice, StatusDot } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { HBars } from '@/components/charts';
import { getSite, getConfiguration, listChanges } from '@/lib/api/endpoints';
import { latestScanId } from '@/lib/current-site';

export const metadata = { title: 'Site overview' };

export default async function SiteOverviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const [site, config, changes, scanId] = await Promise.all([
    getSite(siteId), getConfiguration(siteId), listChanges(siteId), latestScanId(siteId),
  ]);

  const unresolved = site.counts.unresolved;

  return (
    <>
      <ScreenHeader
        title={site.host}
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }]}
        badge={site.status === 'connected' ? <Chip tone="success" dot>Connected</Chip> : <Chip tone="warning" dot>Needs review</Chip>}
        actions={<>
          <Button variant="tonal" icon="external">Open website</Button>
          <Button variant="filled" icon="scans">Run scan now</Button>
        </>}
      />

      {/* Section tabs — the site's own navigation, per the product IA. */}
      <div className="px-5 md:px-8">
        <div className="mx-auto flex max-w-[1320px] flex-wrap gap-2 border-b border-md-outline-variant pb-3">
          {([
            ['Overview', `/dashboard/sites/${siteId}`, true],
            ['Findings', scanId ? `/dashboard/scans/${scanId}` : '/dashboard/scans', false],
            ['Privacy configuration', `/dashboard/sites/${siteId}/privacy`, false],
            ['Installation', '/dashboard/install', false],
            ['Consent', '/dashboard/consent', false],
            ['Analytics', '/dashboard/analytics', false],
            ['Changes', `/dashboard/sites/${siteId}/changes`, false],
          ] as const).map(([label, href, active]) => (
            <Link
              key={label}
              href={href as Route}
              className={
                active
                  ? 'inline-flex h-10 items-center rounded-full bg-md-secondary-container px-5 text-label-medium font-medium text-md-on-secondary-container'
                  : 'inline-flex h-10 items-center rounded-full px-5 text-label-medium font-medium text-md-on-surface-variant transition-colors duration-[--md-duration-fast] ease-md hover:bg-md-primary/10'
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <Screen>
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
            <Card>
              <CardBody>
                <CardHeader title="Website health" action={<Chip tone={unresolved ? 'warning' : 'success'} dot>{unresolved ? 'Needs attention' : 'Healthy'}</Chip>} />
                <dl className="mt-3">
                  <Health tone="success" label="Connected" note={site.installedAt ? `Live since ${new Date(site.installedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Not installed yet'} />
                  <Health tone="success" label="Consent active" note="Banner and preference centre are serving" />
                  <Health tone="success" label="Tracking controls active" note={`${config.consent.categories.filter((c) => !c.alwaysActive).reduce((n, c) => n + c.technologyCount, 0)} non-essential technologies gated`} />
                  <Health tone="success" label="Scanner current" note={site.lastScanAt ? `Last scan ${new Date(site.lastScanAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Never scanned'} />
                  {unresolved ? <Health tone="warning" label={`${unresolved} item${unresolved === 1 ? '' : 's'} need review`} note="Waiting on your decision" last /> : null}
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardHeader title="What Rift discovered" sub={`From the most recent scan of ${site.counts.pages} pages.`} />
                <div className="mt-5 grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-0">
                  {([
                    ['pages', site.counts.pages], ['cookies', site.counts.cookies],
                    ['third-party services', site.counts.services], ['technologies', site.counts.technologies],
                  ] as const).map(([label, value], i) => (
                    <div key={label} className={i ? 'lg:border-l lg:border-md-outline-variant lg:pl-5' : 'lg:pr-5'}>
                      <div className="text-[28px] font-bold leading-tight tracking-[-0.022em] text-md-on-surface tabular-nums">{value}</div>
                      <div className="mt-1 text-[12.5px] text-md-on-surface-variant/75">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-md-outline-variant pt-5">
                  <div className="mb-3.5 text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75">
                    Technologies by consent category
                  </div>
                  <HBars
                    rows={config.consent.categories.map((c) => ({ label: c.name, value: c.technologyCount, display: String(c.technologyCount) }))}
                    labelWidth={104}
                    valueWidth={28}
                  />
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardBody>
                <CardHeader
                  title="Recent changes"
                  sub="Rift handles what it can and only brings you the rest."
                  action={
                    <Link href={`/dashboard/sites/${siteId}/changes` as Route}>
                      <Button variant="text" size="sm" iconAfter="chevronRight">View all</Button>
                    </Link>
                  }
                />
                <div className="mt-3.5 flex flex-col">
                  {changes.slice(0, 5).map((c, i, arr) => (
                    <div key={c.changeId} className={`flex gap-3 py-3 ${i < arr.length - 1 ? 'border-b border-md-outline-variant/40' : ''}`}>
                      <span className={`mt-px inline-flex size-[26px] shrink-0 items-center justify-center rounded-full ${c.kind === 'added' ? 'bg-md-success-container text-md-on-success-container' : c.kind === 'removed' ? 'bg-md-surface-variant text-md-on-surface-variant' : 'bg-md-secondary-container text-md-on-secondary-container'}`}>
                        <Icon name={c.kind === 'added' ? 'plus' : c.kind === 'removed' ? 'minus' : 'refresh'} size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[13.5px] font-semibold text-md-on-surface">{c.title}</span>
                          <span className="text-label-medium text-md-on-surface-variant">{c.detail}</span>
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-md-on-surface-variant/75">{c.note}</div>
                      </div>
                      {c.handling === 'automatic' ? <Chip tone="success" glyph="check">Handled</Chip> : <Chip tone="warning">Needs review</Chip>}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-5">
              {config.unresolved.length ? (
                <Notice
                  tone="warning"
                  icon="question"
                  title={`${config.unresolved.length} unresolved technolog${config.unresolved.length === 1 ? 'y' : 'ies'}`}
                  actions={<>
                    <Link href={`/dashboard/sites/${siteId}/changes` as Route}>
                      <Button size="sm" variant="tonal">Review</Button>
                    </Link>
                    <Button size="sm" variant="text">Leave unresolved</Button>
                  </>}
                >
                  Rift found <span className="font-mono text-xs text-md-on-surface">{config.unresolved[0]?.host}</span> but could not
                  determine its purpose. It has not been classified and no consent claim has been made about it.
                </Notice>
              ) : null}

              <Card>
                <CardBody>
                  <CardHeader title="Installation" action={<Chip tone="success" glyph="check">Verified</Chip>} />
                  <dl className="mt-3.5">
                    <Def label="Site identifier" value={site.siteId} mono />
                    <Def label="Configuration" value={site.configurationVersion ?? '—'} mono />
                    <Def label="Next scan" value={site.nextScanAt ? new Date(site.nextScanAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'} last />
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href="/dashboard/install/verify"><Button size="sm" variant="tonal" icon="refresh">Verify again</Button></Link>
                    <Link href="/dashboard/install"><Button size="sm" variant="text" icon="code">View snippet</Button></Link>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Health({ tone, label, note, last }: { tone: 'success' | 'warning'; label: string; note: string; last?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 py-2.5 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <StatusDot tone={tone} ring className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <dt className="text-[13.5px] font-semibold text-md-on-surface">{label}</dt>
        <dd className="mt-0.5 text-[12.5px] text-md-on-surface-variant">{note}</dd>
      </div>
    </div>
  );
}

function Def({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${last ? '' : 'border-b border-md-outline-variant/40'}`}>
      <dt className="text-label-medium text-md-on-surface-variant/75">{label}</dt>
      <dd className={`text-label-medium font-medium text-md-on-surface ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
