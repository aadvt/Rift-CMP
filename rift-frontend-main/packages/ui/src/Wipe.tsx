'use client';
import * as React from 'react';
import { cn } from './cn';
import { RiftMark } from './RecommendationPair';

const COVER_MS = 560;
const REVEAL_MS = 620;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The leaving half of a page transition.
 *
 * A solid panel sweeps in from the left edge and holds. `onCovered` fires the
 * moment the screen is fully covered — navigate there, so the hard cut happens
 * behind an opaque surface and the viewer never sees it.
 *
 * Pair with `WipeReveal` on the destination and the two read as a single
 * continuous motion, even across separate apps on different origins.
 */
export function WipeCover({
  label, sub, onCovered,
}: { label: string; sub?: string; onCovered: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onCovered, prefersReducedMotion() ? 0 : COVER_MS);
    return () => clearTimeout(t);
  }, [onCovered]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-md-primary"
      style={{ animation: `rift-wipe-cover ${COVER_MS}ms var(--md-ease) both` }}
    >
      <span className="pointer-events-none absolute -left-24 -top-32 size-[32rem] rounded-full bg-md-inverse-primary/25 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-md-tertiary/40 blur-3xl" />

      {/* The label fades in behind the leading edge rather than riding it, so
          it is never caught mid-clip. */}
      <div
        className="relative flex flex-col items-center gap-5 px-8 text-center"
        style={{ animation: `rift-wipe-label 400ms var(--md-ease) both`, animationDelay: '180ms' }}
      >
        <RiftMark size={56} inverted />
        <div>
          <div className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-primary">{label}</div>
          {sub ? <div className="mt-2 text-body-large text-md-on-primary/70">{sub}</div> : null}
        </div>
        <div className="mt-1 flex h-1.5 w-40 overflow-hidden rounded-full bg-md-on-primary/20">
          <span className="h-full w-1/3 rounded-full bg-md-on-primary/80 motion-safe:animate-[md-work_1.2s_cubic-bezier(0.45,0,0.55,1)_infinite]" />
        </div>
      </div>
    </div>
  );
}

/**
 * The arriving half.
 *
 * Renders already covering the viewport and sweeps off to the right, picking
 * up exactly where `WipeCover` stopped. Driven purely by a CSS animation with
 * `both` fill, so it is opaque on the very first painted frame — a JS-gated
 * overlay would flash the page underneath before it mounted.
 */
export function WipeReveal({ label, className }: { label?: string; className?: string }) {
  const [done, setDone] = React.useState(false);
  if (done) return null;

  return (
    <div
      aria-hidden="true"
      onAnimationEnd={() => setDone(true)}
      className={cn(
        'pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-md-primary',
        className,
      )}
      style={{ animation: `rift-wipe-reveal ${REVEAL_MS}ms var(--md-ease) both` }}
    >
      <span className="absolute -left-24 -top-32 size-[32rem] rounded-full bg-md-inverse-primary/25 blur-3xl" />
      <span className="absolute -bottom-40 -right-20 size-[28rem] rounded-full bg-md-tertiary/40 blur-3xl" />
      <div className="relative flex flex-col items-center gap-5 px-8 text-center">
        <RiftMark size={56} inverted />
        {label ? (
          <div className="text-headline-medium font-normal tracking-[-0.01em] text-md-on-primary">{label}</div>
        ) : null}
      </div>
    </div>
  );
}
