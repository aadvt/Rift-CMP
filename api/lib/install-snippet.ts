/**
 * The one thing a customer pastes.
 *
 * Phase 8B's target flow ends "Rift generates one installation snippet →
 * company pastes it once → Rift runtime handles the website". This builds it.
 *
 * ## Why the snippet is this short
 *
 * Everything that could have been a constructor argument is fetched at runtime
 * instead — purposes, copy, the notice, the display order all come from
 * `GET /api/v1/consent/config`. That is the difference between a snippet and a
 * configuration file: an operator who adds a purpose in the dashboard should not
 * have to redeploy somebody else's website, and a snippet that hard-coded the
 * purpose list would guarantee that the banner and the consent log disagree the
 * first time one of them changed.
 *
 * The only values baked in are the site id, the public key and the API origin —
 * the three things that identify *which* site this is, and none of which is a
 * policy.
 *
 * ## Why the consent gate is included
 *
 * The SDK does not decide that analytics requires consent; an integrator does.
 * An install that omits `setConsentCheck` sends events regardless of any
 * decision, which is almost never what the person pasting it intended. It runs
 * in the browser, so it is a courtesy to an honest integrator rather than a
 * control — server-side enforcement is `analytics_consent_purpose` on the site,
 * and the snippet says so, because the operator reading it is exactly the person
 * who needs to know the difference.
 */

export interface InstallSnippetInput {
  siteId: string;
  publicKey: string;
  /** Origin of this deployment, e.g. `https://app.example.com`. */
  origin: string;
  /** Path the bundle is served from. */
  scriptPath?: string;
  /**
   * Include the banner call.
   *
   * True once the site has declared purposes. A banner on a site with none
   * renders nothing at all, so including the line early is harmless — but an
   * operator who has not configured anything is better served by a snippet that
   * does not imply they have.
   */
  withBanner?: boolean;
}

/**
 * A JavaScript string literal that cannot break out of its quotes.
 *
 * The values here are our own identifiers rather than visitor input, so this is
 * defence in depth rather than a live threat — but the output is copied into
 * somebody else's HTML page, and a site name containing a quote should produce a
 * broken snippet at worst, never a script that runs something unintended.
 */
function js(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\u003C")
    .replace(/\r?\n/g, "");
}

export function buildInstallSnippet(input: InstallSnippetInput): string {
  const scriptPath = input.scriptPath ?? "/js/rift-cmp.js";
  const src = `${input.origin.replace(/\/$/, "")}${scriptPath}`;

  const lines = [
    "<!-- Rift consent + analytics. Paste once, before </head>. -->",
    `<script src="${js(src)}"></script>`,
    "<script>",
    `  analytics.init("${js(input.siteId)}", "${js(input.publicKey)}", { apiUrl: "${js(input.origin.replace(/\/$/, ""))}" });`,
    "",
    "  // Nothing is queued for a purpose that is not granted. This gate runs in",
    "  // the browser; for server-side enforcement set analytics_consent_purpose",
    "  // on this site.",
    "  analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));",
  ];

  if (input.withBanner !== false) {
    lines.push(
      "",
      "  // Shows only while a purpose is still undecided. Purposes and copy are",
      "  // fetched from Rift, so changing them needs no change here.",
      "  analytics.banner.show();",
    );
  }

  lines.push("</script>");
  return lines.join("\n");
}

/**
 * The snippet for a "cookie settings" link, offered separately.
 *
 * Kept out of the main block on purpose: it needs an element to attach to, and
 * where that element lives is the operator's decision. A withdrawal control the
 * visitor cannot find is one they do not have, so this is offered prominently
 * rather than left for them to discover in a document.
 */
export function buildPreferencesSnippet(): string {
  return [
    '<button type="button" id="cookie-settings">Cookie settings</button>',
    "<script>",
    '  document.getElementById("cookie-settings")',
    '    .addEventListener("click", () => analytics.banner.showPreferences());',
    "</script>",
  ].join("\n");
}
