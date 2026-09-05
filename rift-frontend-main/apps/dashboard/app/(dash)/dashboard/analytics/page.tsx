import { Button, Card, CardBody, CardHeader, Notice, StatBlock } from '@rift/ui';
import { series } from '@rift/tokens';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { ConsentAffected, Donut, HBars, TrendLine } from '@/components/charts';
import { getAnalytics } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage() {
  const a = await getAnalytics(await requireSiteId());

  return (
    <>
      <ScreenHeader title="Analytics" badge={<ConsentAffected />} actions={<Button variant="filled" icon="settings">Configure analytics</Button>} />
      <Screen>
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-headline-medium font-semibold tracking-[-0.014em] text-md-on-surface">Visitor analytics</h2>
            <p className="mt-1.5 max-w-[720px] text-[13.5px] text-md-on-surface-variant">
              Measured from the consent-controlled event stream, so these numbers reflect only visitors whose consent
              allows measurement.
            </p>
          </div>

          <Notice
            tone="neutral"
            icon="consent"
            title="Analytics and consent are measured separately"
            actions={<Button size="sm" variant="tonal">See consent breakdown</Button>}
          >
            {a.analyticsConsentRate}% of visitors allowed the Analytics category in the last 14 days. Everything on this
            screen is measured from those visitors — Rift does not estimate or model the rest.
          </Notice>

          <Card>
            <CardBody className="grid grid-cols-2 gap-6 p-5 lg:grid-cols-4 lg:gap-0">
              <StatBlock label="Sessions" value={a.sessions.toLocaleString('en-US')} meta="Last 14 days" className="lg:pr-6" />
              <StatBlock label="Page views" value={a.pageViews.toLocaleString('en-US')} meta="Last 14 days" className="lg:border-l lg:border-md-outline-variant lg:px-6" />
              <StatBlock label="Pages per session" value={a.averageSessionLabel} meta="Across measured sessions" className="lg:border-l lg:border-md-outline-variant lg:px-6" />
              <StatBlock label="Analytics consent" value={`${a.analyticsConsentRate}%`} meta="Of decisions recorded" className="lg:border-l lg:border-md-outline-variant lg:pl-6" />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardHeader title="Sessions over time" sub="Sessions started by visitors whose consent allows measurement." action={<ConsentAffected />} />
              <TrendLine
                className="mt-6"
                height={220}
                ariaLabel="Daily sessions"
                points={a.trend.map((t) => ({ label: t.date, value: t.visitors }))}
              />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
            <Card>
              <div className="border-b border-md-outline-variant p-5 md:px-6"><CardHeader title="Top pages" /></div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Page', 'Views', 'Share'].map((h, i) => (
                        <th key={h} className={`h-[42px] border-b border-md-outline-variant bg-md-surface-container px-4 text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75 ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {a.topPages.map((p) => (
                      <tr key={p.path} className="transition-colors hover:bg-md-primary/8">
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] font-mono text-label-medium text-md-on-surface">{p.path}</td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px] text-md-on-surface-variant tabular-nums">{p.views.toLocaleString('en-US')}</td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px] text-md-on-surface-variant tabular-nums">{p.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardBody>
                <CardHeader title="Browsers" sub="Measured sessions by browser." />
                <HBars className="mt-5" rows={a.sources.map((s) => ({ label: s.source, value: s.sessions }))} />
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardHeader title="Devices" />
                <div className="mt-5 flex justify-center">
                  <Donut
                    size={142}
                    thickness={15}
                    slices={a.devices.map((d) => ({ label: d.device, value: d.share }))}
                    center={`${a.devices[0]?.share ?? 0}%`}
                    centerLabel={a.devices[0]?.device.toLowerCase() ?? ''}
                    ariaLabel="Sessions by device"
                  />
                </div>
                <div className="mt-5 flex flex-col gap-2.5">
                  {a.devices.map((d, i) => (
                    <div key={d.device} className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: series[i % series.length] }} />
                      <span className="flex-1 text-[12.5px] text-md-on-surface-variant">{d.device}</span>
                      <span className="text-[12.5px] font-semibold text-md-on-surface tabular-nums">{d.share}%</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </Screen>
    </>
  );
}
