'use client';
import * as React from 'react';
import { shouldAnimate, withGsap } from './gsap';

/**
 * A number that counts to itself.
 *
 * Used where a figure is the point of the block — scan results, dashboard
 * headline stats. The count is short and eased out, so it reads as the value
 * settling rather than as a slot machine.
 *
 * It re-runs when `value` changes, which is what makes a live dashboard feel
 * live: a counter that moves from 3 to 4 while you are looking at it says
 * something happened, where a silent swap says nothing.
 *
 * `tabular-nums` belongs on whatever renders this. Without it the digits are
 * different widths and the number visibly jitters as it climbs.
 */
export function CountUp({
  value,
  duration = 0.9,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Without motion the number is simply the number. Counting is decoration.
    if (!shouldAnimate()) {
      el.textContent = String(value);
      return;
    }

    const gsap = withGsap();
    // Counting up from whatever is on screen — rather than from zero — means an
    // update from 41 to 44 moves three steps instead of restarting.
    const from = Number(el.textContent?.replace(/[^0-9-]/g, '')) || 0;
    const proxy = { n: from };

    const tween = gsap.to(proxy, {
      n: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = String(Math.round(proxy.n));
      },
    });

    return () => {
      tween.kill();
    };
  }, [value, duration]);

  // Rendered with the real value so it is correct before hydration, correct
  // without JavaScript, and correct to a screen reader that never sees the
  // intermediate frames.
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
