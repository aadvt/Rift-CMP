import * as React from 'react';
import { cn } from './cn';

/** Plain numbers, no decoration. Tabular figures so columns line up. */
export function StatBlock({
  label, value, unit, meta, className,
}: { label: string; value: React.ReactNode; unit?: string; meta?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">{label}</div>
      <div className="mt-2 text-headline-medium font-normal leading-none tracking-[-0.01em] text-md-on-surface tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-title-large font-normal text-md-on-surface-variant">{unit}</span> : null}
      </div>
      {meta ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-label-medium leading-snug text-md-on-surface-variant">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
