'use client';
import * as React from 'react';
import { guardAnimation, ifPageNeverPaints, shouldAnimate, withGsap } from './gsap';

/**
 * Content that arrives as you reach it.
 *
 * ## Why the hidden state is set from JavaScript
 *
 * The obvious shape — `opacity-0` in the markup, animate to 1 — has a failure
 * mode worse than having no animation: if the script does not run, the page is
 * blank. Not degraded, blank. So the initial state is applied by the same code
 * that will undo it, which means the only way to end up hidden is for the code
 * that hides you to be running.
 *
 * ## Why IntersectionObserver rather than ScrollTrigger
 *
 * ScrollTrigger is the natural choice and it was the first one. It computes
 * positions on GSAP's ticker, which is `requestAnimationFrame` — and where rAF
 * is starved (a background tab, a throttled view, an automated renderer) it
 * neither fires nor recovers. Combined with a hidden initial state that means
 * content below the fold can stay invisible permanently, and a one-shot timeout
 * cannot rescue it because at mount that content is correctly hidden.
 *
 * IntersectionObserver replaces it because it needs no plugin, no refresh on
 * layout change and no global registry of triggers. It does not solve the
 * starvation problem — its callbacks ride the same rendering lifecycle — but it
 * moves the guard from a single check at mount to one armed at the moment each
 * element should be appearing, and `ifPageNeverPaints` covers what is left.
 *
 * ScrollTrigger earns its weight when something must be scrubbed to scroll
 * position. Nothing here is.
 *
 * ## Why once
 *
 * Re-playing on the way back up is the difference between a page that feels
 * alive and one that will not sit still. Reading involves scrolling up, and
 * content that dissolves when you look back at it is punishing that.
 *
 * `stagger` animates the element's direct children in sequence rather than the
 * element as one block — for a grid of cards that reads as the grid filling in.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  stagger,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Distance travelled, in px. Small on purpose: this is arrival, not entrance. */
  y?: number;
  /** Seconds between children. Omit to animate the element as a single block. */
  stagger?: number;
  as?: 'div' | 'section' | 'ul' | 'ol';
}) {
  const ref = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    const targets = stagger !== undefined ? Array.from(el.children) : [el];
    if (targets.length === 0) return;

    let unguard = () => {};
    let ctx: gsap.Context | undefined;

    gsap.set(targets, { opacity: 0, y });

    const play = () => {
      ctx = gsap.context(() => {
        const anim = gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          delay,
          ease: 'power3.out',
          ...(stagger !== undefined ? { stagger } : {}),
        });
        // Armed at the moment this should be appearing, so a starved ticker
        // costs the motion and never the content.
        unguard = guardAnimation(anim, { deadlineMs: 1200 });
      }, el);
    };

    // No observer available is not a reason to leave content hidden.
    if (typeof IntersectionObserver === 'undefined') {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        play();
      },
      // A little before it is fully in view, so the motion finishes around the
      // time the element reaches reading position.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    );
    observer.observe(el);

    // The observer is delivered on the rendering lifecycle, so in a view that
    // never paints it never fires and this element would stay hidden through
    // any amount of scrolling. That case is detected globally, once.
    const unwatch = ifPageNeverPaints(() => {
      observer.disconnect();
      gsap.set(targets, { opacity: 1, y: 0 });
    });

    return () => {
      unwatch();
      observer.disconnect();
      unguard();
      if (ctx) ctx.revert();
      else gsap.set(targets, { clearProps: 'opacity,transform' });
    };
  }, [delay, y, stagger]);

  return (
    <Tag ref={ref as React.Ref<never>} className={className}>
      {children}
    </Tag>
  );
}
