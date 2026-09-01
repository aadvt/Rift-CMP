import type { WebsiteSummary } from "@rift-cmp/shared";

/**
 * The install snippet for one site.
 *
 * Built from the site's real identifiers and this deployment's origin, so an
 * operator can copy it without editing anything. The second argument is the site
 * *public* key: it is designed to be read in page source and is not a secret.
 *
 * The consent gate is included deliberately. The SDK does not decide that
 * analytics requires consent — a regulation and an integrator do — so an install
 * that omits `setConsentCheck` sends events regardless of any decision, which is
 * almost never what the installer intended.
 */
export function SdkSnippet({ site, origin }: { site: WebsiteSummary; origin: string }) {
  const snippet = [
    "<!-- Self-hosted bundle: `npm run build` in sdk/ produces dist/index.global.js -->",
    '<script src="/js/rift-cmp.js"></script>',
    "<script>",
    `  analytics.init("${site.site_id}", "${site.public_key}", { apiUrl: "${origin}" });`,
    "",
    "  // Nothing is sent for a purpose the principal has not granted.",
    "  analytics.setConsentCheck((purpose) => analytics.consent.isGranted(purpose));",
    "</script>",
  ].join("\n");

  return (
    <div className="card">
      <pre style={{ margin: 0, overflowX: "auto" }}>
        <code>{snippet}</code>
      </pre>
    </div>
  );
}
