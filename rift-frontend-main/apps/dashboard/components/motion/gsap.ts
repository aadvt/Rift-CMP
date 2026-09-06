'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * One place that registers GSAP, and one place that decides whether to move.
 *
 * ## Why the plugin is registered here
 *
 * `registerPlugin` is idempotent but the import is not free, and registering it
 * in each component that animates means every one of them has to remember. A
 * single module keeps the plugin list readable and gives the tree-shaker one
 * answer instead of six.
 *
 * ## Reduced motion is a hard gate, not a shorter duration
 *
 * The rest of this app expresses motion through Tailwind's `motion-safe:`
 * variant, which the browser resolves from the same media query. GSAP animates
 * from JavaScript and knows nothing about that, so a scroll reveal written
 * without this check would keep moving for somebody who has asked the whole
 * system to stop — and it would be the only thing on the page still doing it.
 *
 * `shouldAnimate()` is therefore consulted before anything is tweened, and the
 * answer when it is false is always to jump to the finished state rather than
 * to animate quickly. Somebody with vestibular sensitivity is not asking for
 * less motion; they are asking for none.
 */

let registered = false;

export function withGsap(): typeof gsap {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return gsap;
}

export function shouldAnimate(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { ScrollTrigger };

/**
 * Insurance against an animation that never runs.
 *
 * Every reveal in this app works by hiding something and then animating it
 * back, which means the hidden state is applied by JavaScript and undone by
 * GSAP's ticker. The ticker is driven by `requestAnimationFrame`, and there are
 * real conditions where that never fires — a background tab, a throttled or
 * hidden view, a browser in a low-power state, an automated renderer. In those,
 * the "from" state lands and nothing ever clears it, and the page is not
 * degraded but blank.
 *
 * A blank hero is a far worse outcome than a hero that simply appears, so this
 * checks back once: if the animation has not advanced a frame by the deadline,
 * it is jumped to its finished state. Content wins over choreography.
 *
 * `whenVisible` exists for scroll-triggered animations, where sitting at
 * progress 0 is the correct behaviour for anything below the fold. Passing the
 * element means the guard only fires for something already on screen — which is
 * exactly the case where staying invisible is a bug rather than the design.
 */
export function guardAnimation(
  anim: gsap.core.Animation,
  { deadlineMs = 1800, whenVisible }: { deadlineMs?: number; whenVisible?: Element | null } = {},
): () => void {
  const id = setTimeout(() => {
    if (anim.progress() !== 0) return;
    if (whenVisible) {
      const r = whenVisible.getBoundingClientRect();
      const onScreen = r.top < window.innerHeight && r.bottom > 0;
      if (!onScreen) return;
    }
    anim.progress(1);
  }, deadlineMs);

  return () => clearTimeout(id);
}

/**
 * Detecting an environment that never paints.
 *
 * `guardAnimation` covers an animation that was started and did not advance.
 * It cannot cover the other case: an element below the fold, correctly hidden,
 * whose reveal is waiting on a trigger that will never arrive.
 *
 * IntersectionObserver looked like the answer and is not. Its callbacks are
 * delivered as part of the document's rendering lifecycle, the same lifecycle
 * that drives `requestAnimationFrame` — so in a view that never renders, the
 * observer never fires either, and hidden content stays hidden through any
 * amount of scrolling.
 *
 * A blanket timer would fix it and break the feature: reveal everything after a
 * few seconds and a reader who lingers on the first screen finds the rest of
 * the page already resolved.
 *
 * So this asks the question directly, once per page. Schedule a frame; if it
 * has not run by the deadline, nothing is painting and every reveal is told to
 * give up and show its content. `setTimeout` is not part of the rendering
 * lifecycle, which is exactly why it can be trusted to answer.
 */
type Waiter = () => void;

let paintKnown: boolean | null = null;
const waiters = new Set<Waiter>();

function probePaint(): void {
  if (paintKnown !== null || typeof window === 'undefined') return;

  let painted = false;
  requestAnimationFrame(() => {
    painted = true;
    paintKnown = true;
    waiters.clear();
  });

  setTimeout(() => {
    if (painted) return;
    paintKnown = false;
    for (const w of waiters) w();
    waiters.clear();
  }, 1500);
}

/**
 * Registers `reveal` to be called if this page turns out never to paint.
 *
 * Returns an unsubscribe. Called immediately when the answer is already known
 * to be no, and never called at all once a frame has run.
 */
export function ifPageNeverPaints(reveal: Waiter): () => void {
  if (typeof window === 'undefined') return () => {};

  probePaint();

  if (paintKnown === true) return () => {};
  if (paintKnown === false) {
    reveal();
    return () => {};
  }

  waiters.add(reveal);
  return () => waiters.delete(reveal);
}
