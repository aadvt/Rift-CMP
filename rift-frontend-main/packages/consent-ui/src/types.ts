/**
 * The visitor-facing surface is driven entirely by props. It holds no consent
 * semantics of its own: which categories exist, what they are called, and what
 * copy appears all arrive from the configuration the API returns.
 */
export interface ConsentCategoryView {
  id: string;
  name: string;
  description: string;
  /** Necessary categories are always active and cannot be switched off. */
  locked: boolean;
}

export interface BannerCopy {
  title: string;
  body: string;
  acceptAll: string;
  rejectNonEssential: string;
  managePreferences: string;
  privacyNoticeLabel: string;
  privacyNoticeHref: string;
}

export interface PreferenceCopy {
  title: string;
  body: string;
  save: string;
  acceptAll: string;
  close: string;
}

export type ConsentSelection = Record<string, boolean>;

export const DEFAULT_BANNER_COPY: BannerCopy = {
  title: 'Your privacy matters',
  body: 'We use necessary technologies to keep this website working. With your permission, we may also use analytics and other technologies to understand how the site is used.',
  acceptAll: 'Accept all',
  rejectNonEssential: 'Reject non-essential',
  managePreferences: 'Manage preferences',
  privacyNoticeLabel: 'Privacy notice',
  privacyNoticeHref: '#',
};

export const DEFAULT_PREFERENCE_COPY: PreferenceCopy = {
  title: 'Privacy preferences',
  body: 'Choose what this website may use. You can change this at any time.',
  save: 'Save preferences',
  acceptAll: 'Accept all',
  close: 'Close privacy preferences',
};
