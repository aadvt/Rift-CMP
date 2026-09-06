'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { guardAnimation, shouldAnimate, withGsap } from './gsap';

/**
 * The half-second between screens.
 *
 * Navigating in this app replaces the whole content column at once, which
 * without any transition reads as a flash — the eye cannot tell whether the
 * page changed or the old one redrew, and on a fast connection the two screens
 * are indistinguishable in memory a moment later. A short rise on arrival gives
 * the change a direction.
 *
 * ## Why arrival only
 *
 * The obvious version animates the outgoing screen too. That requires holding
 * the old tree while the new one mounts, which means either keeping stale data
 * on screen or a wrapper that defers navigation behind an animation — and a
 * click that visibly waits before anything happens is slower than no transition
 * at all, however smooth the result. So the outgoing screen simply goes, and
 * only the incoming one is animated.
 *
 * ## Why it is keyed on the pathname
 *
 * The effect has to re-run per navigation, and the children are server
 * components whose identity React has no reason to change. The pathname is the
 * thing that actually changed, so it is the dependency — and the `key` on the
 * wrapper makes React rebuild rather than reconcile, which is what stops a
 * half-finished tween from a fast double-navigation being inherited by the
 * screen after it.
 *
 * Query changes are deliberately not transitions: filtering a table is not
 * arriving somewhere, and animating it would make every filter feel like a page
 * load.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    const anim = gsap.fromTo(
      el,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' },
    );

    // A screen that never becomes visible because the ticker was starved is
    // the whole application gone, not one decoration missing.
    const unguard = guardAnimation(anim, { deadlineMs: 1200 });

    return () => {
      unguard();
      anim.kill();
      // Clearing the props rather than reverting: the element is about to be
      // replaced, and leaving a transform on it would offset whatever mounts
      // into the same position.
      gsap.set(el, { clearProps: 'opacity,transform' });
    };
  }, [pathname]);

  return (
    <div key={pathname} ref={ref} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
