'use client';
import * as React from 'react';
import { cn } from '@rift/ui';

/**
 * The shield, as a picture.
 *
 * Split out of `ShieldHero` so the same object can appear twice — turning with
 * the scroll on a wide screen, and sitting still on a phone. Two copies of the
 * markup would have been two things to keep in step, and the mobile one would
 * have drifted the first time the desktop one was touched.
 *
 * ## Why the ids are parameterised
 *
 * Both shields are in the DOM at once; each is hidden at the breakpoint the
 * other owns. SVG ids are document-global, so with a fixed `id="…-face"` every
 * `url(#…-face)` in the second shield resolves to the first shield's gradient.
 * Here that happens to be identical markup and nothing looks wrong, which is
 * exactly what makes it a trap: it stays invisible until the two diverge.
 *
 * ## `data-shield` hooks
 *
 * Left on unconditionally. GSAP scopes its selectors to the root element it is
 * given, so the static copy having the same attributes costs nothing and keeps
 * one version of the markup rather than two.
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

export function ShieldArt({
  ids,
  className,
  stageStyle,
}: {
  /** Unique per instance. See the note above about document-global SVG ids. */
  ids: string;
  className?: string;
  /** The opening angle, and anything else the wrapper wants on the stage. */
  stageStyle?: React.CSSProperties;
}) {
  return (
    <div
      data-shield="stage"
      className={cn('relative aspect-square w-full', className)}
      style={{ transformStyle: 'preserve-3d', ...stageStyle }}
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
              <linearGradient id={`${ids}-face`} x1="18" y1="0" x2="150" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--md-primary-container)" />
                <stop offset="52%" stopColor="var(--md-secondary-container)" />
                <stop offset="100%" stopColor="var(--md-tertiary-container)" />
              </linearGradient>

              {/* A chiselled face: the left half catches light, the right falls
                  away. Two facets are enough to stop it reading as a decal. */}
              <linearGradient id={`${ids}-facet`} x1="80" y1="0" x2="80" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </linearGradient>

              <linearGradient id={`${ids}-shade`} x1="80" y1="180" x2="80" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--md-primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--md-primary)" stopOpacity="0" />
              </linearGradient>

              <clipPath id={`${ids}-clip`}>
                <path d={SHIELD_PATH} />
              </clipPath>
            </defs>

            <path d={SHIELD_PATH} fill={`url(#${ids}-face)`} />

            <g clipPath={`url(#${ids}-clip)`}>
              {/* Left facet. */}
              <path d="M80 0 V180 L-10 180 V0 Z" fill={`url(#${ids}-facet)`} opacity="0.55" />
              {/* Weight at the base, so it sits rather than floats. */}
              <rect x="0" y="0" width="160" height="180" fill={`url(#${ids}-shade)`} />

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
  );
}
