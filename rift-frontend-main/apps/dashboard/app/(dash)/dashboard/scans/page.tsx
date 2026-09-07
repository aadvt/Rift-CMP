import Link from 'next/link';
import { Button, Card, CardHeader, Chip, EmptyState, Icon } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { listScans } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';
import { RunScanButton } from '@/components/RunScanButton';

export const metadata = { title: 'Scans' };

export default async function ScansPage() {
  const siteId = await requireSiteId();
  const scans = await listScans(siteId);

  return (
    <>
      <ScreenHeader title="Scans" actions={<RunScanButton siteId={siteId} />} />
      <Screen>
        <Card>
          <div className="border-b border-md-outline-variant p-5 md:px-6">
            <CardHeader title="Scan history" sub="Select a scan to see exactly what changed since the one before it." />
          </div>

          {scans.length === 0 ? (
            <EmptyState
              icon="scans"
              title="No scans yet"
              body="Add your website and Rift will scan it for cookies, scripts, storage, trackers and third-party services."
              action={<Link href="/dashboard/sites/new"><Button variant="filled" icon="plus">Add website</Button></Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table
                data-stack
                className="w-full border-collapse"
                style={{ ['--md-table-min' as string]: '820px' } as React.CSSProperties}
              >
                <thead>
                  <tr>
                    {['Scan', 'Status', 'Pages', 'Cookies', 'Services', 'Unresolved', 'vs previous', ''].map((h, i) => (
                      <th
                        key={h || i}
                        className={`sticky top-0 z-[2] h-[42px] border-b border-md-outline-variant bg-md-surface-container px-4 text-label-small font-semibold uppercase tracking-[0.05em] text-md-on-surface-variant/75 ${i >= 2 && i <= 6 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s, i) => (
                    <tr key={s.scanId} className={`group transition-colors hover:bg-md-primary/8 ${i === 0 ? 'bg-md-primary/8' : ''}`}>
                      <td data-label="Scan" className="border-b border-md-outline-variant/40 px-4 py-[13px]">
                        <Link href={`/dashboard/scans/${s.scanId}`} className="flex items-center gap-3">
                          <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-sm ${i === 0 ? 'bg-md-secondary-container text-md-on-secondary-container' : 'bg-md-surface-variant text-md-on-surface-variant'}`}>
                            <Icon name="scans" size={16} />
                          </span>
                          <span>
                            <span className="block text-[13.5px] font-semibold text-md-on-surface">
                              {new Date(s.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="block font-mono text-label-small text-md-on-surface-variant/75">{s.scanId}</span>
                          </span>
                        </Link>
                      </td>
                      <td data-label="Status" className="border-b border-md-outline-variant/40 px-4 py-[13px]">
                        {/* Five statuses, not two. A running scan reported as
                            "completed with limitations" is merely confusing; a
                            failed one reported that way tells an operator their
                            scan partly succeeded when it did not run at all. */}
                        {s.status === 'completed'
                          ? <Chip tone="success" glyph="check">Completed</Chip>
                          : s.status === 'completed_with_limitations'
                            ? <Chip tone="warning">Completed with limitations</Chip>
                            : s.status === 'running'
                              ? <Chip tone="primary" dot>Scanning</Chip>
                              : s.status === 'queued'
                                ? <Chip tone="neutral" dot>Queued</Chip>
                                : <Chip tone="error">Failed</Chip>}
                      </td>
                      <td data-label="Pages" className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px] text-md-on-surface-variant tabular-nums">{s.counts.pages}</td>
                      <td data-label="Cookies" className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px] text-md-on-surface-variant tabular-nums">{s.counts.cookies}</td>
                      <td data-label="Services" className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px] text-md-on-surface-variant tabular-nums">{s.counts.services}</td>
                      <td data-label="Unresolved" className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px] tabular-nums">
                        {s.counts.unresolved === 0
                          ? <span className="text-md-on-surface-variant/75">—</span>
                          : <span className="font-semibold text-md-on-warning-container">{s.counts.unresolved}</span>}
                      </td>
                      <td data-label="vs previous" className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right text-[13.5px]">
                        {s.deltaTechnologies
                          ? <span className="font-semibold text-md-on-success-container">+{s.deltaTechnologies} new</span>
                          : <span className="text-md-on-surface-variant/75">No change</span>}
                      </td>
                      <td className="border-b border-md-outline-variant/40 px-4 py-[13px] text-right">
                        <Link href={`/dashboard/scans/compare?compared=${s.scanId}`} className="inline-block opacity-0 transition-opacity duration-[--md-duration-fast] group-hover:opacity-100">
                          <Button size="sm" variant="tonal">Compare</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Screen>
    </>
  );
}
