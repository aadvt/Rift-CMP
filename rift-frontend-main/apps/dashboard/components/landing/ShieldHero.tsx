'use client';
import * as React from 'react';
import { cn } from '@rift/ui';
import { ScrollTrigger, shouldAnimate, withGsap } from '@/components/motion/gsap';

/**
 * The shield in the hero.
 *
 * ## Why CSS 3D and not WebGL
 *
 * This is six flat planes at different depths. A WebGL renderer would put a
 * few hundred kilobytes in front of the first paint of a marketing page to
 * produce something the compositor already does — and it would bring its own
 * colours, where these are `md-*` custom properties and follow the theme.
 *
 * `preserve-3d` with a real `translateZ` on each layer is what makes the
 * rotation read as depth rather than as a skew: the layers separate and
 * re-converge as the angle changes, which is parallax, and it is the only
 * reason to build this out of layers at all.
 *
 * ## Why the rotation is tied to scroll
 *
 * A shield that rotates on a loop is a logo animation — it says nothing and
 * after two seconds it is wallpaper. Bound to scroll position it becomes a
 * response to the reader: it turns because they moved, so it reads as an object
 * in the space rather than a video playing in the corner.
 *
 * This is the one thing on the page that genuinely needs ScrollTrigger.
 * Everything else is "has it come into view yet", which an observer answers;
 * this needs a continuous position within a range, which is what scrubbing is.
 *
 * ## What happens when nothing animates
 *
 * The opening angle is set in CSS, not by the tween. A starved ticker, a
 * reduced-motion preference or a failed script all land in the same place: a
 * shield sitting at a pleasant three-quarter angle, not moving. Nothing is
 * hidden and nothing is broken — which is the property the rest of the motion
 * work in this app had to be rewritten twice to get.
 *
 * ## Small screens
 *
 * Below `lg` the hero is one column and the shield is decoration competing with
 * the only thing on the page that matters, so it is not rendered at all rather
 * than shrunk. `aria-hidden` throughout: it depicts nothing a screen reader
 * needs, and the heading beside it already says what the product does.
 */
