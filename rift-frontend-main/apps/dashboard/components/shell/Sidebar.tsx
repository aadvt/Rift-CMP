'use client';
import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { Icon, RiftMark, cn, type IconName } from '@rift/ui';
import { SiteSwitcher } from './SiteSwitcher';
import type { Site } from '@/lib/api/types';

/** Navigation follows the customer mental model, never internal components.
 *  No crawler, policy engine, ingestion or event pipeline appears here. */
const NAV: Array<{ href: Route; label: string; icon: IconName }> = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/dashboard/sites', label: 'Sites', icon: 'sites' },
  { href: '/dashboard/scans', label: 'Scans', icon: 'scans' },
  { href: '/dashboard/consent', label: 'Consent', icon: 'consent' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' },
];

/**
 * MD3 navigation drawer.
 *
 * Destinations are 56px pills, not rows — the active one takes a
 * secondary-container fill rather than a border or a colour swap. Inactive
 * items get a primary state layer on hover. This pill shape is the single
 * most recognisable Material You signal in the whole shell.
 */
export function Sidebar({
  sites,
  activeSite,
  organisation,
  className,
}: {
  sites: Site[];
  activeSite: Site | null;
  organisation: { name: string; slug: string } | null;
  className?: string;
}) {
  const pathname = usePathname();
  const attention = sites.reduce((n, s) => n + s.counts.unresolved, 0);

  return (
    <aside className={cn('relative w-[268px] shrink-0 flex-col overflow-hidden bg-md-surface-low', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="md-drift absolute -left-16 -top-24 size-64 rounded-full bg-md-primary-container/50 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 size-52 rounded-full bg-md-tertiary-container/40 blur-3xl" />
      </div>

      <div className="relative flex h-[72px] items-center gap-3 px-6">
        <RiftMark size={32} />
        <span className="text-title-large font-medium tracking-tight text-md-on-surface">Rift</span>
      </div>

      <div className="relative px-4 pb-4 pt-2">
        {activeSite ? <SiteSwitcher sites={sites} active={activeSite} /> : <NoSiteYet />}
      </div>

      <nav className="relative flex flex-col gap-1 px-3">
        {NAV.map((n) => {
          const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex h-14 items-center gap-4 rounded-full px-5 text-label-medium font-medium',
                'transition-all duration-[--md-duration-base] ease-md active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-surface-low',
                active
                  ? 'bg-md-secondary-container text-md-on-secondary-container'
                  : 'text-md-on-surface-variant hover:bg-md-primary/10',
              )}
            >
              <Icon
                name={n.icon}
                size={22}
                className={cn('transition-colors', active ? 'text-md-on-secondary-container' : 'text-md-on-surface-variant')}
              />
              <span className="flex-1">{n.label}</span>
              {n.label === 'Sites' && attention > 0 ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-md-warning-container px-2 text-label-small font-medium text-md-on-warning-container tabular-nums">
                  {attention}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="relative mt-auto p-3">
        <Link
          href="/dashboard/settings"
          className={cn(
            'flex h-14 items-center gap-4 rounded-full px-5 text-label-medium font-medium',
            'transition-all duration-[--md-duration-base] ease-md active:scale-[0.98]',
            pathname.startsWith('/dashboard/settings')
              ? 'bg-md-secondary-container text-md-on-secondary-container'
              : 'text-md-on-surface-variant hover:bg-md-primary/10',
          )}
        >
          <Icon name="settings" size={22} />
          Settings
        </Link>

        {/* The platform authenticates an organisation, not a person. Showing a
            name and avatar here would invent an account that does not exist. */}
        <div className="mt-2 flex items-center gap-3 rounded-full px-4 py-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-md-tertiary-container text-label-medium font-medium text-md-on-tertiary-container">
            {(organisation?.name ?? '?').slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label-medium font-medium text-md-on-surface">
              {organisation?.name ?? 'Not signed in'}
            </span>
            <span className="block truncate text-label-small text-md-on-surface-variant">
              {organisation ? 'Organisation' : 'No credential configured'}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * What stands where the switcher goes before there is anything to switch
 * between. It is the first step of the journey, not an error — an organisation
 * that has just signed up is in exactly this state.
 */
function NoSiteYet() {
  return (
    <Link
      href="/dashboard/sites/new"
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl bg-md-surface-container p-3 text-left',
        'transition-all duration-[--md-duration-base] ease-md',
        'hover:bg-md-surface-high hover:shadow-e1 active:scale-[0.98]',
      )}
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-md-on-secondary-container">
        <Icon name="plus" size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label-medium font-medium text-md-on-surface">Add your website</span>
        <span className="mt-0.5 block text-label-small text-md-on-surface-variant">Nothing scanned yet</span>
      </span>
    </Link>
  );
}
