'use client';
import * as React from 'react';
import { type BannerCopy, DEFAULT_BANNER_COPY } from './types';

/**
 * Visitor consent banner.
 *
 * Presentational only. It does not read or write storage, does not decide
 * whether it should appear, and does not enforce anything — the SDK owns all
 * of that.
 *
 * Colours are literal rather than themed: this component ships inside the SDK
 * and renders on customer websites, where no Rift stylesheet exists. Values
 * match the Material You roles in @rift/tokens exactly.
 *
 * Reject carries the same visual weight as Accept, deliberately.
 */
export function ConsentBanner({
  copy: partial, onAcceptAll, onRejectNonEssential, onManagePreferences, className,
}: {
  copy?: Partial<BannerCopy>;
  onAcceptAll: () => void;
  onRejectNonEssential: () => void;
  onManagePreferences: () => void;
  className?: string;
}) {
  const copy = { ...DEFAULT_BANNER_COPY, ...partial };
  const titleId = React.useId();

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      style={{ background: '#F3EDF7', borderRadius: 28 }}
      className={[
        'rift-consent-banner relative overflow-hidden p-6 md:p-7',
        'shadow-[0_6px_10px_4px_rgb(28_27_31/0.10),0_2px_3px_rgb(28_27_31/0.10)]',
        className ?? '',
      ].join(' ')}
    >
      {/* Organic blur shapes — the MD3 atmospheric layer. */}
      <span aria-hidden="true" style={{ background: '#EADDFF' }} className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-70 blur-3xl" />
      <span aria-hidden="true" style={{ background: '#FFD8E4' }} className="pointer-events-none absolute -bottom-20 left-1/4 size-48 rounded-full opacity-60 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} style={{ color: '#1C1B1F' }} className="text-[1.5rem] font-medium leading-tight">
            {copy.title}
          </h2>
          <p style={{ color: '#49454F' }} className="mt-2.5 max-w-[620px] text-[1rem] leading-relaxed">
            {copy.body}
          </p>
          <a
            href={copy.privacyNoticeHref}
            style={{ color: '#6750A4' }}
            className="mt-3 inline-block text-[0.875rem] font-medium underline-offset-4 hover:underline"
          >
            {copy.privacyNoticeLabel}
          </a>
        </div>

        <div className="flex shrink-0 flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <BannerButton kind="filled" onClick={onAcceptAll}>{copy.acceptAll}</BannerButton>
          <BannerButton kind="tonal" onClick={onRejectNonEssential}>{copy.rejectNonEssential}</BannerButton>
          <BannerButton kind="text" onClick={onManagePreferences}>{copy.managePreferences}</BannerButton>
        </div>
      </div>
    </div>
  );
}

/** Persistent control so a visitor can reopen their choices at any time. */
export function PrivacyControl({ label = 'Privacy', onClick, className }: { label?: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: '#7D5260', color: '#FFFFFF' }}
      className={[
        'inline-flex h-14 min-h-14 items-center gap-3 rounded-2xl px-5 text-[0.875rem] font-medium',
        'shadow-[0_4px_8px_3px_rgb(28_27_31/0.08),0_1px_3px_rgb(28_27_31/0.10)]',
        'transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:opacity-90 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7D5260] focus-visible:ring-offset-2',
        className ?? '',
      ].join(' ')}
    >
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <rect x="2.8" y="4.2" width="14.4" height="4.4" rx="2.2" />
        <rect x="2.8" y="11.4" width="14.4" height="4.4" rx="2.2" />
      </svg>
      {label}
    </button>
  );
}

function BannerButton({ kind, onClick, children }: { kind: 'filled' | 'tonal' | 'text'; onClick: () => void; children: React.ReactNode }) {
  const base =
    'inline-flex min-h-12 items-center justify-center rounded-full px-7 text-[0.875rem] font-medium tracking-[0.01em] ' +
    'transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] active:scale-95 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6750A4] focus-visible:ring-offset-2';

  const style =
    kind === 'filled' ? { background: '#6750A4', color: '#FFFFFF' }
    : kind === 'tonal' ? { background: '#E8DEF8', color: '#1D192B' }
    : { background: 'transparent', color: '#6750A4' };

  return (
    <button type="button" onClick={onClick} style={style} className={`${base} hover:opacity-90`}>
      {children}
    </button>
  );
}
