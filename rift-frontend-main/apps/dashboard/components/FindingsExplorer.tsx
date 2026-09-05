'use client';
import * as React from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import {
  Button, Card, CardBody, CardHeader, Chip, Confidence, DataTable, DefRow, Drawer, DrawerSection,
  EmptyState, Icon, Notice, RecommendationPair, RowPeek, Segmented, cn,
} from '@rift/ui';
import type { Finding, ConfidenceLevel } from '@/lib/api/types';

const col = createColumnHelper<Finding>();
type Filter = 'all' | ConfidenceLevel;

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { confirmed: 0, likely: 1, unresolved: 2 };

/**
 * Scan findings.
 *
 * A row opens the side sheet rather than navigating away, so the operator
 * never loses their place in the list while triaging. Confidence is the
 * default sort because it is the axis that decides what needs attention.
 */
export function FindingsExplorer({ findings }: { findings: Finding[] }) {
  const [filter, setFilter] = React.useState<Filter>('all');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const rows = React.useMemo(
    () => findings.filter((f) => filter === 'all' || f.confidence === filter),
    [findings, filter],
  );

  const selected = findings.find((f) => f.findingId === openId) ?? null;

  const columns = React.useMemo(
    () => [
      col.accessor('name', {
        header: 'Technology',
        size: 300,
        cell: (c) => {
          const f = c.row.original;
          return (
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-body-medium font-medium',
                  f.confidence === 'unresolved'
                    ? 'bg-md-surface-variant text-md-on-surface-variant'
                    : 'bg-md-secondary-container text-md-on-secondary-container',
                )}
              >
                {f.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-md-on-surface">{f.name}</span>
                <span className="block truncate font-mono text-label-small text-md-on-surface-variant">{f.host}</span>
              </span>
            </div>
          );
        },
      }),
      col.accessor('category', {
        header: 'Rift category',
        cell: (c) => c.getValue() ?? <span className="text-md-on-surface-variant/70">Not classified</span>,
      }),
      col.accessor('confidence', {
        header: 'Confidence',
        sortingFn: (a, b) => CONFIDENCE_RANK[a.original.confidence] - CONFIDENCE_RANK[b.original.confidence],
        cell: (c) => <Confidence level={c.getValue()} />,
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (c) => {
          const v = c.getValue();
          return v === 'configured'
            ? <span>Configured</span>
            : <span className="font-medium text-md-on-warning-container">Needs review</span>;
        },
      }),
      col.accessor((r) => r.counts.cookies, {
        id: 'cookies', header: 'Cookies', meta: { align: 'right' },
        cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
      }),
      col.accessor((r) => r.counts.requests, {
        id: 'requests', header: 'Requests', meta: { align: 'right' },
        cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
      }),
      col.accessor('firstSeenAt', {
        header: 'First seen', meta: { align: 'right' },
        cell: (c) => {
          const f = c.row.original;
          const d = new Date(c.getValue()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return f.newSinceLastScan
            ? <span className="font-medium text-md-primary">{d}</span>
            : <span>{d}</span>;
        },
      }),
      col.display({ id: 'peek', header: '', size: 56, meta: { align: 'right' }, cell: () => <RowPeek /> }),
    ],
    [],
  );

  const counts = {
    confirmed: findings.filter((f) => f.confidence === 'confirmed').length,
    likely: findings.filter((f) => f.confidence === 'likely').length,
    unresolved: findings.filter((f) => f.confidence === 'unresolved').length,
  };

  return (
    <>
      <Card className="overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 p-7">
          <CardHeader
            title="Detected technologies"
            sub="Select a row to see the evidence behind the classification."
          />
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="success">{counts.confirmed} confirmed</Chip>
            <Chip tone="warning">{counts.likely} likely</Chip>
            <Chip tone="neutral">{counts.unresolved} unresolved</Chip>
          </div>
        </div>

        <div className="px-7 pb-5">
          <Segmented
            aria-label="Filter findings by confidence"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'likely', label: 'Likely' },
              { value: 'unresolved', label: 'Unresolved' },
            ]}
          />
        </div>

        <DataTable
          data={rows}
          columns={columns}
          minWidth={980}
          onRowClick={(r) => setOpenId(r.original.findingId)}
          isRowActive={(r) => r.original.findingId === openId}
          empty={
            <EmptyState
              icon="filter"
              title="Nothing at this confidence level"
              body="Rift did not classify anything here on this scan. Switch back to All to see every finding."
              action={<Button variant="tonal" onClick={() => setFilter('all')}>Clear filter</Button>}
            />
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-5 text-label-medium text-md-on-surface-variant">
          <span>Showing {rows.length} of {findings.length} technologies</span>
          <span>Evidence for every finding is kept with the scan that produced it.</span>
        </div>
      </Card>

      <FindingDrawer finding={selected} onClose={() => setOpenId(null)} total={findings.length} />
    </>
  );
}

