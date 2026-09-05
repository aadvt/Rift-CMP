'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Icon, StatusDot, cn } from '@rift/ui';
import type { Site, SiteStatus } from '@/lib/api/types';
import { selectSite } from '@/app/actions';

const STATUS_LABEL: Record<SiteStatus, string> = {
  connected: 'Connected',
  needs_review: 'Needs review',
  not_installed: 'Not installed',
  installation_issue: 'Installation issue',
};

const STATUS_TONE = {
  connected: 'success', needs_review: 'warning', not_installed: 'neutral', installation_issue: 'error',
} as const;

/** The workspace pivot. A tonal container rather than an outlined control —
 *  it should read as part of the drawer, not stamped on top of it. */
export function SiteSwitcher({ sites, active }: { sites: Site[]; active: Site }) {
  const router = useRouter();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl bg-md-surface-container p-3 text-left',
          'transition-all duration-[--md-duration-base] ease-md',
          'hover:bg-md-surface-high hover:shadow-e1 active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-surface-low',
        )}
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-md-primary text-title-large font-medium text-md-on-primary">
          {active.host.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-medium font-medium text-md-on-surface">{active.host}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-label-small text-md-on-surface-variant">
            <StatusDot tone={STATUS_TONE[active.status]} className="size-1.5" />
            {STATUS_LABEL[active.status]}
          </span>
        </span>
        <Icon name="chevronUpDown" size={20} className="shrink-0 text-md-on-surface-variant" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-50 w-[268px] rounded-2xl bg-md-surface-high p-2 shadow-e3 data-[state=open]:animate-[md-rise_200ms_var(--md-ease)]"
        >
          <div className="px-4 py-2 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
            Your websites
          </div>
          {sites.map((s) => (
            <DropdownMenu.Item
              key={s.siteId}
              onSelect={() => {
                // Remember the choice before navigating, so the screens without
                // a site in their URL follow the switcher rather than ignoring it.
                void selectSite(s.siteId).then(() => router.push(`/dashboard/sites/${s.siteId}`));
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 text-label-medium outline-none',
                'transition-colors duration-[--md-duration-fast] ease-md data-[highlighted]:bg-md-primary/10',
                s.siteId === active.siteId && 'bg-md-secondary-container',
              )}
            >
              <StatusDot tone={STATUS_TONE[s.status]} />
              <span className="min-w-0 flex-1 truncate font-medium text-md-on-surface">{s.host}</span>
              {s.counts.unresolved > 0 ? (
                <span className="text-label-small font-medium text-md-on-warning-container tabular-nums">{s.counts.unresolved}</span>
              ) : null}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-2 h-px bg-md-outline-variant" />
          <DropdownMenu.Item
            onSelect={() => router.push('/dashboard/sites/new')}
            className="flex cursor-pointer items-center gap-3 rounded-full px-4 py-3 text-label-medium font-medium text-md-primary outline-none transition-colors data-[highlighted]:bg-md-primary/10"
          >
            <Icon name="plus" size={20} />
            Add website
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
