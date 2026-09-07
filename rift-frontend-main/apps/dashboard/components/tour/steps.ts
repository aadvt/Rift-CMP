import type { TourDefinition } from './types';

/**
 * What the tour says, page by page.
 *
 * ## The rule these were written to
 *
 * Each bubble says what a thing is *for*, and where it matters, what it will
 * not do. This product's whole argument is that it distinguishes what it
 * observed from what it inferred, and a tour that described every screen as
 * simply "your data" would undo that in the first thirty seconds somebody
 * spends here.
 *
 * So: "unresolved is a decision, not a gap", "a simulation changes nothing",
 * "Rift does not compute your deadline". Those sentences are the product. The
 * tour is the first place many people will read them.
 *
 * ## Shell steps repeat by design
 *
 * The navigation and the site switcher appear in the overview tour and nowhere
 * else. Explaining the sidebar again on every page would be the fastest way to
 * teach somebody to dismiss the tour.
 */

/**
 * Routes are matched after dynamic segments are collapsed, so
 * `/dashboard/sites/site_9fb2/graph` is looked up as
 * `/dashboard/sites/:id/graph`.
 */
export const TOURS: Record<string, TourDefinition> = {
  '/dashboard': {
    id: 'overview',
    label: 'Getting started',
    steps: [
      {
        title: 'Welcome to Rift',
        body: 'A two-minute tour of what each screen does. Every page has its own, and you can stop at any time — press Escape or Skip.',
      },
      {
        anchor: 'nav',
        placement: 'right',
        title: 'Everything lives here',
        body: 'Sites and Scans are what Rift found. Consent, Rights and Audit are what it recorded. Policies is what it applied.',
      },
      {
        anchor: 'site-switcher',
        placement: 'right',
        title: 'Which website you are looking at',
        body: 'Screens without a site in their address — Consent, Analytics, Install — follow whatever is selected here.',
      },
      {
        anchor: 'stat-strip',
        placement: 'bottom',
        title: 'The state of things',
        body: 'Consent decisions and capture rate come from real visitor activity. “Needs your attention” is the count of findings waiting on a decision only you can make.',
      },
      {
        anchor: 'sites-table',
        placement: 'top',
        title: 'Your websites',
        body: 'Select a row to open a site. The status column separates a site Rift is protecting from one that still needs the snippet installed.',
      },
      {
        anchor: 'tour-replay',
        placement: 'right',
        title: 'Replaying this',
        body: 'This button restarts the tour on any page. Nothing here is one-time.',
      },
    ],
  },

  '/dashboard/sites': {
    id: 'sites',
    label: 'Sites',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Every website on your account',
        body: 'Each one is scanned, configured and enforced independently. Nothing is shared between them except your organisation’s credentials.',
      },
      {
        anchor: 'page-actions',
        placement: 'left',
        title: 'Adding a website',
        body: 'Rift scans it immediately. You do not answer any questions about regulations or cookies first — the scan is what those answers come from.',
      },
    ],
  },

  '/dashboard/scans': {
    id: 'scans',
    label: 'Scans',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Every scan Rift has run',
        body: 'A scan is a real browser loading your pages and recording what happens: scripts, cookies, storage, network requests and the third parties behind them.',
      },
      {
        anchor: 'scans-table',
        placement: 'top',
        title: 'Comparing two scans',
        body: 'The “vs previous” column is where drift shows up — a tag somebody added last week appears here before it appears anywhere else.',
      },
    ],
  },

  '/dashboard/scans/:id': {
    id: 'scan-detail',
    label: 'Scan results',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'One scan, in full',
        body: 'While it runs you see each stage complete. Afterwards this becomes the findings and the evidence behind them.',
      },
      {
        anchor: 'page-actions',
        placement: 'left',
        title: 'Taking it with you',
        body: 'Save as PDF produces the readable report. The findings table has its own CSV export for the rows themselves.',
      },
      {
        anchor: 'findings',
        placement: 'top',
        title: 'What Rift found',
        body: 'Confidence is the axis that matters. Confirmed and Likely are Rift’s reading; Unresolved means it could not tell and has not guessed.',
      },
    ],
  },

  '/dashboard/consent': {
    id: 'consent',
    label: 'Consent',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What visitors actually decided',
        body: 'Operational consent data, kept deliberately separate from visitor analytics. These are records of decisions, not measurements of people.',
      },
      {
        anchor: 'consent-records',
        placement: 'top',
        title: 'Every decision, with its proof',
        body: 'Each record names the configuration version it was made against. The Proof column says whether it is signed, receipt-only, or has no evidence attached.',
      },
      {
        anchor: 'verify-proof',
        placement: 'left',
        title: 'Checking a record',
        body: 'Verify re-computes the proof and reports integrity, signature and chain separately — because “somebody edited this” and “a decision was removed from this person’s history” are different problems.',
      },
    ],
  },

  '/dashboard/rights': {
    id: 'rights',
    label: 'Rights requests',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What people have asked you to do',
        body: 'Access, deletion and objection requests submitted through your site arrive here with the clock already running.',
      },
      {
        anchor: 'rights-queue',
        placement: 'top',
        title: 'Deadlines are yours to declare',
        body: 'Rift does not compute one. Response windows differ by regime, and naming one would mean asserting which regime governs a particular request.',
      },
    ],
  },

  '/dashboard/policies': {
    id: 'policies',
    label: 'Policies',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What Rift applied, and when',
        body: 'Policy versions and the notices published against them. A consent record points at a version here, which is what makes it checkable later.',
      },
    ],
  },

  '/dashboard/audit': {
    id: 'audit',
    label: 'Audit',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Who changed what',
        body: 'Every configuration change, approval and override, with the person and the moment. This is the trail somebody asks for when a decision is questioned.',
      },
    ],
  },

  '/dashboard/experiments': {
    id: 'experiments',
    label: 'Experiments',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Testing consent wording',
        body: 'A variant can change display copy and nothing else. There is no field in which one could express a purpose, a rule, or an enforcement action.',
      },
    ],
  },

  '/dashboard/experiments/:id': {
    id: 'experiment-detail',
    label: 'Experiment',
    steps: [
      {
        anchor: 'page-actions',
        placement: 'left',
        title: 'Starting and stopping',
        body: 'Only the moves legal from the current state are offered. Starting re-checks your configuration first and refuses if the approved policy has changed since this was drafted.',
      },
    ],
  },

  '/dashboard/analytics': {
    id: 'analytics',
    label: 'Analytics',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Analytics without the tracking',
        body: 'First-party, no cross-site identifiers, no personal data leaving your control. The numbers you needed a third-party tag for, from something that does not need consent to run.',
      },
    ],
  },

  '/dashboard/install': {
    id: 'install',
    label: 'Installation',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'One script tag',
        body: 'Paste it once. From then on Rift shows the banner, blocks what has not been agreed to, records every decision and tells you when your site changes.',
      },
    ],
  },

  '/dashboard/settings': {
    id: 'settings',
    label: 'Settings',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Account settings',
        body: 'Consent renewal and what Rift keeps with every decision. Anything shown without a control is behaviour the platform fixes rather than something you configure.',
      },
    ],
  },

  '/dashboard/sites/:id': {
    id: 'site-overview',
    label: 'This website',
    steps: [
      {
        anchor: 'site-tabs',
        placement: 'bottom',
        title: 'Everything about one site',
        body: 'Findings and Privacy configuration are what to read first. Data flow, Simulate and Intelligence are for once it is running.',
      },
      {
        anchor: 'page-actions',
        placement: 'left',
        title: 'Re-scanning',
        body: 'Run scan now starts a fresh crawl. Sites change without anybody deciding to, which is what the comparison between scans is for.',
      },
    ],
  },

  '/dashboard/sites/:id/privacy': {
    id: 'privacy',
    label: 'Privacy assessment',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Rift’s assessment, not a legal determination',
        body: 'It tells you what it observed, which requirements it believes apply, and how confident it is. Where it cannot be confident it says so rather than guessing.',
      },
      {
        anchor: 'regulations',
        placement: 'top',
        title: 'Why each rule was applied',
        body: 'Open the reasoning on any regulation to see the factors behind it, the source, and the knowledge-base version it came from.',
      },
    ],
  },

  '/dashboard/sites/:id/configuration': {
    id: 'configuration',
    label: 'Configuration',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What Rift proposes',
        body: 'Categories, which scripts belong in each, and the banner — generated from the scan, presented as a change you approve rather than one already made.',
      },
    ],
  },

  '/dashboard/sites/:id/graph': {
    id: 'graph',
    label: 'Data flow',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What runs, and where it sends data',
        body: 'Every edge carries how it is known: observed in a scan, configured by you, enforced at runtime, or inferred — and inferred says so.',
      },
    ],
  },

  '/dashboard/sites/:id/simulate': {
    id: 'simulate',
    label: 'Simulate',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Ask what would happen',
        body: 'Drop a tracker, declare a market, turn enforcement on — and see the effect against your real graph. Nothing here is applied and nothing is saved.',
      },
      {
        anchor: 'simulate-builder',
        placement: 'top',
        title: 'There is no apply button',
        body: 'On purpose. Changing a site goes through the configuration workflow, which has its own approval. A shortcut from here would be a policy bypass with a friendlier name.',
      },
    ],
  },

  '/dashboard/sites/:id/firewall': {
    id: 'firewall',
    label: 'Firewall',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What was blocked, and why',
        body: 'A banner that does not stop anything is decoration. This is the record of what Rift actually prevented from running, and the rule that decided it.',
      },
    ],
  },

  '/dashboard/sites/:id/intelligence': {
    id: 'intelligence',
    label: 'Intelligence',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Quality, drift and shadow tracking',
        body: 'Shadow findings are things running that your configuration does not account for. Drift is your site moving away from what you approved.',
      },
    ],
  },

  '/dashboard/sites/:id/discovery': {
    id: 'discovery',
    label: 'Discovery',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'The full inventory',
        body: 'Every host your pages contacted, what the catalogue knows about it, and where it sends data. This is the raw material the configuration is built from.',
      },
    ],
  },

  '/dashboard/sites/:id/data-flow': {
    id: 'data-flow',
    label: 'Data flow',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'Recipients and transfers',
        body: 'Who receives data, under what purpose, and on whose authorisation. Cross-border transfers are called out because they are the ones that need a basis.',
      },
    ],
  },

  '/dashboard/sites/:id/changes': {
    id: 'changes',
    label: 'Changes',
    steps: [
      {
        anchor: 'page-title',
        placement: 'bottom',
        title: 'What changed since last time',
        body: 'Appeared, moved, or started sending data somewhere new — with the two scans side by side so you can see which.',
      },
    ],
  },
};

/** Collapses dynamic segments so a route can be looked up in `TOURS`. */
export function tourKeyFor(pathname: string): string {
  return pathname
    .replace(/\/site_[^/]+/g, '/:id')
    .replace(/\/scn_[^/]+/g, '/:id')
    .replace(/\/exp_[^/]+/g, '/:id')
    // Anything else that looks like an opaque id: a long token, or one with an
    // underscore prefix this app uses for every generated identifier.
    .replace(/\/[a-z]{2,5}_[A-Za-z0-9]{4,}/g, '/:id')
    .replace(/\/$/, '');
}

export function tourFor(pathname: string): TourDefinition | null {
  return TOURS[tourKeyFor(pathname)] ?? null;
}
