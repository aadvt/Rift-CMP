import * as React from 'react';
import { cn } from './cn';

/**
 * Cards sit on a tonal surface, never pure white, and carry a generous 24px
 * radius. Depth comes from the surface step first and elevation second.
 *
 * `interactive` adds the MD3 hover contract: elevation 1 → 2, a 1.02 scale,
 * and a primary state layer. Use it only when the whole card is clickable.
 */
export function Card({
  className, interactive, tone = 'container', ...rest
}: React.HTMLAttributes<HTMLElement> & { interactive?: boolean; tone?: 'container' | 'low' | 'high' | 'outlined' }) {
  const TONE = {
    container: 'bg-md-surface-container',
    low: 'bg-md-surface-low',
    high: 'bg-md-surface-high',
    outlined: 'bg-md-surface border border-md-outline-variant',
  };
  return (
    <section
      className={cn(
        'rounded-lg shadow-e1 transition-all duration-[--md-duration-base] ease-md',
        TONE[tone],
        interactive && 'group cursor-pointer hover:scale-[1.02] hover:shadow-e2 active:scale-[0.99]',
        className,
      )}
      {...rest}
    />
  );
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...rest} />;
}

export function CardHeader({
  title, sub, action, className,
}: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex gap-4 justify-between', sub ? 'items-start' : 'items-center', className)}>
      <div className="min-w-0">
        <h3 className="text-title-large font-medium leading-tight text-md-on-surface">{title}</h3>
        {sub ? <p className="mt-1.5 text-label-medium leading-relaxed text-md-on-surface-variant">{sub}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
