import * as React from 'react';
import { cn } from './cn';
import { Icon } from './Icon';
import { Button } from './Button';

/**
 * Rift's recommendation and the company's decision, always side by side and
 * always visually distinct.
 *
 * An override moves the company card onto the tertiary container with a rule
 * down its leading edge, so it reads as deliberately different rather than
 * wrong — and it always carries a restore path. That contrast is what makes
 * the trail auditable.
 */
export function RecommendationPair({
  recommendation, recommendationNote, decision, decisionNote, overridden, onRestore, className,
}: {
  recommendation: React.ReactNode;
  recommendationNote?: string;
  decision: React.ReactNode;
  decisionNote?: string;
  overridden: boolean;
  onRestore?: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-md-surface-high p-5">
          <div className="mb-3 flex items-center gap-2 text-label-small font-medium uppercase tracking-[0.06em] text-md-on-surface-variant">
            <RiftMark size={18} />
            Rift recommendation
          </div>
          <div className="text-body-medium font-medium text-md-on-surface">{recommendation}</div>
          {recommendationNote ? <div className="mt-1.5 text-label-medium text-md-on-surface-variant">{recommendationNote}</div> : null}
        </div>

        <div
          className={cn(
            'rounded-lg p-5 transition-colors duration-[--md-duration-base] ease-md',
            overridden
              ? 'border-l-4 border-md-tertiary bg-md-tertiary-container text-md-on-tertiary-container'
              : 'bg-md-surface-high',
          )}
        >
          <div className={cn('mb-3 flex items-center gap-2 text-label-small font-medium uppercase tracking-[0.06em]', overridden ? 'text-md-on-tertiary-container' : 'text-md-on-surface-variant')}>
            <Icon name="user" size={18} />
            Company decision
          </div>
          <div className={cn('text-body-medium font-medium', overridden ? 'text-md-on-tertiary-container' : 'text-md-on-surface')}>{decision}</div>
          {decisionNote ? (
            <div className={cn('mt-1.5 text-label-medium', overridden ? 'text-md-on-tertiary-container/80' : 'text-md-on-surface-variant')}>{decisionNote}</div>
          ) : null}
        </div>
      </div>

      {overridden ? (
        <div className="mt-4 flex gap-4 rounded-lg border-l-4 border-md-tertiary bg-md-tertiary-container p-5 text-md-on-tertiary-container motion-safe:animate-[md-rise_300ms_var(--md-ease)_both]">
          <Icon name="user" size={22} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-label-medium font-medium">Configuration changed manually</div>
            <p className="mt-1.5 text-label-medium leading-relaxed opacity-90">
              This setting overrides Rift&rsquo;s recommendation. It is recorded against your account and kept through
              future scans until you restore it.
            </p>
            {onRestore ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="filled">Keep override</Button>
                <Button size="sm" variant="outlined" icon="restore" onClick={onRestore}>Restore Rift recommendation</Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The Rift mark. Two offset slabs with a gap — the rift. */
export function RiftMark({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', inverted ? 'bg-md-inverse-primary' : 'bg-md-primary')}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    >
      <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 5h6.2L8.2 19H2.3z" fill={inverted ? '#21005D' : '#FFFFFF'} />
        <path d="M14.4 5h6.2L18.1 19h-5.9z" fill={inverted ? '#21005D' : '#FFFFFF'} opacity="0.55" />
      </svg>
    </span>
  );
}
