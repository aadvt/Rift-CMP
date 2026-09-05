'use client';
import * as React from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

/**
 * The inverse surface moment. MD3 keeps one high-contrast panel per product
 * for exactly this kind of thing — here, the install snippet.
 */
export function CodeBlock({
  code, label, sub, meta, className,
}: { code: string; label?: React.ReactNode; sub?: React.ReactNode; meta?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the snippet is selectable, so this is recoverable */
    }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-md-inverse-surface shadow-e3', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-md-inverse-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 size-64 rounded-full bg-md-tertiary/25 blur-3xl" />
      </div>

      {(label || sub) && (
        <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            {label ? <div className="text-label-medium font-medium text-md-inverse-on-surface">{label}</div> : null}
            {sub ? <div className="mt-1 text-label-small text-md-inverse-on-surface/70">{sub}</div> : null}
          </div>
          <button
            type="button"
            onClick={copy}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-label-medium font-medium',
              'bg-md-inverse-primary text-md-on-primary-container',
              'transition-all duration-[--md-duration-base] ease-md hover:bg-md-inverse-primary/90 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-inverse-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-inverse-surface',
            )}
          >
            <Icon name={copied ? 'check' : 'copy'} size={18} />
            {copied ? 'Copied' : 'Copy snippet'}
          </button>
        </div>
      )}

      <pre className="relative overflow-x-auto px-6 py-8 font-mono text-[15px] leading-[1.9] text-md-inverse-on-surface"><code>{code}</code></pre>

      {meta ? <div className="relative border-t border-white/10 px-6 py-4">{meta}</div> : null}
    </div>
  );
}
