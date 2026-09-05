import { Button, Card, CardBody, CardHeader, Chip, Icon, Notice, cn } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { getScanDiff, listScans } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';
import type { DiffEntry } from '@/lib/api/types';

export const metadata = { title: 'Compare scans' };

/** Additions are tinted success, removals neutral. Nothing in a diff is an
 *  error, so the error role never appears here. */
const KIND = {
  added:   { label: 'Added',   icon: 'plus' as const,    wrap: 'bg-md-success-container/60 border-l-4 border-md-success', pill: 'bg-md-success-container text-md-on-success-container' },
  removed: { label: 'Removed', icon: 'minus' as const,   wrap: 'bg-md-surface-variant/70 border-l-4 border-md-outline',   pill: 'bg-md-surface-variant text-md-on-surface-variant' },
  changed: { label: 'Changed', icon: 'refresh' as const, wrap: 'bg-md-secondary-container/60 border-l-4 border-md-primary', pill: 'bg-md-secondary-container text-md-on-secondary-container' },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ baseline?: string; compared?: string }>;
}) {
  // Default to the two most recent completed scans, which is the comparison
  // anybody arriving here without naming one means.
  const params = await searchParams;
  const scans = await listScans(await requireSiteId());
  const finished = scans.filter(
    (s) => s.status === 'completed' || s.status === 'completed_with_limitations',
  );
  const compared = params.compared ?? finished[0]?.scanId ?? '';
  const baseline = params.baseline ?? finished[1]?.scanId ?? '';
  const diff = await getScanDiff(baseline, compared);
  const needsReview = [...diff.added, ...diff.changed].filter((d) => d.handling === 'needs_review').length;
  const total = diff.added.length + diff.removed.length + diff.changed.length;

  return (
    <>
      <ScreenHeader
        title="Compare scans"
        crumb={[{ label: 'Scans', href: '/dashboard/scans' }, { label: labelFor(diff.comparedScanId, diff.baselineScanId) }]}
        actions={<>
          <Button variant="tonal" icon="download">Export comparison</Button>
          <Button variant="filled" iconAfter="arrowRight">Review {needsReview} change{needsReview === 1 ? '' : 's'}</Button>
        </>}
      />

      <Screen>
        <div className="flex flex-col gap-5">
          <Card className="rounded-2xl">
            <CardBody className="flex flex-wrap items-center justify-between gap-8 p-7">
              <div className="flex flex-wrap items-end gap-4">
                <Picker label="Baseline" value="Aug 28, 2026 · 09:12" />
                <Icon name="arrowRight" size={22} className="mb-3 text-md-on-surface-variant" />
                <Picker label="Compared with" value="Sep 5, 2026 · 09:14" active />
              </div>
              <div className="flex flex-wrap items-center gap-8">
                {([
                  [diff.added.length, 'added', 'text-md-success'],
                  [diff.removed.length, 'removed', 'text-md-on-surface-variant'],
                  [diff.changed.length, 'changed', 'text-md-primary'],
                  [needsReview, 'needs review', 'text-md-warning'],
                ] as const).map(([n, l, c]) => (
                  <div key={l}>
                    <div className={cn('text-headline-medium font-normal leading-none tabular-nums', c)}>{n}</div>
                    <div className="mt-2 text-label-medium text-md-on-surface-variant">{l}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Card className="rounded-2xl">
              <CardBody className="p-7">
                <CardHeader
                  title="Changes since the previous scan"
                  sub="Additions are tinted green, removals neutral. Nothing here is an error."
                />
                <div className="mt-6 flex flex-col gap-7">
                  <Group kind="added" entries={diff.added} />
                  <Group kind="removed" entries={diff.removed} />
                  <Group kind="changed" entries={diff.changed} />
                </div>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-5">
              <Card className="overflow-hidden rounded-2xl">
                <div className="p-7"><CardHeader title="Side by side" /></div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {['Metric', 'Aug 28', 'Sep 5', 'Change'].map((h, i) => (
                        <th key={h} className={cn('h-12 bg-md-surface-container px-4 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant', i === 0 ? 'pl-7 text-left' : 'text-right', i === 3 && 'pr-7')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['Pages scanned', 41, 43], ['Cookies', 11, 12], ['Third-party services', 6, 7],
                      ['Technologies', 10, 11], ['Third-party requests', 62, 64], ['Unresolved findings', 0, 1],
                    ] as const).map(([m, a, b]) => {
                      const d = b - a;
                      return (
                        <tr key={m} className="border-b border-md-outline-variant/40 last:border-0">
                          <td className="py-3.5 pl-7 pr-4 text-body-medium font-medium text-md-on-surface">{m}</td>
                          <td className="px-4 py-3.5 text-right text-body-medium text-md-on-surface-variant tabular-nums">{a}</td>
                          <td className="px-4 py-3.5 text-right text-body-medium font-medium text-md-on-surface tabular-nums">{b}</td>
                          <td className="py-3.5 pl-4 pr-7 text-right">
                            {d === 0 ? (
                              <span className="text-body-medium text-md-on-surface-variant/70">—</span>
                            ) : (
                              <span className={cn('inline-flex items-center gap-1 text-body-medium font-medium tabular-nums', d > 0 ? 'text-md-success' : 'text-md-on-surface-variant')}>
                                <Icon name={d > 0 ? 'plus' : 'minus'} size={14} strokeWidth={2.2} />{Math.abs(d)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              <Notice tone="success" icon="check" title={`Rift applied ${total - needsReview} of these ${total} changes for you`}>
                Requests and cookies that matched technologies Rift already understands were folded into your
                configuration without changing any consent behaviour.
              </Notice>

              {needsReview > 0 ? (
                <Notice
                  tone="warning"
                  icon="question"
                  title={`${needsReview} change is waiting on you`}
                  actions={<>
                    <Button size="sm" variant="tonal">Review this change</Button>
                    <Button size="sm" variant="text">Accept Rift’s classification</Button>
                  </>}
                >
                  TikTok Pixel was classified as Marketing with <strong className="font-medium">likely</strong>{' '}
                  confidence. Rift configured it, but wants you to confirm the category before treating it as settled.
                </Notice>
              ) : null}
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Picker({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="min-w-[210px]">
      <div className="mb-2 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">{label}</div>
      <div className={cn(
        'flex h-12 items-center justify-between gap-3 rounded-full px-5 text-body-medium',
        active ? 'bg-md-secondary-container text-md-on-secondary-container' : 'bg-md-surface-variant text-md-on-surface-variant',
      )}>
        <span className="truncate">{value}</span>
        <Icon name="chevronDown" size={18} className="shrink-0" />
      </div>
    </div>
  );
}

function Group({ kind, entries }: { kind: keyof typeof KIND; entries: DiffEntry[] }) {
  if (!entries.length) return null;
  const k = KIND[kind];
  return (
    <div>
      <div className="mb-3.5 flex items-center gap-3">
        <span className="text-body-medium font-medium text-md-on-surface">{k.label}</span>
        <span className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-label-small font-medium tabular-nums', k.pill)}>
          {entries.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {entries.map((d) => (
          <div key={`${d.kind}-${d.name}`} className={cn('rounded-xl p-5', k.wrap)}>
            <div className="flex items-start gap-3.5">
              <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-md-surface', kind === 'added' ? 'text-md-success' : kind === 'changed' ? 'text-md-primary' : 'text-md-on-surface-variant')}>
                <Icon name={k.icon} size={16} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">{d.kind}</span>
                  <span className="text-body-medium font-medium text-md-on-surface">{d.name}</span>
                  {d.category ? <Chip tone="neutral">{d.category}</Chip> : null}
                </div>
                <div className="mt-1.5 break-all font-mono text-label-small text-md-on-surface-variant">{d.detail}</div>
                <div className="mt-2.5 text-label-medium leading-relaxed text-md-on-surface-variant">{d.note}</div>
              </div>
              <div className="shrink-0">
                {d.handling === 'automatic'
                  ? <Chip tone="success" glyph="check">Rift handled it</Chip>
                  : <Chip tone="warning">Needs review</Chip>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Two scan ids, short enough for a breadcrumb. */
function labelFor(compared: string, baseline: string): string {
  const short = (id: string) => (id && id !== '—' ? id.slice(0, 8) : 'none');
  return `${short(compared)} · ${short(baseline)}`;
}
