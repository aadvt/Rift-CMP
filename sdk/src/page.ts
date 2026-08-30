export type PageContext = {
  referrer: string | null;
  initialReferrer: string | null;
};

const SESSION_KEY = "rift_cmp_page_referrer";

export function getPageContext(): PageContext {
  const currentReferrer = document.referrer || null;
  const existingReferrer = sessionStorage.getItem(SESSION_KEY);

  if (!existingReferrer) {
    sessionStorage.setItem(SESSION_KEY, currentReferrer ?? "");
  }

  return {
    referrer: currentReferrer,
    initialReferrer: existingReferrer ?? currentReferrer,
  };
}
