import { Button, Card, CardBody, CardHeader, Chip, StatBlock } from '@rift/ui';
import { series } from '@rift/tokens';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { ConsentAffected, Donut, HBars, Legend } from '@/components/charts';
import { getConsentAnalytics, getConsentOverview, listConsentRecords } from '@/lib/api/endpoints';
import { ConsentAnalytics } from '@/components/intelligence/ConsentAnalytics';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Consent' };

const DECISION_TONE = {
  accepted_all: { label: 'Accepted all', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'neutral' },
  custom: { label: 'Custom', tone: 'primary' },
  withdrawn: { label: 'Withdrawn', tone: 'warning' },
} as const;

export default async function ConsentPage() {
  const siteId = await requireSiteId();
  const [c, records, analytics] = await Promise.all([
    getConsentOverview(siteId),
    listConsentRecords(siteId),
    // Same filter semantics as the API: a site here means the same site there.
    getConsentAnalytics(siteId),
  ]);

  const slices = [
    { label: 'Accepted all', value: c.breakdown.acceptedAll },
    { label: 'Rejected non-essential', value: c.breakdown.rejectedNonEssential },
    { label: 'Custom preferences', value: c.breakdown.custom },
  ];

  return (
    <>
      <ScreenHeader title="Consent" badge={<ConsentAffected />}  />
      <Screen>
        {/* The decisions themselves, with the dimensions Rift will not answer
            named rather than shown as zero. */}
        <div className="mb-6">
          <ConsentAnalytics data={analytics} />
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="text-headline-medium font-semibold tracking-[-0.014em] text-md-on-surface">Consent overview</h2>
            <p className="mt-1.5 text-[13.5px] text-md-on-surface-variant">
              Operational consent data. This is not visitor analytics — the two are kept separate on purpose.
            </p>
          </div>

          <Card>
            <CardBody className="grid grid-cols-2 gap-6 p-5 lg:grid-cols-5 lg:gap-0">
              <StatBlock label="Consent decisions" value={c.decisions.toLocaleString('en-US')} meta="Last 14 days" className="lg:pr-5" />
              <StatBlock label="Capture rate" value={c.captureRate} unit="%" meta="Visitors who reached a decision" className="lg:border-l lg:border-md-outline-variant lg:px-5" />
              <StatBlock
                label="Accepted all"
                value={c.decisions ? Math.round((c.breakdown.acceptedAll / c.decisions) * 100) : 0}
                unit="%"
                meta={`${c.breakdown.acceptedAll.toLocaleString('en-US')} of ${c.decisions.toLocaleString('en-US')} decisions`}
                className="lg:border-l lg:border-md-outline-variant lg:px-5"
              />
              <StatBlock
                label="Withdrawals"
                value={c.withdrawals}
                meta={
                  c.decisions
                    ? `${((c.withdrawals / c.decisions) * 100).toFixed(1)}% of decisions`
                    : 'No decisions yet'
                }
                className="lg:border-l lg:border-md-outline-variant lg:px-5"
              />
              <StatBlock label="Config versions" value={c.configurationVersions} meta="In the last 14 days" className="lg:border-l lg:border-md-outline-variant lg:pl-5" />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Card>
              <CardBody>
                <CardHeader title="Consent decisions" sub="How visitors responded in the last 14 days." />
                <div className="mt-5 flex flex-wrap items-center gap-6">
                  <Donut slices={slices} center={c.decisions.toLocaleString('en-US')} centerLabel="decisions" ariaLabel="Consent decisions by type" />
                  <div className="flex min-w-[180px] flex-1 flex-col gap-3.5">
                    {slices.map((s, i) => (
                      <div key={s.label}>
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-sm" style={{ background: series[i] }} />
                          <span className="min-w-0 flex-1 text-label-medium font-medium text-md-on-surface">{s.label}</span>
                          {/* `slices` carries counts; the share is derived here so the
                              two numbers can never disagree. */}
                          <span className="text-sm font-semibold text-md-on-surface tabular-nums">
                            {c.decisions ? Math.round((s.value / c.decisions) * 100) : 0}%
                          </span>
                        </div>
                        <div className="ml-[17px] mt-0.5 text-xs text-md-on-surface-variant/75 tabular-nums">
                          {s.value.toLocaleString('en-US')} {s.value === 1 ? 'decision' : 'decisions'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardHeader
                  title="Consent trend"
                  sub="Decisions per day, split by what visitors chose."
                  action={<Legend items={[
                    { label: 'Accepted all', color: series[0] },
                    { label: 'Rejected', color: series[1] },
                    { label: 'Custom', color: series[2] },
                  ]} />}
                />
                <div className="mt-6 flex h-[208px] items-end gap-2">
                  {c.trend.map((d) => {
                    const total = d.acceptedAll + d.rejected + d.custom;
                    const max = Math.max(...c.trend.map((t) => t.acceptedAll + t.rejected + t.custom));
                    return (
                      <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${total} decisions`}>
                        <div className="flex flex-col justify-end" style={{ height: `${(total / max) * 100}%` }}>
                          <div style={{ height: `${(d.custom / total) * 100}%`, background: series[2], boxShadow: '0 -2px 0 0 #fff', borderRadius: '3px 3px 0 0' }} />
                          <div style={{ height: `${(d.rejected / total) * 100}%`, background: series[1], boxShadow: '0 -2px 0 0 #fff' }} />
                          <div style={{ height: `${(d.acceptedAll / total) * 100}%`, background: series[0], borderRadius: '0 0 3px 3px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between border-t border-md-outline-variant pt-2 text-[11px] text-md-on-surface-variant/75">
                  <span>{c.trend[0]?.date}</span>
                  <span>{c.trend[c.trend.length - 1]?.date}</span>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardBody>
                <CardHeader title="Consent by region" sub="Decisions recorded in each region." />
                <HBars className="mt-5" rows={c.byRegion.map((r) => ({ label: r.region, value: r.decisions }))} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardHeader title="Consent by category" sub="Share of visitors who allowed each category." />
                <HBars className="mt-5" rows={c.byCategory.map((r) => ({ label: r.category, value: r.allowedRate, display: `${r.allowedRate}%` }))} valueWidth={44} />
                <p className="mt-5 rounded-sm border border-md-outline-variant bg-md-background p-3.5 text-[12.5px] leading-relaxed text-md-on-surface-variant">
                  <span className="font-semibold text-md-on-surface">Necessary is not shown.</span> Necessary technologies are
                  always available where applicable, so there is no consent share to report for them.
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <div className="border-b border-md-outline-variant p-5 md:px-6">
              <CardHeader title="Consent records" sub="Each record keeps the decision, the region it was made in, and the configuration version that was live." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    {['Record', 'When', 'Region', 'Decision', 'Categories allowed', 'Configuration', 'Channel'].map((h) => (
                      <th key={h} className="sticky top-0 z-[2] h-[42px] border-b border-md-outline-variant bg-md-surface-container px-4 text-left text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const d = DECISION_TONE[r.decision];
                    return (
                      <tr key={r.recordId} className="transition-colors hover:bg-md-primary/8">
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] font-mono text-xs text-md-on-surface">{r.recordId}</td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-[13.5px] text-md-on-surface-variant">
                          {new Date(r.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-[13.5px] text-md-on-surface-variant">{r.region}</td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px]"><Chip tone={d.tone}>{d.label}</Chip></td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-[13.5px] text-md-on-surface-variant">
                          {r.categoriesAllowed.length ? r.categoriesAllowed.join(', ') : 'Necessary only'}
                        </td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] font-mono text-xs text-md-on-surface-variant">{r.configurationVersion}</td>
                        <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-[13.5px] text-md-on-surface-variant">
                          {r.channel === 'banner' ? 'Banner' : 'Preference centre'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </Screen>
    </>
  );
}
