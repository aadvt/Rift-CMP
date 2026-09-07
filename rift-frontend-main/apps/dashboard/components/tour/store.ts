'use client';

/**
 * What the browser remembers about the tour.
 *
 * ## Why localStorage and not the account
 *
 * "Have I seen this" is a property of a person, and the honest home for it is
 * their user row. The platform has no field for it, and adding one to answer a
 * UI question would put a migration and an endpoint in front of a feature that
 * degrades harmlessly without them: the worst case here is somebody being
 * offered a tour twice on a new laptop.
 *
 * If it moves to the account later, this module is the only thing that changes.
 *
 * ## Everything is wrapped
 *
 * `localStorage` throws rather than returning null in a browser configured to
 * block site data, and it is read during render paths that must not fail. A
 * tour that cannot remember is a small annoyance; a dashboard that will not
 * render because storage is disabled is not.
 */

/**
 * Bumped when the steps change enough that somebody who saw the old tour should
 * be offered the new one. Rewording a sentence does not qualify; adding a page
 * or restructuring what a screen is for does.
 */
const VERSION = 'v1';

const seenKey = (id: string) => `rift.tour.${VERSION}.seen.${id}`;
/** Set when somebody dismisses a tour with "Skip". Silences all of them. */
const OPT_OUT = `rift.tour.${VERSION}.optout`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Blocked storage. The tour runs, it just will not be remembered. */
  }
}

export function hasOptedOut(): boolean {
  return read(OPT_OUT) === '1';
}

export function optOut(): void {
  write(OPT_OUT, '1');
}

export function hasSeen(id: string): boolean {
  return read(seenKey(id)) === '1';
}

export function markSeen(id: string): void {
  write(seenKey(id), '1');
}

/**
 * Forgets everything, so "Replay the tour" starts from the beginning.
 *
 * Clears the opt-out too. Somebody asking to see the tour again has plainly
 * changed their mind about not wanting it, and leaving the flag set would mean
 * the button appeared to do nothing on the next page they visited.
 */
export function resetAll(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(`rift.tour.${VERSION}.`)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    /* Nothing was stored, so nothing needs clearing. */
  }
}
