'use client';
import * as React from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export interface SegmentedOption<T extends string> { value: T; label: string }

/** MD3 segmented button: one outlined pill, hairline dividers between
 *  segments, and a secondary-container fill with a check on the selection. */
export function Segmented<T extends string>({
  options, value, onChange, className, 'aria-label': ariaLabel,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
  'aria-label': string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex h-10 items-stretch overflow-hidden rounded-full border border-md-outline', className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap px-4 text-label-medium font-medium',
              'transition-all duration-[--md-duration-fast] ease-md active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary',
              i > 0 && 'border-l border-md-outline',
              on
                ? 'bg-md-secondary-container text-md-on-secondary-container'
                : 'text-md-on-surface-variant hover:bg-md-primary/8',
            )}
          >
            {on ? <Icon name="check" size={16} strokeWidth={2.2} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
