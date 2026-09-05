'use client';
import * as React from 'react';
import { Icon, WipeCover, cn } from '@rift/ui';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

/**
 * The hero's single interaction.
 *
 * At rest it reads as a search field — one line, one icon, one round button —
 * because that is the least intimidating thing to meet on a privacy product.
 * On focus it expands into a proper "enter your website" moment: a label
 * settles in above, guidance below, and the round button grows into
 * "Scan my website".
 *
 * Every slot that appears is height-reserved at rest, so nothing on the page
 * jumps when the field opens — it only ever fades and grows.
 */
export function ScanField() {
  const [value, setValue] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [leaving, setLeaving] = React.useState<{ url: string; host: string } | null>(null);

  const open = focused || value.trim().length > 0;

  function normalise(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(withScheme);
      return url.hostname.includes('.') ? withScheme : null;
    } catch {
      return null;
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = normalise(value);
    if (!url) {
      setError('That doesn’t look like a website address. Try something like northwind-retail.com');
      return;
    }
    setError(null);
    // Hand off only once the wipe has covered the screen, so the cross-origin
    // navigation happens out of sight instead of as a hard cut.
    setLeaving({ url, host: new URL(url).hostname });
  }

  const handOff = React.useCallback(() => {
    if (!leaving) return;
    window.location.href = `${APP_URL}/dashboard/sites/new?url=${encodeURIComponent(leaving.url)}&from=web`;
  }, [leaving]);

  return (
    <>
    {leaving ? (
      <WipeCover label={`Scanning ${leaving.host}`} sub="Reaching your website…" onCovered={handOff} />
    ) : null}

    <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[720px]">
      {/* Label slot — reserved at rest so the field never pushes the page. */}
      <div className="flex h-7 items-end justify-center">
        <span
          className={cn(
            'text-label-medium font-medium tracking-[0.01em] text-md-primary',
            'transition-all duration-[--md-duration-base] ease-md',
            open ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          Enter your website URL
        </span>
      </div>

      <div
        className={cn(
          'relative mx-auto mt-3 flex items-center gap-3 rounded-full',
          'transition-all duration-[--md-duration-slow] ease-md',
          open
            ? 'h-[76px] max-w-[720px] bg-md-surface-lowest pl-7 pr-2.5 shadow-e3 ring-2 ring-md-primary'
            : 'h-16 max-w-[540px] bg-md-surface-container pl-6 pr-2 shadow-e1 ring-1 ring-md-outline-variant',
          error && 'ring-md-error',
        )}
      >
        <Icon
          name="sites"
          size={open ? 24 : 22}
          className={cn(
            'shrink-0 transition-all duration-[--md-duration-base] ease-md',
            open ? 'text-md-primary' : 'text-md-on-surface-variant',
          )}
        />

        <input
          type="text"
          inputMode="url"
          autoComplete="url"
          aria-label="Your website URL"
          aria-invalid={error ? true : undefined}
          placeholder={open ? 'northwind-retail.com' : 'Scan your website'}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setValue(e.currentTarget.value); if (error) setError(null); }}
          className={cn(
            'min-w-0 flex-1 bg-transparent font-medium text-md-on-surface outline-none',
            'placeholder:font-normal placeholder:text-md-on-surface-variant/70',
            'transition-all duration-[--md-duration-base] ease-md',
            open ? 'text-title-large' : 'text-body-large',
          )}
        />

        <button
          type="submit"
          disabled={leaving !== null}
          className={cn(
            'group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-md-primary text-md-on-primary',
            'transition-all duration-[--md-duration-slow] ease-md active:scale-95 disabled:opacity-60',
            'hover:bg-md-primary/90 hover:shadow-e2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 focus-visible:ring-offset-md-background',
            open ? 'h-14 px-7' : 'size-12',
          )}
        >
          {/* The label unrolls rather than popping in. */}
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap text-label-medium font-medium tracking-[0.01em]',
              'transition-all duration-[--md-duration-slow] ease-md',
              open ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0',
            )}
          >
            {leaving ? 'Starting scan' : 'Scan my website'}
          </span>
          <Icon name="arrowRight" size={20} className="shrink-0" />
        </button>
      </div>

      {/* Guidance slot — also reserved, and doubles as the error line. */}
      <div className="flex h-12 items-start justify-center px-4 pt-3">
        <span
          className={cn(
            'text-center text-label-medium transition-all duration-[--md-duration-base] ease-md',
            error
              ? 'text-md-error opacity-100'
              : open
                ? 'text-md-on-surface-variant opacity-100'
                : 'text-md-on-surface-variant opacity-0',
          )}
        >
          {error ?? 'Rift scans the public pages it can reach. No code, no credentials, nothing changed on your site.'}
        </span>
      </div>
    </form>
    </>
  );
}
