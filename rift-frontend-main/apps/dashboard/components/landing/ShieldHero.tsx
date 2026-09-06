'use client';
import * as React from 'react';
import { cn } from '@rift/ui';
import { ScrollTrigger, shouldAnimate, withGsap } from '@/components/motion/gsap';

/**
 * The shield in the hero.
 *
 * ## Why CSS 3D and not WebGL
 *
 * This is a stack of flat planes at different depths. A WebGL renderer would
 * put a few hundred kilobytes in front of the first paint of a marketing page
 * to produce what the compositor already does — and it would bring its own
 * colours, where every surface here is an `md-*` custom property and follows
 * the theme.
 *
 * ## Where the thickness comes from
 *
 * `EXTRUSION` renders the same silhouette many times at descending `translateZ`
 * with a fill that darkens as it recedes. Turn the whole assembly and those
 * copies separate along the view axis, and the gap between them reads as a side
 * wall — the object has a back. One plane with a drop shadow cannot do that: it
 * stays a sticker however convincingly it is lit, because rotating it reveals
 * nothing new.
 *
 * That is also why the count is high and the step is small. Visible banding
 * between copies looks like a mistake; enough of them and the eye reads a solid
 * edge instead of a stack.
 *
 * ## Out of the panel
 *
 * It is positioned against the hero *section*, not inside the rounded panel, so
 * it crosses that edge instead of sitting politely within it. Breaking the
 * container is the whole point: an object that overlaps its frame is in front
 * of the page, and one that respects the frame is a picture hanging on it.
 *
 * ## Anchored to the scroll
 *
 * The rotation and the descent are scrubbed against scroll position rather than
 * played on a timer. A shield turning on a loop is a logo animation — wallpaper
 * after two seconds. Bound to the scroll it moves because the reader moved,
 * which makes it an object in the space they are moving through.
 *
 * It fades out over the second half of that travel. Below the hero the page is
 * text on an unpainted surface, and a large opaque object drifting across it
 * would be competing with the only thing on the page that matters.
 *
 * ## What happens when nothing animates
 *
 * The opening angle is set in CSS, not by the tween. A starved ticker, a
 * reduced-motion preference and a failed script all land in the same place: a
 * shield at a three-quarter angle, not moving, fully visible. Nothing hidden.
 *
 * ## Small screens
 *
 * Below `lg` it is not rendered at all rather than shrunk, and it is
 * `aria-hidden` throughout — it depicts nothing a screen reader needs, and the
 * heading beside it already says what the product does.
 */

/** Depth of the body, in px, and how many slices build it. */
const EXTRUSION = Array.from({ length: 14 }, (_, i) => ({
  z: -3 * (i + 1),
  // Recedes towards the darker end of the ramp, so the wall has a gradient
  // down its depth rather than being a flat band of one colour.
  opacity: 0.5 - i * 0.03,
}));

const SHIELD_PATH = 'M80 3 L152 30 V88 c0 42-29 74-72 89-43-15-72-47-72-89V30Z';
/** The same silhouette inset, for the raised rim. */
const SHIELD_RIM = 'M80 15 L141 38 V87 c0 35-24 62-61 75-37-13-61-40-61-75V38Z';

