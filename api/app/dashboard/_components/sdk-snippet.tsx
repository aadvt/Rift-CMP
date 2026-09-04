import type { WebsiteSummary } from "@rift-cmp/shared";
import { buildInstallSnippet, buildPreferencesSnippet } from "@/lib/install-snippet";

/**
 * The install snippet for one site.
 *
 * Built from the site's real identifiers and this deployment's origin, so an
 * operator can copy it without editing anything. The second argument is the site
 * *public* key: it is designed to be read in page source and is not a secret.
 *
 * The snippet itself is built by `lib/install-snippet.ts` rather than here, so
 * it can be tested without rendering React — what a customer pastes into their
 * production site is worth asserting on directly.
 */
export function SdkSnippet({
  site,
  origin,
  hasPurposes = true,
}: {
  site: WebsiteSummary;
  origin: string;
  /** False before the operator has declared any purpose. */
  hasPurposes?: boolean;
}) {
  const snippet = buildInstallSnippet({
    siteId: site.site_id,
    publicKey: site.public_key,
    origin,
    withBanner: hasPurposes,
  });

  return (
    <div className="card">
      <pre style={{ margin: 0, overflowX: "auto" }}>
        <code>{snippet}</code>
      </pre>

      {hasPurposes ? (
        <>
          <p style={{ marginTop: 16, marginBottom: 8 }}>
            Optional: a control that lets a visitor change their mind. A
            withdrawal control nobody can find is one they do not have, so put it
            somewhere permanent — a footer link is the usual choice.
          </p>
          <pre style={{ margin: 0, overflowX: "auto" }}>
            <code>{buildPreferencesSnippet()}</code>
          </pre>
        </>
      ) : (
        <p style={{ marginTop: 16 }}>
          No purposes are declared for this organisation yet, so the banner would
          have nothing to ask and is left out of the snippet. Declare them under{" "}
          <strong>Configure</strong> and this will include{" "}
          <code>analytics.banner.show()</code>.
        </p>
      )}
    </div>
  );
}
