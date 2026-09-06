'use client';
import * as React from 'react';
import { Button } from '@rift/ui';

/**
 * Saving a report as a PDF.
 *
 * ## Why the browser's own printer
 *
 * The alternatives were a client-side PDF library — a few hundred kilobytes
 * shipped to every screen so one button works, producing a second layout that
 * would drift from the real one the first time a card changed — or rendering it
 * server-side through the crawler's Chromium, which is a route, an
 * authentication path and a template to keep in step with the page it copies.
 *
 * The browser already has a renderer that agrees with the screen by
 * construction, and "Save as PDF" is a destination in every print dialog on
 * every platform this runs on. What that leaves to build is the stylesheet that
 * makes the print legible, which is the part with the actual value in it.
 *
 * It is honest about being print: the label says "Save as PDF" rather than
 * "Download", because a dialog opens and somebody has to choose a destination.
 * A button labelled Download that opens a print dialog is a small lie that
 * costs trust for nothing.
 *
 * ## What gets printed
 *
 * `@media print` in `globals.css` hides everything outside the element marked
 * `data-print-region`, so the nav, the sidebar and the actions do not come with
 * it. The date is stamped by the page, not by this button — a report without
 * one is undatable the moment it leaves the screen.
 */
export function ExportReportButton({
  label = 'Save as PDF',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Button
      variant="tonal"
      icon="download"
      className={className}
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}
