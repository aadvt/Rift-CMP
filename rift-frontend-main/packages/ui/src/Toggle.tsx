'use client';
import * as React from 'react';
import * as Switch from '@radix-ui/react-switch';
import { cn } from './cn';

/**
 * MD3 switch. The thumb grows when checked and the track carries an outline
 * when it is not — so on/off is legible without relying on colour.
 */
export function Toggle({ className, ...rest }: React.ComponentProps<typeof Switch.Root>) {
  return (
    <Switch.Root
      className={cn(
        'group inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 px-0.5',
        'border-md-outline bg-md-surface-variant',
        'transition-colors duration-[--md-duration-fast] ease-md',
        'data-[state=checked]:border-md-primary data-[state=checked]:bg-md-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2',
        className,
      )}
      {...rest}
    >
      <Switch.Thumb
        className={cn(
          'block size-4 rounded-full bg-md-outline shadow-e1',
          'transition-all duration-[--md-duration-fast] ease-md',
          'group-data-[state=checked]:size-6 group-data-[state=checked]:translate-x-5 group-data-[state=checked]:bg-md-on-primary',
        )}
      />
    </Switch.Root>
  );
}
