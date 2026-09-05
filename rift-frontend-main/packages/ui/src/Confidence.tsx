import * as React from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

/**
 * Three-level confidence — a first-class pattern, not a status chip.
 *
 * `unresolved` sits on the neutral surface variant on purpose. It does not
 * mean illegal, blocked, dangerous or consent-requiring; it means Rift needs
 * more information. It must never wear the error role.
 *
 * Each level pairs a glyph with a word, so the state never rests on colour.
 */
export type ConfidenceLevel = 'confirmed' | 'likely' | 'unresolved';

const LEVEL = {
  confirmed:  { icon: 'check' as const,    label: 'Confirmed',  className: 'bg-md-success-container text-md-on-success-container' },
  likely:     { icon: 'wave' as const,     label: 'Likely',     className: 'bg-md-warning-container text-md-on-warning-container' },
  unresolved: { icon: 'question' as const, label: 'Unresolved', className: 'bg-md-surface-variant text-md-on-surface-variant' },
};

export function Confidence({ level, label, className }: { level: ConfidenceLevel; label?: string; className?: string }) {
  const l = LEVEL[level];
  return (
    <span
      title={l.label}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full pl-2 pr-3 text-label-small font-medium tracking-[0.01em] whitespace-nowrap',
        l.className,
        className,
      )}
    >
      <Icon name={l.icon} size={14} strokeWidth={2} />
      {label ?? l.label}
    </span>
  );
}
