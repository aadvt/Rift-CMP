'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Button, Icon, cn } from '@rift/ui';
import type { TourDefinition, TourStep } from './types';

/**
 * The guided tour.
 *
 * ## Why this is not a library
 *
 * driver.js, Shepherd and intro.js all do this, and all of them arrive with
 * their own stylesheet. The work would have been overriding that stylesheet
 * until it stopped looking like a different product bolted onto this one — for
 * a spotlight, a bubble and a step counter. Built here it uses the `md-*`
 * tokens directly, so it follows the theme rather than approximating it.
 *
 * ## The spotlight is a box shadow
 *
 * A `9999px` spread on a transparent element dims everything outside its own
 * rectangle. The alternative — an SVG mask, or four divs framing the hole —
 * costs more nodes and has to be rebuilt on every reposition. One element with
 * a shadow moves by changing four numbers.
 *
 * ## Steps that point at nothing are skipped
 *
 * Half these screens render an empty state before the first scan, so "the
 * findings table" is genuinely absent on a new account. A tour that pointed a
 * bubble at the top-left corner because `querySelector` returned null would be
 * worse than one that stays quiet, so a missing anchor removes its step. If
 * that leaves no steps at all, the tour does not open.
 *
 * ## Placement flips rather than clamps blindly
 *
 * The preferred side is a hint. If the bubble would leave the viewport it flips
 * to the opposite side, and only then is it clamped — clamping first produces a
 * bubble that technically fits and covers the thing it is describing.
 *
 * Below `md` none of that applies: the bubble is a bottom sheet. Anchored
 * bubbles on a 375px screen are wider than the gap beside anything they point
 * at, and the honest layout is the one that stops pretending.
 */

