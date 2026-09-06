'use client';
import * as React from 'react';
import { Chip } from '@rift/ui';
import { guardAnimation, shouldAnimate, withGsap } from '@/components/motion/gsap';

/**
 * The three lines above the field, and the only choreographed moment on the
 * page.
 *
 * Everything below the fold reveals on scroll, which is a reaction. This runs on
 * arrival, so it is the one piece that has to be a composed sequence rather than
 * four independent fades: the chip, then the headline, then the line under it,
 * then the field — the order somebody reads them in, slightly ahead of them.
 *
 * The headline animates as whole words. Per-character staggers are the reflex
 * here and they are wrong for a line this size: at 48px, letters arriving
 * separately is legible as an effect being performed at you, and a screen reader
 * would be handed a heading chopped into forty spans. Words keep the text one
 * readable string and the motion stays a wave rather than a typewriter.
 */
export function HeroIntro() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    let unguard = () => {};

    const ctx = gsap.context(() => {
      const words = el.querySelectorAll('[data-hero="word"]');

      const tl = gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .from('[data-hero="chip"]', { opacity: 0, y: 10, duration: 0.5 })
        .from(words, { opacity: 0, y: 26, duration: 0.7, stagger: 0.045 }, '-=0.25')
        .from('[data-hero="lede"]', { opacity: 0, y: 14, duration: 0.6 }, '-=0.4')
        // The form is a sibling rather than a child, so it is reached through
        // the shared parent. It arrives last: the page should finish talking
        // before it asks for something.
        .from('[data-hero="form"]', { opacity: 0, y: 14, duration: 0.6 }, '-=0.35');

      // The hero is the first thing on the page. If the ticker never runs,
      // this is the difference between a headline and an empty box.
      unguard = guardAnimation(tl);
    }, el.parentElement ?? el);

    return () => {
      unguard();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={ref}>
      <span data-hero="chip" className="inline-block">
        <Chip tone="primary" glyph="sparkle">
          No account needed
        </Chip>
      </span>

      <h1 className="mt-5 text-headline-large font-normal leading-[1.06] tracking-[-0.015em] text-md-on-surface">
        {'See what your website actually does'.split(' ').map((word, i) => (
          <React.Fragment key={`${word}-${i}`}>
            {/* The wrapper clips the word's travel, so it rises into view
                rather than sliding over the line above it. */}
            <span className="inline-block overflow-hidden align-bottom">
              <span data-hero="word" className="inline-block">
                {word}
              </span>
            </span>{' '}
          </React.Fragment>
        ))}
      </h1>

      <p data-hero="lede" className="mt-5 max-w-[46ch] text-body-large leading-relaxed text-md-on-surface-variant">
        Every tracker, cookie and cross-border transfer — from a real browser, in
        about twenty seconds.
      </p>
    </div>
  );
}
