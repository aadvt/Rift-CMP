import * as React from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

/** Empty states speak product language. Never a database or pipeline concept. */
export function EmptyState({
  icon = 'scans', title, body, action, className,
}: { icon?: IconName; title: string; body: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-8 py-16 text-center', className)}>
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-md-secondary-container text-md-on-secondary-container">
        <Icon name={icon} size={28} />
      </div>
      <h3 className="text-title-large font-medium text-md-on-surface">{title}</h3>
      <p className="mt-2 max-w-[420px] text-body-medium leading-relaxed text-md-on-surface-variant">{body}</p>
      {action ? <div className="mt-6 flex gap-3">{action}</div> : null}
    </div>
  );
}
