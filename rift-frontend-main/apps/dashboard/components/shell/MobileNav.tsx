'use client';
import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Icon, RiftMark, cn, type IconName } from '@rift/ui';
import type { Site } from '@/lib/api/types';

const NAV: Array<{ href: Route; label: string; icon: IconName }> = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/dashboard/sites', label: 'Sites', icon: 'sites' },
  { href: '/dashboard/scans', label: 'Scans', icon: 'scans' },
  { href: '/dashboard/consent', label: 'Consent', icon: 'consent' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'settings' },
];

/** Modal navigation drawer on small screens. Same 56px pills as the
 *  standard drawer, so the two read as one system. */
export function MobileNav({ activeSite }: { activeSite: Site | null }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-md-background/85 px-4 backdrop-blur-xl md:hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          aria-label="Open navigation"
          className="-ml-2 inline-flex size-12 items-center justify-center rounded-full text-md-on-surface-variant transition-all duration-[--md-duration-fast] ease-md hover:bg-md-primary/10 active:scale-95"
        >
          <Icon name="menu" size={24} />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-md-inverse-surface/32 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col overflow-hidden rounded-r-2xl bg-md-surface-low focus:outline-none data-[state=open]:animate-[md-slide-in_300ms_var(--md-ease)]">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 size-56 rounded-full bg-md-primary-container/50 blur-3xl" />
            <div className="relative flex h-[72px] items-center gap-3 px-6">
              <RiftMark size={30} />
              <span className="text-title-large font-medium text-md-on-surface">Rift</span>
            </div>
            <nav className="relative flex flex-col gap-1 p-3">
              {NAV.map((n) => {
                const active = n.href === '/dashboard' ? pathname === n.href : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      'flex h-14 items-center gap-4 rounded-full px-5 text-label-medium font-medium transition-colors',
                      active ? 'bg-md-secondary-container text-md-on-secondary-container' : 'text-md-on-surface-variant',
                    )}
                  >
                    <Icon name={n.icon} size={22} />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <span className="min-w-0 flex-1 truncate text-label-medium font-medium text-md-on-surface">{activeSite?.host ?? 'No website yet'}</span>
      <RiftMark size={30} />
    </div>
  );
}
