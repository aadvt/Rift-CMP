'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createColumnHelper } from '@tanstack/react-table';
import { Chip, DataTable, EmptyState, RowPeek, Button, cn } from '@rift/ui';
import type { Site, SiteStatus } from '@/lib/api/types';

const STATUS: Record<SiteStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'error' }> = {
  connected: { label: 'Connected', tone: 'success' },
  needs_review: { label: 'Needs review', tone: 'warning' },
  not_installed: { label: 'Not installed', tone: 'neutral' },
  installation_issue: { label: 'Installation issue', tone: 'error' },
};

const col = createColumnHelper<Site>();

export function SitesTable({ sites }: { sites: Site[] }) {
  const router = useRouter();

  const columns = React.useMemo(
    () => [
      col.accessor('host', {
        header: 'Website',
        size: 280,
        cell: (c) => (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-md-surface-variant font-mono text-xs text-md-on-surface-variant">
              {c.getValue().charAt(0).toUpperCase()}
            </span>
            <span className="truncate font-semibold tracking-[-0.004em] text-md-on-surface">{c.getValue()}</span>
          </div>
        ),
      }),
      col.accessor('status', {
        header: 'Status',
        cell: (c) => {
          const s = STATUS[c.getValue()];
          return <Chip tone={s.tone} dot>{s.label}</Chip>;
        },
      }),
      col.accessor('lastScanAt', {
        header: 'Last scan',
        cell: (c) => {
          const v = c.getValue();
          return v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
        },
      }),
      col.accessor((r) => r.counts.cookies, {
        id: 'cookies', header: 'Cookies', meta: { align: 'right' },
        cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
      }),
      col.accessor((r) => r.counts.services, {
        id: 'services', header: 'Services', meta: { align: 'right' },
        cell: (c) => <span className="tabular-nums">{c.getValue()}</span>,
      }),
      col.accessor((r) => r.counts.unresolved, {
        id: 'unresolved', header: 'Unresolved', meta: { align: 'right' },
        cell: (c) => {
          const n = c.getValue();
          return n === 0
            ? <span className="text-md-on-surface-variant/75">—</span>
            : <span className="font-semibold text-md-on-warning-container tabular-nums">{n}</span>;
        },
      }),
      col.accessor('consentRate', {
        header: 'Consent rate', meta: { align: 'right' },
        cell: (c) => {
          const v = c.getValue();
          return v === null
            ? <span className="text-md-on-surface-variant/75">—</span>
            : <span className="font-semibold text-md-on-surface tabular-nums">{v.toFixed(1)}%</span>;
        },
      }),
      col.display({
        id: 'peek', header: '', size: 44, meta: { align: 'right' },
        cell: () => <RowPeek />,
      }),
    ],
    [],
  );

  return (
    <DataTable
      data={sites}
      columns={columns}
      minWidth={880}
      onRowClick={(row) => router.push(`/dashboard/sites/${row.original.siteId}`)}
      empty={
        <EmptyState
          icon="sites"
          title="No websites yet"
          body="Add your website and Rift will scan it, work out what applies, and prepare your configuration."
          action={<Button variant="filled" icon="plus" onClick={() => router.push('/dashboard/sites/new')}>Add website</Button>}
        />
      }
    />
  );
}
