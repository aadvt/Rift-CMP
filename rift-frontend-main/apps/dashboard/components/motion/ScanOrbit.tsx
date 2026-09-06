'use client';
import * as React from 'react';
import { cn } from '@rift/ui';
import { shouldAnimate, withGsap } from './gsap';

/**
 * The thing that spins while a scan runs.
 *
 * ## What it is trying to say
 *
 * A crawl is a page being opened, its requests going out to other hosts, and
 * those hosts answering. So the figure is a centre with satellites moving around
 * it and a sweep passing over them — not a spinner, which says only "waiting",
 * and not a progress bar, which would claim a completion percentage this has no
 * way to know.
 *
 * It is decoration and it is honest about that: it carries no numbers, and the
 * real figures sit next to it. A visual that appeared to encode progress it does
 * not have would be worse than one that obviously encodes nothing.
 *
 * ## Theme
 *
 * Every colour is a `currentColor` or an `md-*` token, so it inherits whatever
 * surface it is dropped on and changes with the theme rather than against it.
 *
 * ## Reduced motion
 *
 * Nothing rotates. The rings and satellites still render — the figure is legible
 * standing still, and removing it entirely would leave a hole where somebody
 * else sees the system working.
 */
export function ScanOrbit({ size = 132, className }: { size?: number; className?: string }) {
  const ref = React.useRef<SVGSVGElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    const ctx = gsap.context(() => {
      // Two rings turning at different speeds, in opposite directions. Same
      // speed either way would read as one rigid object rotating.
      gsap.to('[data-orbit="outer"]', {
        rotate: 360,
        duration: 18,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });
      gsap.to('[data-orbit="inner"]', {
        rotate: -360,
        duration: 11,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });
      // The sweep is the part that reads as "looking". It is fast relative to
      // the rings so the eye follows it rather than the orbits.
      gsap.to('[data-orbit="sweep"]', {
        rotate: 360,
        duration: 2.6,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });
      gsap.to('[data-orbit="core"]', {
        scale: 1.14,
        opacity: 0.65,
        duration: 1.35,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        transformOrigin: '50% 50%',
      });
      // Satellites pulse out of phase, so the figure never looks like one
      // object breathing.
      gsap.to('[data-orbit="dot"]', {
        opacity: 0.35,
        duration: 1.1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: { each: 0.22, from: 'random' },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="Scan in progress"
      className={cn('shrink-0 text-md-primary', className)}
    >
      <defs>
        <linearGradient id="rift-sweep" x1="60" y1="60" x2="60" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* The sweep sits underneath everything so it passes behind the dots. */}
      <g data-orbit="sweep">
        <path d="M60 60 L60 6 A54 54 0 0 1 106 34 Z" fill="url(#rift-sweep)" />
      </g>

      <circle cx="60" cy="60" r="54" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
      <circle cx="60" cy="60" r="38" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
      <circle cx="60" cy="60" r="22" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />

      {/* Dashed rings read as measurement rather than as a border. */}
      <g data-orbit="outer">
        <circle
          cx="60" cy="60" r="54"
          stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5"
          strokeDasharray="3 15" strokeLinecap="round"
        />
        <circle data-orbit="dot" cx="60" cy="6" r="3.5" fill="currentColor" />
        <circle data-orbit="dot" cx="106" cy="87" r="2.6" fill="currentColor" />
        <circle data-orbit="dot" cx="14" cy="87" r="2.6" fill="currentColor" />
      </g>

      <g data-orbit="inner">
        <circle
          cx="60" cy="60" r="38"
          stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5"
          strokeDasharray="2 11" strokeLinecap="round"
        />
        <circle data-orbit="dot" cx="98" cy="60" r="3" fill="currentColor" />
        <circle data-orbit="dot" cx="22" cy="60" r="2.2" fill="currentColor" />
      </g>

      <circle data-orbit="core" cx="60" cy="60" r="11" fill="currentColor" fillOpacity="0.22" />
      <circle cx="60" cy="60" r="5" fill="currentColor" />
    </svg>
  );
}
