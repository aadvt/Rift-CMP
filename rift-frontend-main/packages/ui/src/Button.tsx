import * as React from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

/**
 * Material You buttons are pill-shaped, always.
 *
 * Hover and press do NOT swap the colour — they overlay a state layer. On a
 * filled button that reads as the base colour at 90% / 80%; on a transparent
 * one it is the accent at 10% / 5%. Every variant gets `active:scale-95` so a
 * press feels physical.
 *
 * One `filled` per view, maximum. In Rift the primary action is always the
 * automated path — "Use Rift configuration", never "configure manually" —
 * so manual routes take `tonal`, `outlined` or `text`.
 */
export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  filled:
    'bg-md-primary text-md-on-primary hover:bg-md-primary/90 active:bg-md-primary/80 hover:shadow-e2',
  tonal:
    'bg-md-secondary-container text-md-on-secondary-container hover:bg-md-secondary-container/80 active:bg-md-secondary-container/70 hover:shadow-e1',
  outlined:
    'border border-md-outline text-md-primary hover:bg-md-primary/8 active:bg-md-primary/12',
  text:
    'text-md-primary hover:bg-md-primary/10 active:bg-md-primary/5',
  elevated:
    'bg-md-surface-low text-md-primary shadow-e1 hover:shadow-e2 hover:bg-md-primary/8',
  danger:
    'bg-md-error-container text-md-on-error-container hover:bg-md-error-container/80 active:bg-md-error-container/70',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-10 px-6 text-label-medium gap-2',
  lg: 'h-12 px-8 text-[15px] gap-2.5',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconAfter?: IconName;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'tonal', size = 'md', icon, iconAfter, className, children, ...rest },
  ref,
) {
  const glyph = size === 'sm' ? 16 : 18;
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium tracking-[0.01em] whitespace-nowrap',
        'transition-all duration-[--md-duration-base] ease-md active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-background',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={glyph} /> : null}
      {children ? <span>{children}</span> : null}
      {iconAfter ? <Icon name={iconAfter} size={glyph} /> : null}
    </button>
  );
});

/**
 * Floating action button. Tertiary by default so it reads as an accent
 * against a primary-heavy screen. Square FABs use the 28px radius rather than
 * a full pill — that squircle is a distinct MD3 shape.
 */
export const Fab = React.forwardRef<HTMLButtonElement, ButtonProps & { extended?: boolean }>(
  function Fab({ icon, children, extended, className, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-3 rounded-2xl bg-md-tertiary text-md-on-tertiary',
          'shadow-e3 transition-all duration-[--md-duration-base] ease-md',
          'hover:bg-md-tertiary/90 hover:shadow-e4 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-tertiary focus-visible:ring-offset-2',
          extended ? 'h-14 px-6 text-label-medium font-medium' : 'size-14',
          className,
        )}
        {...rest}
      >
        {icon ? <Icon name={icon} size={24} /> : null}
        {extended ? children : null}
      </button>
    );
  },
);
