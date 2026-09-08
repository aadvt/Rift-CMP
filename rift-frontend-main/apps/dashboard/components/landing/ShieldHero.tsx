'use client';
import * as React from 'react';
import { cn } from '@rift/ui';
import { ShieldArt } from './ShieldArt';
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
 * Below `lg` this one is not rendered; `ShieldStatic` below takes over, in the
 * flow and holding a fixed angle. Both are `aria-hidden` throughout — the
 * shield depicts nothing a screen reader needs, and the heading beside it
 * already says what the product does.
 */

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
      <ShieldArt
        ids="shield-hero"
        // The opening angle lives here rather than in the tween, so this is
        // what somebody sees if nothing ever animates.
        stageStyle={{ transform: 'rotateX(10deg) rotateY(-22deg)' }}
      />
    </div>
  );
}

/**
 * The same shield, standing still, for a phone.
 *
 * ## Why it does not animate
 *
 * The desktop one turns because the reader scrolled — a response to them, which
 * is what stops it reading as a looping logo. At this size it sits behind the
 * copy, and something moving under text somebody is trying to read is a
 * distraction rather than an effect. So it holds a three-quarter angle and
 * stays there.
 *
 * It is the same component either way: the same fourteen extrusion slices, the
 * same rim, facets and raised tick, just without the timeline. Nothing is
 * redrawn or simplified for the small screen, because the detail is what makes
 * it an object rather than an icon and that reads at any size.
 *
 * ## It does not place itself
 *
 * No width, no margin, no position — the caller owns all of that. The first
 * version baked in `mx-auto` and a width because it was stacked above the copy,
 * and when that turned out to look like a splash screen the reader had to get
 * past, those built-in rules fought every attempt to move it. A decorative
 * element should know how to draw itself and nothing about where it goes.
 */
export function ShieldStatic({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none select-none lg:hidden', className)}
      style={{ perspective: '900px' }}
    >
      <ShieldArt
        ids="shield-static"
        stageStyle={{ transform: 'rotateX(9deg) rotateY(-19deg)' }}
      />
    </div>
  );
}
