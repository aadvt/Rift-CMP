'use client';
import * as React from 'react';
import {
  type ConsentCategoryView, type ConsentSelection, type PreferenceCopy, DEFAULT_PREFERENCE_COPY,
} from './types';

/**
 * Preference centre.
 *
 * Categories, names and descriptions come from the configuration — this
 * component never decides what a category means. Focus is trapped while open
 * and restored on close; Escape closes.
 */
export function PreferenceCentre({
  categories, value, onChange, onSave, onAcceptAll, onClose, copy: partial, className,
}: {
  categories: ConsentCategoryView[];
  value: ConsentSelection;
  onChange: (next: ConsentSelection) => void;
  onSave: (selection: ConsentSelection) => void;
  onAcceptAll: () => void;
  onClose: () => void;
  copy?: Partial<PreferenceCopy>;
  className?: string;
}) {
  const copy = { ...DEFAULT_PREFERENCE_COPY, ...partial };
  const titleId = React.useId();
  const ref = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<Element | null>(null);

  React.useEffect(() => {
    restoreTo.current = document.activeElement;
    ref.current?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus();
    return () => { (restoreTo.current as HTMLElement | null)?.focus?.(); };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !ref.current) return;
    const focusable = Array.from(
      ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      style={{ background: '#F3EDF7', borderRadius: 28 }}
      className={[
        'rift-preference-centre relative w-[440px] max-w-[calc(100vw-24px)] overflow-hidden',
        'shadow-[0_8px_12px_6px_rgb(28_27_31/0.12),0_4px_4px_rgb(28_27_31/0.12)]',
        className ?? '',
      ].join(' ')}
    >
      <span aria-hidden="true" style={{ background: '#EADDFF' }} className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full opacity-70 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3.5 p-[24px_24px_18px]">
        <div>
          <h2 id={titleId} style={{ color: '#1C1B1F' }} className="text-[1.5rem] font-medium leading-tight">{copy.title}</h2>
          <p style={{ color: '#49454F' }} className="mt-2 text-[0.875rem] leading-relaxed">{copy.body}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          style={{ color: '#49454F' }}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:bg-[rgb(103_80_164/0.10)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6750A4]"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" />
          </svg>
        </button>
      </div>

      <div className="relative px-6 pb-2">
        {categories.map((c, i) => {
          const on = c.locked || value[c.id] === true;
          return (
            <div
              key={c.id}
              style={{ background: '#FFFBFE', borderRadius: 16 }}
              className="mb-2 flex items-start justify-between gap-[18px] p-4 transition-colors duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span style={{ color: '#1C1B1F' }} className="text-[1rem] font-medium">{c.name}</span>
                  {c.locked ? (
                    <span style={{ background: '#E7E0EC', color: '#49454F' }} className="inline-flex h-6 items-center rounded-full px-2.5 text-[0.75rem] font-medium">
                      Always active
                    </span>
                  ) : null}
                </div>
                <p style={{ color: '#49454F' }} className="mt-1.5 text-[0.875rem] leading-relaxed">{c.description}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={c.name}
                disabled={c.locked}
                onClick={() => onChange({ ...value, [c.id]: !on })}
                style={{
                  background: on ? '#6750A4' : '#E7E0EC',
                  borderColor: on ? '#6750A4' : '#79747E',
                }}
                className={[
                  'mt-0.5 inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 px-0.5',
                  'transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6750A4] focus-visible:ring-offset-2',
                  c.locked ? 'cursor-not-allowed opacity-50' : '',
                ].join(' ')}
              >
                <span
                  className="rounded-full transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
                  style={{
                    width: on ? 24 : 16,
                    height: on ? 24 : 16,
                    background: on ? '#FFFFFF' : '#79747E',
                    transform: on ? 'translateX(20px)' : 'translateX(0)',
                    boxShadow: '0 1px 2px rgb(28 27 31 / 0.20)',
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative flex flex-wrap items-center gap-3 p-[16px_24px_24px]">
        <button
          type="button"
          onClick={() => onSave(value)}
          style={{ background: '#6750A4', color: '#FFFFFF' }}
          className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-[0.875rem] font-medium tracking-[0.01em] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6750A4] focus-visible:ring-offset-2"
        >
          {copy.save}
        </button>
        <button
          type="button"
          onClick={onAcceptAll}
          style={{ background: '#E8DEF8', color: '#1D192B' }}
          className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-[0.875rem] font-medium tracking-[0.01em] transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6750A4] focus-visible:ring-offset-2"
        >
          {copy.acceptAll}
        </button>
        <span style={{ color: '#49454F' }} className="ml-auto text-[0.75rem]">Recorded by Rift</span>
      </div>
    </div>
  );
}
