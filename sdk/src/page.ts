export type PageContext = {
  referrer: string | null;
  initialReferrer: string | null;
};

const SESSION_KEY = "rift_cmp_page_referrer";

export function getPageContext(): PageContext {
  const currentReferrer = document.referrer || null;
  const stored = sessionStorage.getItem(SESSION_KEY);

  // The first referrer seen in a session is the one we report for every event
  // in that session, so internal navigation does not overwrite it. "No
  // referrer" is persisted as an empty string (sessionStorage cannot hold
  // null), so it must be mapped back to null on read rather than reported
  // as "".
  if (stored === null) {
    sessionStorage.setItem(SESSION_KEY, currentReferrer ?? "");
    return { referrer: currentReferrer, initialReferrer: currentReferrer };
  }

  return { referrer: currentReferrer, initialReferrer: stored || null };
}