function FindingDrawer({ finding, onClose, total }: { finding: Finding | null; onClose: () => void; total: number }) {
  // Keep the last finding while the sheet animates out, so content does not
  // vanish before the transition finishes.
  const [last, setLast] = React.useState<Finding | null>(finding);
  React.useEffect(() => { if (finding) setLast(finding); }, [finding]);

  const f = finding ?? last;
  if (!f) return null;

  const unresolved = f.confidence === 'unresolved';

  return (
    <Drawer
      open={Boolean(finding)}
      onOpenChange={(o) => { if (!o) onClose(); }}
      eyebrow={unresolved ? 'Needs review' : 'Detected technology'}
      title={f.name}
      sub={<>
        <Confidence level={f.confidence} />
        <Chip tone="neutral">{f.category ?? 'Not classified'}</Chip>
      </>}
      footer={<>
        <Button variant="filled">{unresolved ? 'Classify technology' : 'Change classification'}</Button>
        <Button variant="text">{unresolved ? 'Leave unresolved' : 'View in configuration'}</Button>
      </>}
    >
      <DrawerSection title="What Rift observed">
        <div className="rounded-lg bg-md-surface-container px-5 py-2">
          <DefRow label="Host"><span className="break-all font-mono text-label-medium">{f.host}</span></DefRow>
          <DefRow label="Vendor">
            {f.vendor ?? <span className="text-md-on-surface-variant/70">Not determined</span>}
          </DefRow>
          <DefRow label="Observed as">
            <span className="flex flex-wrap gap-2">
              {f.observedAs.map((o) => <Chip key={o} tone="neutral">{o}</Chip>)}
            </span>
          </DefRow>
          <DefRow label="Seen on">{f.counts.pagesSeenOn} of {f.counts.pagesTotal} pages</DefRow>
          <DefRow label="First seen">
            {new Date(f.firstSeenAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </DefRow>
        </div>
      </DrawerSection>

      <DrawerSection title="Evidence">
        <div className="overflow-hidden rounded-lg bg-md-surface-container">
          {f.evidence.map((e, i) => (
            <div key={e.kind} className={cn('flex gap-4 px-5 py-4', i < f.evidence.length - 1 && 'border-b border-md-outline-variant/40')}>
              <span className="w-[72px] shrink-0 pt-0.5 text-label-small font-medium uppercase tracking-[0.06em] text-md-on-surface-variant">
                {e.kind}
              </span>
              <span className="min-w-0 flex-1 break-all font-mono text-label-medium leading-relaxed text-md-on-surface-variant">
                {e.value}
              </span>
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection title="Classification">
        <RecommendationPair
          recommendation={f.recommendation?.category ?? 'No recommendation'}
          {...(f.recommendation?.rationale ? { recommendationNote: f.recommendation.rationale } : { recommendationNote: 'Not enough evidence to classify' })}
          decision={f.decision?.category ?? 'Not set'}
          decisionNote={f.decision ? 'Following Rift’s recommendation' : 'Waiting on your decision'}
          overridden={f.decision?.overridesRecommendation ?? false}
        />

        {unresolved ? (
          <Notice tone="neutral" icon="question" title="Unresolved is not a finding against you" className="mt-4">
            Rift needs more information before it can classify this. It has not been marked unlawful, it is not blocked,
            and it does not require consent because it is unresolved. You can classify it now or leave it for Rift to
            resolve on the next scan.
          </Notice>
        ) : null}
      </DrawerSection>

      <DrawerSection title="Consent behaviour">
        <div className="rounded-lg bg-md-surface-container p-5">
          <div className="text-body-medium font-medium text-md-on-surface">
            {f.consentBehaviour?.summary ?? 'No consent behaviour assigned'}
          </div>
          <p className="mt-2 text-label-medium leading-relaxed text-md-on-surface-variant">
            {f.consentBehaviour?.detail
              ?? 'Because Rift has not classified this technology, it has not been added to a consent category and its behaviour is unchanged. Classifying it will apply your consent configuration to it.'}
          </p>
        </div>
      </DrawerSection>

      <p className="text-label-small text-md-on-surface-variant">
        Finding {(f.findingId && total) ? `1 of ${total}` : ''} · evidence collected during the scan that found it
      </p>
    </Drawer>
  );
}
