import * as React from 'react';
import { cn } from './cn';

export type DotTone = 'success' | 'warning' | 'error' | 'neutral' | 'primary';

const TONE: Record<DotTone, string> = {
  success: 'bg-md-success', warning: 'bg-md-warning', error: 'bg-md-error',
  neutral: 'bg-md-on-surface-variant', primary: 'bg-md-primary',
};
const HALO: Record<DotTone, string> = {
  success: 'ring-md-success/20', warning: 'ring-md-warning/20', error: 'ring-md-error/20',
  neutral: 'ring-md-on-surface-variant/20', primary: 'ring-md-primary/20',
};

export function StatusDot({ tone = 'success', ring, className }: { tone?: DotTone; ring?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', TONE[tone], ring && `ring-4 ${HALO[tone]}`, className)}
      aria-hidden="true"
    />
  );
}
