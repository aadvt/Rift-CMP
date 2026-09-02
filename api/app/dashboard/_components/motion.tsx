"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Motion primitives for the dashboard.
 *
 * ## Why entrance animation is CSS and not JavaScript
 *
 * The obvious implementation is a `motion.div` with `initial={{ opacity: 0 }}`.
 * It is also a trap: the server renders that initial state, so if the client
 * bundle fails — a hydration error, a blocked script, a slow network, an
 * extension — the content stays at `opacity: 0` and the operator gets a blank
 * dashboard with no error to explain it. This was not hypothetical; it happened
 * on the first build of this file.
 *
 * So entrance and stagger are plain CSS animations that move `transform` only,
 * never `opacity`. That is the stronger guarantee: an element that is never
 * animated is merely un-moved rather than invisible. It matters because an
 * animation can fail to run for reasons that have nothing to do with the code —
 * a browser freezes animation timelines in a hidden tab, so a page rendered
 * while backgrounded (a headless screenshot, print-to-PDF, a preloaded tab)
 * sits at frame zero indefinitely. Both failures were reproduced here.
 *
 * The rule this file follows: **nothing that hides content may depend on
 * JavaScript, or on an animation actually running.**
 *
 * Framer Motion is kept for the two things CSS genuinely cannot do — the shared
 * navigation highlight and the counting numbers — and both degrade to their
 * finished state when it does not load.
 *
 * Everything here honours `prefers-reduced-motion`. This is an operational
 * dashboard: someone reading a consent violation should not wait for a
 * flourish, and motion sickness is not a price of admission for a compliance
 * tool.
 */

/** Renders children with a CSS entrance. Visible even if no JS ever runs. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const style = delay ? ({ animationDelay: `${delay}s` } as CSSProperties) : undefined;
  return (
    <div className={className ? `reveal ${className}` : "reveal"} style={style}>
      {children}
    </div>
  );
}

/**
 * Staggers its children in.
 *
 * The delay is applied by `:nth-child` in CSS rather than by cloning children
 * and injecting inline styles, so this works on any children — including the
 * server-rendered ones a page passes straight through.
 */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `stagger ${className}` : "stagger"}>{children}</div>;
}

/** One item inside a `Stagger`. A plain element; the parent's CSS times it. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

/**
 * A number that counts up once, on mount.
 *
 * Deliberately not gated on scrolling into view. `useInView` needs
 * `IntersectionObserver`, which does not exist in jsdom and is missing in older
 * browsers, and a throw inside a stat tile would take the whole dashboard with
 * it. The tiles sit at the top of every page, so the viewport check was buying
 * nothing in exchange for a dependency that can be absent.
 *
 * The **final** value is what renders on the server and on first paint, so a
 * failed hydration shows the correct number rather than a permanent zero. The
 * animation only ever runs after mount, and only downward-adjusts the displayed
 * value for the duration of the count.
 *
 * Values are rounded: these are counts of consent decisions and transfers, and
 * a fractional intermediate — "3.7 violations" — would be nonsense even for
 * 400ms.
 */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState<number | null>(null);

  useEffect(() => {
    if (reduced || value === 0) return;

    // requestAnimationFrame is paused in a hidden tab. Starting the count there
    // would set the display to 0 and then never advance, leaving a permanent
    // wrong number on screen - the same failure the CSS entrance avoids by not
    // animating opacity. So the count simply does not start unless the document
    // is visible; the true value is already rendered.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    let frame = 0;
    const start = performance.now();
    // easeOutCubic: quick to begin, settling rather than stopping dead.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(ease(progress) * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(null);
    };

    frame = requestAnimationFrame(tick);

    // Belt and braces: if the frame loop is throttled or killed mid-count - the
    // tab is backgrounded partway through, say - this snaps back to the real
    // number. setTimeout is throttled in background tabs but still fires, where
    // rAF may not fire at all.
    const guard = setTimeout(() => setDisplay(null), duration + 500);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(guard);
    };
  }, [value, duration, reduced]);

  // `display === null` means "not animating", which covers both before the
  // count starts and after it finishes - in each case the true value is shown.
  return <span>{(display ?? value).toLocaleString("en-IN")}</span>;
}

/** A table body. Rows fade in via CSS, so a JS failure leaves them readable. */
export function AnimatedRows({ children }: { children: ReactNode }) {
  return <tbody className="stagger-rows">{children}</tbody>;
}

export function AnimatedRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={className}>{children}</tr>;
}

/**
 * Draws attention to a count once, when it is not zero.
 *
 * Zero is the good state and stays quiet. A non-zero value gets a single pulse
 * on arrival and then stops — a permanently animating badge is an alarm nobody
 * can switch off.
 */
export function AlertPulse({ active, children }: { active: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();

  if (reduced || !active) return <>{children}</>;

  return (
    <motion.span
      style={{ display: "inline-block" }}
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.6, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.span>
  );
}
