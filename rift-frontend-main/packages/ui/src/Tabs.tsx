'use client';
import * as React from 'react';
import * as RTabs from '@radix-ui/react-tabs';
import { cn } from './cn';

/** MD3 primary tabs: a full-height state layer and a rounded primary
 *  indicator that stops short of the tab's edges. */
export const Tabs = RTabs.Root;

export function TabsList({ className, ...rest }: React.ComponentProps<typeof RTabs.List>) {
  return <RTabs.List className={cn('flex items-center gap-1 border-b border-md-outline-variant', className)} {...rest} />;
}

export function TabsTrigger({ className, children, badge, ...rest }: React.ComponentProps<typeof RTabs.Trigger> & { badge?: React.ReactNode }) {
  return (
    <RTabs.Trigger
      className={cn(
        'group relative -mb-px inline-flex h-12 items-center gap-2 rounded-t-sm px-4',
        'text-label-medium font-medium text-md-on-surface-variant',
        'transition-colors duration-[--md-duration-fast] ease-md',
        'hover:bg-md-primary/8 data-[state=active]:text-md-primary',
        'after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-transparent',
        'after:transition-colors after:duration-[--md-duration-base] after:ease-md',
        'data-[state=active]:after:bg-md-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-inset',
        className,
      )}
      {...rest}
    >
      {children}
      {badge != null ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-md-surface-variant px-1.5 text-label-small font-medium text-md-on-surface-variant tabular-nums group-data-[state=active]:bg-md-secondary-container group-data-[state=active]:text-md-on-secondary-container">
          {badge}
        </span>
      ) : null}
    </RTabs.Trigger>
  );
}

export const TabsContent = RTabs.Content;