const BUBBLE_W = 340;
const GAP = 14;
/** Keeps the bubble off the exact viewport edge. */
const MARGIN = 12;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** A `data-tour` element that is present *and* takes up space. */
function isVisible(anchor: string): boolean {
  const el = document.querySelector(`[data-tour="${anchor}"]`);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function Tour({
  definition,
  onClose,
  onFinish,
}: {
  definition: TourDefinition;
  /** Dismissed early. The caller decides whether that means "never again". */
  onClose: (reason: 'skip' | 'escape') => void;
  onFinish: () => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [target, setTarget] = React.useState<Box | null>(null);
  const [bubble, setBubble] = React.useState<{ top: number; left: number; side: TourStep['placement'] } | null>(null);
  const [mounted, setMounted] = React.useState(false);
  /**
   * Tracked rather than inferred from a null position.
   *
   * `bubble === null` means two different things — "this is a mobile sheet" and
   * "this is a centred desktop step with no anchor" — and they need opposite
   * styling. Conflating them applied the centred `top/left/transform` on a
   * phone, where it fought the sheet's `inset-x-3 bottom-3` and left the bubble
   * half off the side of the screen.
   */
  const [isMobile, setIsMobile] = React.useState(false);
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const restoreFocus = React.useRef<HTMLElement | null>(null);

  /**
   * Steps whose anchor is actually visible on this page.
   *
   * Presence in the DOM is not the test. The sidebar is `hidden md:flex` — it
   * is rendered on a phone and simply not displayed — so `querySelector` finds
   * it, `getBoundingClientRect` returns zeros, and the spotlight collapses to a
   * twelve-pixel dot in the top-left corner while the bubble explains the
   * navigation nobody can see. Requiring a real box skips those steps on the
   * breakpoints where they mean nothing, which is exactly right: the mobile
   * shell has no persistent sidebar to describe.
   *
   * `mounted` is in the dependencies so this runs after the first paint rather
   * than during it, when layout has not been resolved and everything would
   * measure zero.
   */
  const steps = React.useMemo(
    () => definition.steps.filter((s) => !s.anchor || isVisible(s.anchor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition, mounted, isMobile],
  );

  const step = steps[index];

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);

    setMounted(true);
    restoreFocus.current = document.activeElement as HTMLElement | null;
    return () => {
      mq.removeEventListener('change', sync);
      // Returning focus matters: without it, dismissing the tour drops the
      // caret at the top of the document and a keyboard user has to tab back
      // through the whole shell to where they were.
      restoreFocus.current?.focus?.();
    };
  }, []);

  /** Measure the anchor and decide where the bubble goes. */
  const reposition = React.useCallback(() => {
    if (!step) return;

    if (!step.anchor) {
      setTarget(null);
      setBubble(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${step.anchor}"]`);
    if (!el) {
      setTarget(null);
      setBubble(null);
      return;
    }

    const r = el.getBoundingClientRect();
    // Same reasoning as the filter: a hidden element measures zero, and
    // spotlighting that draws a dot in the corner.
    if (r.width === 0 || r.height === 0) {
      setTarget(null);
      setBubble(null);
      return;
    }
    const box: Box = { top: r.top, left: r.left, width: r.width, height: r.height };
    setTarget(box);

    if (window.innerWidth < 768) {
      setBubble(null); // bottom sheet; no anchored position needed
      return;
    }

    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const h = bubbleRef.current?.offsetHeight ?? 190;

    let side = step.placement ?? 'bottom';

    // Flip when the preferred side has no room. Checked against the real
    // measured height, so a long body does not silently overflow.
    if (side === 'bottom' && r.bottom + GAP + h > vh - MARGIN && r.top - GAP - h > MARGIN) side = 'top';
    else if (side === 'top' && r.top - GAP - h < MARGIN && r.bottom + GAP + h < vh - MARGIN) side = 'bottom';
    else if (side === 'right' && r.right + GAP + BUBBLE_W > vw - MARGIN) side = 'left';
    else if (side === 'left' && r.left - GAP - BUBBLE_W < MARGIN) side = 'right';

    let top: number;
    let left: number;

    if (side === 'top') {
      top = r.top - GAP - h;
      left = r.left + r.width / 2 - BUBBLE_W / 2;
    } else if (side === 'bottom') {
      top = r.bottom + GAP;
      left = r.left + r.width / 2 - BUBBLE_W / 2;
    } else if (side === 'left') {
      top = r.top + r.height / 2 - h / 2;
      left = r.left - GAP - BUBBLE_W;
    } else {
      top = r.top + r.height / 2 - h / 2;
      left = r.right + GAP;
    }

    // Clamp last, so it never overrides a flip that already found room.
    left = Math.min(Math.max(left, MARGIN), vw - BUBBLE_W - MARGIN);
    top = Math.min(Math.max(top, MARGIN), vh - h - MARGIN);

    setBubble({ top, left, side });
  }, [step]);

  // Bring the anchor into view first, then measure. Measuring before the scroll
  // settles positions the bubble against where the element used to be.
  React.useEffect(() => {
    if (!step?.anchor) {
      reposition();
      return;
    }
    const el = document.querySelector(`[data-tour="${step.anchor}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });

    const id = window.setTimeout(reposition, 320);
    // A second pass after the bubble has rendered at its real height, which the
    // first pass could only guess at.
    const id2 = window.setTimeout(reposition, 420);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(id2);
    };
  }, [step, reposition]);

  React.useEffect(() => {
    const onMove = () => reposition();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [reposition]);

  React.useEffect(() => {
    bubbleRef.current?.focus();
  }, [index]);

  const last = index === steps.length - 1;

  const next = React.useCallback(() => {
    if (last) onFinish();
    else setIndex((i) => i + 1);
  }, [last, onFinish]);

  const back = React.useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose('escape'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, back, onClose]);

  if (!mounted || !step || steps.length === 0) return null;

  const body = (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/* The dimmer. When a step has no anchor it covers everything, which is
          what an introduction wants. */}
      {target ? (
        <div
          className="pointer-events-auto absolute rounded-xl ring-2 ring-md-primary transition-all duration-[--md-duration-base] ease-md motion-reduce:transition-none"
          style={{
            top: target.top - 6,
            left: target.left - 6,
            width: target.width + 12,
            height: target.height + 12,
            // `md-inverse-surface` is this design system's scrim — the drawer
            // and modal overlays already use it. There is no `--md-scrim`
            // token, and naming one that does not exist makes `color-mix`
            // yield transparent, which is a spotlight that highlights nothing.
            boxShadow: '0 0 0 9999px color-mix(in srgb, var(--md-inverse-surface) 55%, transparent)',
          }}
          onClick={() => onClose('escape')}
        />
      ) : (
        <div
          className="pointer-events-auto absolute inset-0 bg-md-inverse-surface/55 backdrop-blur-[2px]"
          onClick={() => onClose('escape')}
        />
      )}

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        className={cn(
          'pointer-events-auto fixed rounded-2xl bg-md-surface-high p-6 shadow-e3 outline-none',
          'ring-1 ring-md-outline-variant',
          'motion-safe:animate-[md-rise_220ms_var(--md-ease)_both]',
          // Bottom sheet below md; anchored bubble above it.
          'inset-x-3 bottom-3 md:inset-x-auto md:bottom-auto',
        )}
        style={
          // A phone gets no inline positioning at all: the sheet classes own
          // it, and any `left`/`top` here would override them.
          isMobile
            ? undefined
            : bubble
              ? { top: bubble.top, left: bubble.left, width: BUBBLE_W }
              : // Desktop, no anchor: centred.
                { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: BUBBLE_W }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
            {definition.label}
          </span>
          <button
            type="button"
            aria-label="Close the tour"
            onClick={() => onClose('escape')}
            className="-mr-2 -mt-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-md-primary/10 hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <h2 id="tour-title" className="mt-2 text-title-medium font-medium text-md-on-surface">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">
          {step.body}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          {/* Dots rather than "3 of 7": the count is the useful part and the
              shape shows progress without asking anybody to do arithmetic. */}
          <span className="flex items-center gap-1.5" aria-hidden="true">
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  i === index ? 'bg-md-primary' : 'bg-md-on-surface-variant/30',
                )}
              />
            ))}
          </span>

          <span className="flex items-center gap-2">
            {index > 0 ? (
              <Button size="sm" variant="text" onClick={back}>Back</Button>
            ) : (
              <Button size="sm" variant="text" onClick={() => onClose('skip')}>Skip</Button>
            )}
            {/* Spread rather than a ternary on the prop itself:
                `exactOptionalPropertyTypes` is on, so passing `undefined`
                explicitly is a different thing from not passing the prop. */}
            <Button size="sm" variant="filled" onClick={next} {...(last ? {} : { iconAfter: 'arrowRight' as const })}>
              {last ? 'Done' : 'Next'}
            </Button>
          </span>
        </div>

        <span className="sr-only" aria-live="polite">
          Step {index + 1} of {steps.length}
        </span>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
