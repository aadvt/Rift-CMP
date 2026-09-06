'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@rift/ui';
import type { Finding } from '@/lib/api/types';

/**
 * Downloads the findings as CSV.
 *
 * ## Why the browser builds it
 *
 * The rows are already on this page — they were fetched to render the table.
 * Asking the server to fetch them again, format them and stream them back
 * would add a round trip, a route and a second code path that can disagree with
 * what the reader is looking at. A file built from the rendered data is
 * necessarily the same data.
 *
 * ## The confidence column is not decoration
 *
 * A findings export is the thing somebody forwards to a colleague, and once it
 * is a spreadsheet the provenance is gone unless it is a column. `confidence`
 * and `recommendation` travel with every row so that "unresolved" cannot be
 * quietly read as "fine" three inboxes later.
 */
function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote when the text carries anything a parser would otherwise split on, and
  // double any quote inside. A vendor name containing a comma is common enough
  // that skipping this produces a broken file on ordinary input.
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const COLUMNS: ReadonlyArray<readonly [string, (f: Finding) => string | number | null]> = [
  ['Technology', (f) => f.name],
  ['Vendor', (f) => f.vendor ?? ''],
  ['Host', (f) => f.host],
  ['Category', (f) => f.category ?? ''],
  ['Confidence', (f) => f.confidence],
  ['Status', (f) => f.status],
  ['Rift recommendation', (f) => f.recommendation?.category ?? ''],
  ['Rationale', (f) => f.recommendation?.rationale ?? ''],
  // Whether the decision differs from the recommendation is the column an
  // auditor looks for, and it is not recoverable from the two beside it: they
  // can agree by coincidence.
  ['Overrides recommendation', (f) => (f.decision?.overridesRecommendation ? 'yes' : 'no')],
  ['Cookies', (f) => f.counts.cookies],
  ['Requests', (f) => f.counts.requests],
  ['Pages seen on', (f) => `${f.counts.pagesSeenOn} of ${f.counts.pagesTotal}`],
  ['New since last scan', (f) => (f.newSinceLastScan ? 'yes' : 'no')],
  ['First seen', (f) => f.firstSeenAt],
];

export function ExportFindingsButton({
  findings,
  host,
  scanId,
}: {
  findings: Finding[];
  host: string;
  scanId: string;
}) {
  const [busy, setBusy] = React.useState(false);

  function download() {
    if (findings.length === 0) {
      toast('Nothing to export', { description: 'This scan produced no findings.' });
      return;
    }

    setBusy(true);
    try {
      const rows = [
        COLUMNS.map(([header]) => csvCell(header)).join(','),
        ...findings.map((f) => COLUMNS.map(([, read]) => csvCell(read(f))).join(',')),
      ].join('\r\n');

      // The BOM is what makes Excel read this as UTF-8. Without it a vendor
      // name with an accent in it arrives mangled, which looks like Rift got
      // the name wrong rather than like a spreadsheet encoding default.
      const blob = new Blob([`﻿${rows}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rift-findings-${host.replace(/[^a-z0-9.-]/gi, '-')}-${scanId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on the next tick rather than immediately: some browsers have
      // not started reading the blob by the time click() returns.
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success('Findings exported', {
        description: `${findings.length} row${findings.length === 1 ? '' : 's'} as CSV.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="tonal" icon="download" disabled={busy} onClick={download}>
      Export findings
    </Button>
  );
}
