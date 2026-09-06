'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Icon, cn } from '@rift/ui';
import { signOut } from '@/app/actions';

/**
 * Leaving.
 *
 * It navigates to /signin rather than to /, because / sends a session holder
 * straight back to the dashboard and — for the moment between the action
 * finishing and the router noticing — that is exactly what somebody who just
 * signed out would see.
 *
 * `router.refresh()` is not optional. Every screen in the shell is a server
 * component whose data was fetched with the session that has just been revoked;
 * without it the client keeps rendering that cache and the app looks signed in
 * until something else happens to invalidate it.
 *
 * The pending state disables the control instead of showing a spinner. Two
 * sign-outs are harmless — the endpoint answers the same way for a token that
 * is already dead — but a button that stays live while it works invites the
 * second click that makes somebody wonder whether the first one registered.
 */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOut();
          router.push('/signin');
          router.refresh();
        })
      }
      className={cn(
        'flex h-12 w-full items-center gap-4 rounded-full px-5 text-label-medium font-medium',
        'text-md-on-surface-variant transition-all duration-[--md-duration-base] ease-md',
        'hover:bg-md-primary/10 hover:text-md-on-surface active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
        'disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
    >
      <Icon name="external" size={20} />
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
