import { Card, CardBody, CardHeader, Chip, Icon, cn } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { ReviewQueue } from '@/components/ReviewQueue';
import { getSite, getConfiguration, listChanges, listFindings } from '@/lib/api/endpoints';
import { latestScanId } from '@/lib/current-site';
import type { ChangeEntry } from '@/lib/api/types';

export const metadata = { title: 'Changes' };

const KIND = {
  added:   { icon: 'plus' as const,    cls: 'bg-md-success-container text-md-on-success-container' },
  removed: { icon: 'minus' as const,   cls: 'bg-md-surface-variant text-md-on-surface-variant' },
  changed: { icon: 'refresh' as const, cls: 'bg-md-secondary-container text-md-on-secondary-container' },
};

export default async function ChangesPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const scanId = await latestScanId(siteId);
  const [site, changes, findings, config] = await Promise.all([
    getSite(siteId),
    listChanges(siteId),
    scanId ? listFindings(scanId) : Promise.resolve([]),
    getConfiguration(siteId),
  ]);

  const queue = findings.filter((f) => f.status === 'needs_review');
  const groups = groupByDay(changes);

  return (
    <>
      <ScreenHeader
        title="Changes"
        crumb={[{ label: 'Sites', href: '/dashboard/sites' }, { label: site.host }]}
        badge={queue.length ? <Chip tone="warning" dot>{queue.length} need review</Chip> : <Chip tone="success" glyph="check">All handled</Chip>}
      />

      <Screen>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <ReviewQueue siteId={siteId} items={queue} categories={config.consent.categories} />

          <Card className="overflow-hidden rounded-2xl">
            <div className="p-7">
              <CardHeader title="Everything that changed" sub="Automatic and manual changes, newest first." />
            </div>
            <div className="px-7 pb-2">
              {groups.map(([day, items]) => (
                <div key={day} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="whitespace-nowrap text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                      {day}
                    </span>
                    <span className="h-px flex-1 bg-md-outline-variant/50" />
                  </div>
                  {items.map((c, i) => {
                    const k = KIND[c.kind];
                    return (
                      <div key={c.changeId} className={cn('flex gap-4 py-4', i < items.length - 1 && 'border-b border-md-outline-variant/40')}>
                        <span className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-full', k.cls)}>
                          <Icon name={k.icon} size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-body-medium font-medium text-md-on-surface">{c.title}</span>
                            <span className="text-label-medium text-md-on-surface-variant">{c.detail}</span>
                          </div>
                          <div className="mt-1 text-label-medium leading-relaxed text-md-on-surface-variant">{c.note}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-label-small text-md-on-surface-variant tabular-nums">
                            {new Date(c.occurredAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {c.handling === 'automatic'
                            ? <Chip tone="success" glyph="check">Handled</Chip>
                            : <Chip tone="warning">Needs review</Chip>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="px-7 py-5 text-label-medium text-md-on-surface-variant">
              {changes.length} changes in the last 7 days.
            </p>
          </Card>
        </div>
      </Screen>
    </>
  );
}

function groupByDay(changes: ChangeEntry[]): Array<[string, ChangeEntry[]]> {
  const map = new Map<string, ChangeEntry[]>();
  for (const c of changes) {
    const key = new Date(c.occurredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    map.set(key, [...(map.get(key) ?? []), c]);
  }
  return [...map.entries()];
}
