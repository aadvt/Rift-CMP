import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Icon, cn } from '@rift/ui';

/**
 * Sticky screen header: where you are, and one primary action.
 *
 * The title takes the MD3 headline role rather than a bolded body size —
 * generous type is doing the hierarchy work here, not weight.
 */
export function ScreenHeader({
  title, crumb, badge, actions, className,
}: {
  title: React.ReactNode;
  crumb?: Array<{ label: string; href?: Route }>;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-4 px-5 py-3 md:px-8',
        'bg-md-background/80 backdrop-blur-xl',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {crumb?.length ? (
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-2 text-label-small text-md-on-surface-variant">
            {crumb.map((c, i) => (
              <React.Fragment key={`${c.label}-${i}`}>
                {i > 0 ? <Icon name="chevronRight" size={14} className="opacity-60" /> : null}
                {c.href ? (
                  <Link href={c.href} className="rounded-full px-1 transition-colors hover:text-md-primary">{c.label}</Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="truncate text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">{title}</h1>
          {badge}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/** Content column. Generous max width — MD3 dashboards should feel airy. */
export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex-1 px-5 pb-16 pt-2 md:px-8', className)}>
      <div className="mx-auto max-w-[1320px]">{children}</div>
    </div>
  );
}
