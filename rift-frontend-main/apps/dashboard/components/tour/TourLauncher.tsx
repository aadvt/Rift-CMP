'use client';
import { Icon, cn } from '@rift/ui';
import { useTour } from './TourHost';

/**
 * "Show me around this page."
 *
 * Sits in the sidebar rather than floating over the content, because a
 * permanent circular button in a corner is the single most common way a product
 * tour outstays its welcome. Here it is one row among the others, and somebody
 * who never wants it never has to look at it.
 *
 * It hides itself on pages with no tour rather than appearing and doing
 * nothing — a control that is present but inert teaches people the feature is
 * broken.
 */
export function TourLauncher({ className }: { className?: string }) {
  const { replay, available } = useTour();
  if (!available) return null;

  return (
    <button
      type="button"
      data-tour="tour-replay"
      onClick={replay}
      className={cn(
        'flex h-12 w-full items-center gap-4 rounded-full px-5 text-label-medium font-medium',
        'text-md-on-surface-variant transition-all duration-[--md-duration-base] ease-md',
        'hover:bg-md-primary/10 hover:text-md-on-surface active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
        className,
      )}
    >
      <Icon name="sparkle" size={20} />
      Show me around
    </button>
  );
}