export function ShieldHero({ className }: { className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    const ctx = gsap.context(() => {
      // ── Idle: alive before anybody scrolls, quiet enough to be noticed second ──
      gsap.to('[data-shield="body"]', {
        y: -14,
        duration: 4.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      gsap.to('[data-shield="ring-outer"]', {
        rotate: 360,
        duration: 34,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });

      gsap.to('[data-shield="ring-inner"]', {
        rotate: -360,
        duration: 22,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });

      // The sheen travels across the face on a long cycle, which is what sells
      // the surface as something with a finish rather than a filled path.
      gsap.fromTo(
        '[data-shield="sheen"]',
        { attr: { x: -190 } },
        { attr: { x: 190 }, duration: 4.4, repeat: -1, repeatDelay: 2.6, ease: 'power1.inOut' },
      );

      gsap.to('[data-shield="spark"]', {
        opacity: 0.2,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: { each: 0.3, from: 'random' },
      });

      // ── Anchored to the scroll ──
      //
      // `scrub: 1` gives a second of catch-up, so a flick of the wheel arrives
      // as a turn rather than a snap.
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'top top', end: '+=1500', scrub: 1 },
      });

      tl.to(
        '[data-shield="stage"]',
        {
          rotateY: 38,
          rotateX: -18,
          rotateZ: 6,
          // Travels a long way down and slower than the page, so it descends
          // past the panel edge rather than scrolling away with it.
          y: 460,
          scale: 0.72,
          ease: 'none',
        },
        0,
      )
        .to('[data-shield="glow"]', { opacity: 0.3, scale: 1.35, ease: 'none' }, 0)
        // Gone before it reaches anything anybody has to read.
        .to('[data-shield="stage"]', { opacity: 0, ease: 'power2.in' }, 0.55);
    }, el);

    // Fonts and images settle after mount and move every offset below them; a
    // trigger measured against the old layout starts in the wrong place.
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
      className={cn('pointer-events-none absolute hidden select-none lg:block', className)}
      style={{ perspective: '1400px' }}
    >
      <div
        data-shield="stage"
        className="relative aspect-square w-full"
        style={{
          transformStyle: 'preserve-3d',
          // The opening angle lives here rather than in the tween, so this is
          // what somebody sees if nothing ever animates.
          transform: 'rotateX(10deg) rotateY(-22deg)',
        }}
      >
        {/* Atmosphere, furthest back. */}
        <div
          data-shield="glow"
          className="absolute left-1/2 top-1/2 size-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-md-primary/25 blur-3xl"
        />

        {/* The surface being protected: a plate well behind the shield, so the
            gap between them is visible the moment anything turns. */}
        <div
          className="absolute inset-[16%] rounded-[30%] border border-md-outline-variant/50 bg-md-surface/30"
          style={{ transform: 'translateZ(-150px)' }}
        />

        <svg
          data-shield="ring-outer"
          viewBox="0 0 200 200"
          fill="none"
          className="absolute inset-0 text-md-primary"
          style={{ transform: 'translateZ(-90px)' }}
        >
          <circle cx="100" cy="100" r="96" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 16" strokeLinecap="round" />
          {/* Tick marks, so the ring reads as an instrument rather than a halo. */}
          {Array.from({ length: 24 }, (_, i) => (
            <line
              key={i}
              x1="100" y1="6" x2="100" y2={i % 3 === 0 ? 16 : 11}
              stroke="currentColor"
              strokeOpacity={i % 3 === 0 ? 0.4 : 0.18}
              strokeWidth="1.4"
              strokeLinecap="round"
              transform={`rotate(${i * 15} 100 100)`}
            />
          ))}
        </svg>

        <svg
          data-shield="ring-inner"
          viewBox="0 0 200 200"
          fill="none"
          className="absolute inset-[10%] text-md-primary"
          style={{ transform: 'translateZ(-52px)' }}
        >
          <circle cx="100" cy="100" r="92" stroke="currentColor" strokeOpacity="0.42" strokeWidth="1.5" strokeDasharray="26 12 4 12" strokeLinecap="round" />
        </svg>

        {/* ── The body ── */}
        <div data-shield="body" className="absolute inset-[15%]" style={{ transformStyle: 'preserve-3d' }}>
          {/* The side wall. Each slice is the same outline a little further
              back; turning the assembly opens them into a visible edge. */}
          {EXTRUSION.map((layer) => (
            <svg
              key={layer.z}
              viewBox="0 0 160 180"
              fill="none"
              className="absolute inset-0 size-full text-md-primary"
              style={{ transform: `translateZ(${layer.z}px)` }}
            >
              <path d={SHIELD_PATH} fill="currentColor" fillOpacity={Math.max(layer.opacity, 0.06)} />
            </svg>
          ))}

          {/* The face. */}
          <svg
            viewBox="0 0 160 180"
            fill="none"
            className="absolute inset-0 size-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.22)]"
          >
            <defs>
              <linearGradient id="rift-shield-face" x1="18" y1="0" x2="150" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--md-primary-container)" />
                <stop offset="52%" stopColor="var(--md-secondary-container)" />
                <stop offset="100%" stopColor="var(--md-tertiary-container)" />
              </linearGradient>

              {/* A chiselled face: the left half catches light, the right falls
                  away. Two facets are enough to stop it reading as a decal. */}
              <linearGradient id="rift-shield-facet" x1="80" y1="0" x2="80" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="rift-shield-shade" x1="80" y1="180" x2="80" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--md-primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--md-primary)" stopOpacity="0" />
              </linearGradient>

              <clipPath id="rift-shield-clip">
                <path d={SHIELD_PATH} />
              </clipPath>
            </defs>

            <path d={SHIELD_PATH} fill="url(#rift-shield-face)" />

            <g clipPath="url(#rift-shield-clip)">
              {/* Left facet. */}
              <path d="M80 0 V180 L-10 180 V0 Z" fill="url(#rift-shield-facet)" opacity="0.55" />
              {/* Weight at the base, so it sits rather than floats. */}
              <rect x="0" y="0" width="160" height="180" fill="url(#rift-shield-shade)" />

              {/* Engraved scanlines: the surface reads as machined, and they
                  shear convincingly under rotation because they are clipped to
                  the silhouette rather than drawn around it. */}
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={i}
                  x1="-10" y1={26 + i * 17} x2="170" y2={12 + i * 17}
                  stroke="var(--md-primary)"
                  strokeOpacity="0.07"
                  strokeWidth="1"
                />
              ))}

              {/* The travelling sheen. */}
              <rect data-shield="sheen" x="-190" y="-40" width="52" height="260" fill="#fff" opacity="0.3" transform="rotate(18 80 90)" />
            </g>

            {/* Outer edge and raised inner rim. The pair is what makes the face
                look pressed rather than printed. */}
            <path d={SHIELD_PATH} fill="none" stroke="var(--md-primary)" strokeOpacity="0.45" strokeWidth="2" />
            <path d={SHIELD_RIM} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
            <path d={SHIELD_RIM} fill="none" stroke="var(--md-primary)" strokeOpacity="0.18" strokeWidth="3" strokeDasharray="1 6" strokeLinecap="round" />
          </svg>

          {/* The tick, well forward of the face so rotation opens a real gap
              between them instead of sliding one texture over another.

              `md-primary` rather than the on-container ink role: the ink is
              near-black, and against a pale lilac face it read as a borrowed
              glyph resting on the shield. The primary is the same hue as the
              gradient underneath, several steps darker, which is what makes the
              two look like one object. */}
          <svg
            viewBox="0 0 160 180"
            fill="none"
            className="absolute inset-0 size-full text-md-primary"
            style={{ transform: 'translateZ(46px)' }}
          >
            {/* Its own shadow, cast back onto the face. */}
            <path d="M52 89 l20 21 40-45" stroke="var(--md-primary)" strokeOpacity="0.22" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" transform="translate(3 5)" />
            <path d="M52 88 l20 21 40-45" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Satellites at mixed depths. The parallax between them is what the
            rotation is for. */}
        {[
          { cls: 'left-[3%] top-[24%] size-3', z: 150 },
          { cls: 'right-[6%] top-[12%] size-2', z: 200 },
          { cls: 'right-[1%] bottom-[28%] size-2.5', z: 120 },
          { cls: 'left-[11%] bottom-[12%] size-2', z: 180 },
          { cls: 'left-[46%] top-[2%] size-1.5', z: 230 },
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
