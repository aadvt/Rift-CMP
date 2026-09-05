import * as React from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

/**
 * Errors say three things: what happened, whether Rift recovered, and what to
 * do next.
 *
 * `error` is reserved for hard failures — an unreachable site, an install
 * that was never detected. Uncertainty takes `neutral`, which is the surface
 * variant and reads as information rather than alarm.
 */
export type NoticeTone = 'success' | 'warning' | 'neutral' | 'primary' | 'error';

const TONE: Record<NoticeTone, { wrap: string; icon: string }> = {
  success: { wrap: 'bg-md-success-container text-md-on-success-container', icon: 'text-md-success' },
  warning: { wrap: 'bg-md-warning-container text-md-on-warning-container', icon: 'text-md-warning' },
  neutral: { wrap: 'bg-md-surface-variant text-md-on-surface-variant',     icon: 'text-md-on-surface-variant' },
  primary: { wrap: 'bg-md-secondary-container text-md-on-secondary-container', icon: 'text-md-primary' },
  error:   { wrap: 'bg-md-error-container text-md-on-error-container',     icon: 'text-md-error' },
};

export function Notice({
  tone = 'warning', icon = 'alert', title, children, actions, className,
}: {
  tone?: NoticeTone;
  icon?: IconName;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn('flex gap-4 rounded-lg p-5', t.wrap, className)}>
      <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center', t.icon)}>
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-label-medium font-medium leading-snug">{title}</div>
        {children ? <div className="mt-1.5 text-label-medium leading-relaxed opacity-90">{children}</div> : null}
        {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
