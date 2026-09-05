import * as React from 'react';
import { cn } from './cn';

/** Skeletons mirror the layout they replace — same heights, same columns —
 *  so nothing shifts when the data lands. */
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-full bg-[linear-gradient(90deg,var(--md-surface-container-high)_8%,var(--md-surface-variant)_22%,var(--md-surface-container-high)_36%)]',
        'bg-[length:200%_100%] motion-safe:animate-[md-shimmer_1.8s_linear_infinite]',
        className,
      )}
      {...rest}
    />
  );
}