export function ShieldHero({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    const ctx = gsap.context(() => {
      // Idle drift, so it is alive before anybody scrolls. Deliberately slow
      // and small — it should be noticed second, after the headline.
      gsap.to('[data-shield="body"]', {
        y: -10,
        duration: 3.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      gsap.to('[data-shield="ring"]', {
        rotate: 360,
        duration: 26,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });

      gsap.to('[data-shield="spark"]', {
        opacity: 0.25,
        duration: 1.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: { each: 0.4, from: 'random' },
      });

      // ── The scroll-linked part ──
      //
      // One timeline scrubbed across the first screen and a half. `scrub: 1`
      // rather than `true` adds a second of catch-up, so a flick of the wheel
      // arrives as a turn rather than a snap.
      gsap
        .timeline({
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            end: '+=1100',
            scrub: 1,
          },
        })
        .to(
          '[data-shield="stage"]',
          {
            rotateY: 26,
            rotateX: -12,
            // Travels down with the reader, slower than the page, so it hangs
            // back rather than scrolling away.
            y: 130,
            scale: 0.88,
            ease: 'none',
          },
          0,
        )
        // The layers pull apart as it turns. At the opening angle they read as
        // one object; by the end the depth between them is the point.
        .to('[data-shield="lift"]', { z: 60, ease: 'none' }, 0)
        .to('[data-shield="glow"]', { opacity: 0.28, scale: 1.25, ease: 'none' }, 0);
    }, el);

    const settle = setTimeout(() => ScrollTrigger.refresh(), 400);

    return () => {
      clearTimeout(settle);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none relative hidden select-none lg:block', className)}
      style={{ perspective: '1200px' }}
    >
      <div
        data-shield="stage"
        className="relative mx-auto aspect-square w-full max-w-[440px]"
        style={{
          transformStyle: 'preserve-3d',
          // The opening angle lives here rather than in the tween, so this is
          // what somebody sees if nothing ever animates.
          transform: 'rotateX(8deg) rotateY(-20deg)',
        }}
      >
        {/* Atmosphere. Sits furthest back and never rotates with the rest —
            a blurred field with a visible edge would read as a flat card. */}
        <div
          data-shield="glow"
          className="absolute left-1/2 top-1/2 size-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-md-primary/25 blur-3xl"
        />

        {/* Back plate: the surface the shield is protecting. */}
        <div
          className="absolute inset-[14%] rounded-[28%] border border-md-outline-variant/60 bg-md-surface/40"
          style={{ transform: 'translateZ(-70px)' }}
        />

        <svg
          data-shield="ring"
          viewBox="0 0 200 200"
          className="absolute inset-[6%] text-md-primary"
          style={{ transform: 'translateZ(-28px)' }}
          fill="none"
        >
          <circle
            cx="100" cy="100" r="92"
            stroke="currentColor" strokeOpacity="0.35" strokeWidth="1"
            strokeDasharray="2 14" strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="78" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
        </svg>

        {/* The shield itself. */}
        <div
          data-shield="body"
          className="absolute inset-[16%]"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <svg viewBox="0 0 160 180" fill="none" className="size-full drop-shadow-[0_24px_48px_rgba(0,0,0,0.16)]">
            <defs>
              <linearGradient id="rift-shield-face" x1="20" y1="4" x2="150" y2="176" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--md-primary-container)" />
                <stop offset="55%" stopColor="var(--md-secondary-container)" />
                <stop offset="100%" stopColor="var(--md-tertiary-container)" />
              </linearGradient>
              {/* A single sheen band, angled across the face. It is what stops
                  the panel reading as flat once the thing starts turning. */}
              <linearGradient id="rift-shield-sheen" x1="0" y1="0" x2="160" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="18%" stopColor="#fff" stopOpacity="0" />
                <stop offset="42%" stopColor="#fff" stopOpacity="0.42" />
                <stop offset="62%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>

            <path
              d="M80 3 L152 30 V88 c0 42-29 74-72 89-43-15-72-47-72-89V30Z"
              fill="url(#rift-shield-face)"
              stroke="var(--md-primary)"
              strokeOpacity="0.32"
              strokeWidth="1.5"
            />
            <path
              d="M80 3 L152 30 V88 c0 42-29 74-72 89-43-15-72-47-72-89V30Z"
              fill="url(#rift-shield-sheen)"
            />
          </svg>

          {/* The tick floats above the face, so rotation opens a real gap
              between them instead of sliding one texture over another.

              `md-primary` rather than `md-on-secondary-container`: the ink role
              is near-black, and against a pale lilac face it read as a borrowed
              glyph sitting on the shield rather than as part of it. The primary
              is the same hue as the gradient it lies on, several steps darker,
              which is what makes the two look like one object. */}
          <svg
            data-shield="lift"
            viewBox="0 0 160 180"
            fill="none"
            className="absolute inset-0 size-full text-md-primary"
            style={{ transform: 'translateZ(34px)' }}
          >
            <path
              d="M52 88 l20 21 40-45"
              stroke="currentColor"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Satellites at mixed depths: the parallax between them is what the
            rotation is for. */}
        {[
          { cls: 'left-[6%] top-[26%] size-3', z: 90 },
          { cls: 'right-[9%] top-[16%] size-2', z: 130 },
          { cls: 'right-[4%] bottom-[30%] size-2.5', z: 70 },
          { cls: 'left-[14%] bottom-[16%] size-2', z: 110 },
        ].map((dot) => (
          <span
            key={dot.cls}
            data-shield="spark"
            className={cn('absolute rounded-full bg-md-primary', dot.cls)}
            style={{ transform: `translateZ(${dot.z}px)` }}
          />
        ))}
      </div>
    </div>
  );
}
