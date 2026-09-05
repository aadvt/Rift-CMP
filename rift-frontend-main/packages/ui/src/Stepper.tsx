import * as React from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

/**
 * Staged progress for long asynchronous work — the nine scan stages, the five
 * install checks. Completed stages stay visible with what they found. Never a
 * bare spinner.
 *
 * The active marker carries the only sustained motion in the product: a
 * breathing dot and an indeterminate sweep, both reading as steady work
 * rather than urgency.
 */
export type StepState = 'done' | 'active' | 'pending' | 'failed' | 'skipped';

export interface Step {
  id: string | number;
  label: string;
  note?: string;
  state: StepState;
  detail?: string;
}

const MARK: Record<StepState, string> = {
  done:    'bg-md-success text-md-on-success',
  active:  'bg-md-primary-container text-md-primary ring-4 ring-md-primary/15',
  pending: 'bg-md-surface-variant text-md-on-surface-variant/60',
  failed:  'bg-md-warning-container text-md-on-warning-container',
  skipped: 'bg-md-surface-variant text-md-on-surface-variant/50',
};

const LABEL: Record<StepState, string> = {
  done: 'text-md-on-surface',
  active: 'text-md-on-surface font-medium',
  pending: 'text-md-on-surface-variant/70',
  failed: 'text-md-on-surface font-medium',
  skipped: 'text-md-on-surface-variant/60',
};

export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.id} className={cn('relative flex gap-4', last ? '' : 'pb-6')}>
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[15px] top-9 bottom-1 w-0.5 rounded-full transition-colors duration-[--md-duration-slow]',
                  s.state === 'done' ? 'bg-md-success/35' : 'bg-md-outline-variant/60',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full',
                'transition-all duration-[--md-duration-base] ease-md',
                MARK[s.state],
              )}
            >
              {s.state === 'done' ? (
                <Icon name="check" size={18} strokeWidth={2.4} />
              ) : s.state === 'active' ? (
                <span className="size-2.5 rounded-full bg-md-primary motion-safe:animate-[md-breathe_1.6s_ease-in-out_infinite]" />
              ) : s.state === 'failed' ? (
                <span className="text-label-medium font-bold leading-none">!</span>
              ) : (
                <span className="size-2 rounded-full bg-current opacity-60" />
              )}
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className={cn('text-body-medium', LABEL[s.state])}>{s.label}</span>
                {s.detail ? <span className="shrink-0 text-label-small text-md-on-surface-variant tabular-nums">{s.detail}</span> : null}
              </div>
              {s.note ? (
                <div className={cn('mt-1 text-label-medium', s.state === 'active' ? 'text-md-primary' : s.state === 'failed' ? 'text-md-on-warning-container' : 'text-md-on-surface-variant')}>
                  {s.note}
                </div>
              ) : null}
              {s.state === 'active' ? (
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-md-primary/15">
                  <div className="h-full w-1/4 rounded-full bg-md-primary motion-safe:animate-[md-work_1.4s_cubic-bezier(0.45,0,0.55,1)_infinite]" />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
