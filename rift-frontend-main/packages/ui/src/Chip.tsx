import * as React from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

/** Assist and filter chips — always pill-shaped, always a tonal container. */
export type ChipTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'tertiary';

const TONE: Record<ChipTone, string> = {
  neutral:  'bg-md-surface-variant text-md-on-surface-variant',
  primary:  'bg-md-secondary-container text-md-on-secondary-container',
  success:  'bg-md-success-container text-md-on-success-container',
  warning:  'bg-md-warning-container text-md-on-warning-container',
  error:    'bg-md-error-container text-md-on-error-container',
  tertiary: 'bg-md-tertiary-container text-md-on-tertiary-container',
};

const DOT: Record<ChipTone, string> = {
  neutral:  'bg-md-on-surface-variant',
  primary:  'bg-md-primary',
  success:  'bg-md-success',
  warning:  'bg-md-warning',
  error:    'bg-md-error',
  tertiary: 'bg-md-tertiary',
};

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  dot?: boolean;
  glyph?: IconName;
}

export function Chip({ tone = 'neutral', dot, glyph, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-label-small font-medium tracking-[0.01em] whitespace-nowrap',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {dot ? <span className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} /> : null}
      {glyph ? <Icon name={glyph} size={14} className="-ml-0.5" /> : null}
      {children}
    </span>
  );
}
