import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Icon, cn } from '@rift/ui';
import { Reveal } from '@/components/motion/Reveal';

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
      <div data-tour="page-title" className="min-w-0 flex-1">
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
      {actions ? (
        <div data-tour="page-actions" className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * Content column. Generous max width — MD3 dashboards should feel airy.
 *
 * ## Why the arrival animation lives here
 *
 * `PageTransition` already fades and lifts the whole page on every route
 * change. What it cannot do is give a screen internal order: everything inside
 * arrives as one flat rectangle, which on a page of six cards reads as a
 * printout rather than an interface assembling itself.
 *
 * Staggering here gives every screen that sequence from one place. The
 * alternative was adding a `Reveal` to each of twenty-five pages by hand, which
 * is twenty-five chances to forget one and have a single screen that behaves
 * differently for no reason anybody could name.
 *
 * The stagger is small — 55ms — and the travel is 14px. This is arrival, not
 * entrance: it should be finished before somebody has decided where to look,
 * and noticed only if it were removed.
 *
 * `reveal={false}` is for a screen that already choreographs its own contents.
 * The overview does, and nesting one stagger inside another compounds the
 * delays until the last card lands well after the reader has started reading.
 */
export function Screen({
  children,
  className,
  reveal = true,
}: {
  children: React.ReactNode;
  className?: string;
  reveal?: boolean;
}) {
  return (
    <div className={cn('flex-1 px-5 pb-16 pt-2 md:px-8', className)}>
      <div className="mx-auto max-w-[1320px]">
        {reveal ? (
          <Reveal stagger={0.055} y={14} descendWhenSingle>
            {children}
          </Reveal>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
