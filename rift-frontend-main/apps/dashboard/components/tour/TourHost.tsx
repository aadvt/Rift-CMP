'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Tour } from './Tour';
import { tourFor } from './steps';
import { hasOptedOut, hasSeen, markSeen, optOut, resetAll } from './store';
import type { TourDefinition } from './types';

/**
 * Decides when the tour appears.
 *
 * ## Why it waits
 *
 * Every screen in this app is a server component whose content streams in.
 * Opening the tour on mount would measure anchors that have not rendered, and
 * the steps that matter most — a table, a findings list — are exactly the ones
 * that arrive last. So it waits for the page to settle before looking.
 *
 * ## Skip means all of them, Escape means this one
 *
 * Somebody who presses Skip has told us they do not want to be taught. Treating
 * that as "not this page, but I will ask again on the next one" is how a
 * helpful feature becomes an irritating one. Escape is different: it closes
 * what is in front of them without making a claim about the rest, so the page
 * is marked seen and the others are left alone.
 *
 * ## Replaying is explicit
 *
 * `startNow` ignores both flags, because somebody who clicked "Replay the tour"
 * has plainly changed their mind and a silent no-op would look broken.
 */

interface TourApi {
  /** Opens the current page's tour regardless of what has been seen. */
  replay: () => void;
  /** Whether this page has anything to show, so a launcher can hide itself. */
  available: boolean;
}

const TourContext = React.createContext<TourApi>({ replay: () => {}, available: false });

export function useTour(): TourApi {
  return React.useContext(TourContext);
}

export function TourHost({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = React.useState<TourDefinition | null>(null);
  const definition = React.useMemo(() => tourFor(pathname ?? ''), [pathname]);

  /**
   * Auto-open, once, after the page has had a moment to render its content.
   *
   * ## It waits for the tab to be visible
   *
   * A hidden document is not laid out, so every element measures zero — which
   * the tour reads as "this anchor is not on the page" and filters the step
   * away. Opening in a background tab would therefore reduce a six-step tour to
   * its introduction, mark it seen, and never offer it again. Browsers preload
   * pages into hidden tabs routinely, so this is an ordinary path rather than a
   * corner case.
   *
   * Waiting costs nothing: a tour nobody is looking at has no reason to start.
   */
  React.useEffect(() => {
    setActive(null);
    if (!definition) return;
    if (hasOptedOut() || hasSeen(definition.id)) return;

    let timer = 0;
    const arm = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setActive(definition), 900);
    };

    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [definition]);

  const replay = React.useCallback(() => {
    if (!definition) return;
    // Clearing first means a replay that is interrupted still leaves the tour
    // available rather than marking it seen halfway through.
    resetAll();
    setActive(definition);
  }, [definition]);

  const api = React.useMemo<TourApi>(
    () => ({ replay, available: definition !== null }),
    [replay, definition],
  );

  return (
    <TourContext.Provider value={api}>
      {children}
      {active ? (
        <Tour
          definition={active}
          onClose={(reason) => {
            markSeen(active.id);
            if (reason === 'skip') optOut();
            setActive(null);
          }}
          onFinish={() => {
            markSeen(active.id);
            setActive(null);
          }}
        />
      ) : null}
    </TourContext.Provider>
  );
}
