import * as React from 'react';
import { cn } from './cn';

/**
 * Organic blur shapes — the signature MD3 atmospheric layer.
 *
 * Large, heavily blurred, partially off-canvas, multiply-blended so the hues
 * enrich rather than wash out. Purely decorative, so hidden from assistive
 * technology.
 */
export function BlurField({
  variant = 'hero', className,
}: { variant?: 'hero' | 'section' | 'panel'; className?: string }) {
  if (variant === 'panel') {
    return (
      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-md-primary-container/60 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 size-56 rounded-full bg-md-tertiary-container/50 blur-3xl" />
      </div>
    );
  }

  if (variant === 'section') {
    return (
      <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
        <div className="absolute right-0 top-0 size-[28rem] -translate-y-1/3 translate-x-1/4 rounded-full bg-md-secondary-container/70 mix-blend-multiply blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-80 translate-y-1/3 rounded-full bg-md-tertiary-container/50 mix-blend-multiply blur-3xl" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* A pill with one softened corner reads as organic rather than geometric. */}
      <div className="absolute -left-24 -top-32 h-96 w-[36rem] -rotate-12 rounded-[100px] rounded-tr-[20px] bg-md-primary-container/70 mix-blend-multiply blur-3xl" />
      <div className="absolute -right-32 top-10 size-[30rem] rounded-full bg-md-tertiary-container/60 mix-blend-multiply blur-3xl" />
      <div className="absolute bottom-0 left-1/3 size-80 translate-y-1/2 rounded-full bg-md-secondary-container/70 mix-blend-multiply blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--md-secondary-container)_0%,transparent_45%)] opacity-40" />
    </div>
  );
}

/** A glow that reveals on the parent's hover — pair with `group`. */
export function Glow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 rounded-full bg-md-primary opacity-0 blur-xl transition-opacity duration-[--md-duration-base] ease-md group-hover:opacity-30',
        className,
      )}
    />
  );
}
