import { headers } from "next/headers";
import type {
  NoticeSummary,
  PurposeSummary,
  RecipientSummary,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatTile,
  StatusBadge,
  TableWrap,
} from "../_components/ui";
import { formatCount, formatDate } from "../_components/format";
import { FilterBar, readFilter, SiteFilter } from "../_components/filters";
import { SdkSnippet } from "../_components/sdk-snippet";

/**
 * The origin an integrator should point the SDK at.
 *
 * Derived from the incoming request rather than configured, so the snippet is
 * correct on localhost, on a preview deployment and in production without
 * anyone editing an environment variable.
 */
async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "127.0.0.1:3000";
  const forwarded = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwarded ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** Reachability, not health: a failed fetch is the answer, not an exception. */
async function checkApi(origin: string): Promise<{ reachable: boolean; detail: string }> {
  try {
    const response = await fetch(`${origin}/api/healthz`, { cache: "no-store" });
    if (!response.ok) {
      return { reachable: false, detail: `Responded with status ${response.status}.` };
    }
    const body = (await response.json()) as { status?: string };
    return body.status === "ok"
      ? { reachable: true, detail: `${origin}/api/healthz` }
      : { reachable: false, detail: "Responded without an ok status." };
  } catch {
    return { reachable: false, detail: `No response from ${origin}/api/healthz.` };
  }
}

export default async function IntegrationPage({
  searchParams,
}: PageProps<"/dashboard/integration">) {
  const params = await searchParams;
  const requestedSiteId = readFilter(params, "site_id");
  const origin = await requestOrigin();

  const [sites, purposes, recipients, notices, health] = await Promise.all([
    apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites"),
    apiGet<{ purposes: PurposeSummary[] }>("/api/v1/purposes"),
    apiGet<{ recipients: RecipientSummary[] }>("/api/v1/recipients"),
    apiGet<{ notices: NoticeSummary[] }>("/api/v1/notices"),
    checkApi(origin),
  ]);

  const siteList = sites.ok ? sites.data.sites : [];
  const selectedSite =
    siteList.find((site) => site.site_id === requestedSiteId) ?? siteList[0] ?? null;

  return (
    <>
      <PageHeader
        title="Integration"
        description="Everything needed to install the SDK on a site and confirm this organisation is configured: site keys, the install snippet, API reachability, and the purposes and recipients already declared."
      />

      <Section title="API status">
        <div className="card">
          <StatusBadge status={health.reachable ? "ACTIVE" : "FAILED"} />{" "}
          <strong>{health.reachable ? "Reachable" : "Unreachable"}</strong>
          <p className="hint" style={{ margin: "6px 0 0" }}>
            {health.detail}
          </p>
        </div>
      </Section>

      <Section title="Sites">
        {!sites.ok ? (
          <ErrorState title="Sites could not be loaded" message={sites.message} />
        ) : siteList.length === 0 ? (
          <EmptyState
            title="No sites yet"
            hint="Create one with POST /api/v1/sites. A site is what the SDK authenticates as, and its public key is what goes into page source."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Site ID</th>
                  <th>Public key</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Consent gate</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {siteList.map((site) => (
                  <tr key={site.site_id}>
                    <td>{site.name}</td>
                    <td>
                      <code>{site.site_id}</code>
                    </td>
                    <td>
                      <code>{site.public_key}</code>
                    </td>
                    <td>{site.domain}</td>
                    <td>
                      <StatusBadge status={site.is_active ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    {/*
                      Whether the *server* refuses this site's events without
                      consent, as opposed to the SDK declining to queue them.
                      An operator who cannot see which of the two is in force
                      cannot know what the platform is actually enforcing.
                    */}
                    <td>
                      {site.analytics_consent_purpose ? (
                        <code>{site.analytics_consent_purpose}</code>
                      ) : (
                        <span className="hint">Not enforced</span>
                      )}
                    </td>
                    <td>{formatDate(site.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title="Install snippet">
        {!sites.ok ? (
          <ErrorState title="Snippet could not be built" message={sites.message} />
        ) : !selectedSite ? (
          <EmptyState
            title="Nothing to install yet"
            hint="Create a site first — the snippet is built from its site id and public key."
          />
        ) : (
          <>
            <FilterBar action="/dashboard/integration">
              <SiteFilter sites={siteList} value={selectedSite.site_id} />
            </FilterBar>
            <SdkSnippet
              site={selectedSite}
              origin={origin}
              // Same rule as the setup journey: no declared purposes means the
              // banner would have nothing to ask, so the call is left out.
              // Without this the two screens hand out different snippets for
              // the same site, and only one of them is right.
              hasPurposes={purposes.ok && purposes.data.purposes.some((p) => p.is_active)}
            />
            <p className="hint" style={{ marginBottom: 0 }}>
              The second argument is the site <strong>public</strong> key. It is meant to be read
              in page source and is not a secret; the organisation secret key never belongs in a
              browser.
            </p>
          </>
        )}
      </Section>

      <Section title="Configured purposes">
        {!purposes.ok ? (
          <ErrorState title="Purposes could not be loaded" message={purposes.message} />
        ) : purposes.data.purposes.length === 0 ? (
          <EmptyState
            title="No purposes declared"
            hint="A browser cannot invent a purpose: consent is only recorded against one this organisation has already declared via POST /api/v1/purposes. Until one exists, every grant is rejected."
          />
        ) : (
          <>
            <div className="grid" style={{ marginBottom: 12 }}>
              <StatTile label="Purposes" value={formatCount(purposes.data.purposes.length)} />
              <StatTile
                label="Notices"
                value={notices.ok ? formatCount(notices.data.notices.length) : "—"}
                hint={notices.ok ? "What was actually shown" : notices.message}
              />
            </div>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purposes.data.purposes.map((purpose) => (
                    <tr key={purpose.purpose_id}>
                      <td>
                        <code>{purpose.code}</code>
                      </td>
                      <td className="wrap">{purpose.name}</td>
                      <td>
                        <StatusBadge status={purpose.is_active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </Section>

      <Section title="Registered recipients">
        {!recipients.ok ? (
          <ErrorState title="Recipients could not be loaded" message={recipients.message} />
        ) : recipients.data.recipients.length === 0 ? (
          <EmptyState
            title="No recipients registered"
            hint="A transfer needs a target fiduciary to encrypt to. Register one with POST /api/v1/recipients, supplying its X25519 public key."
          />
        ) : (
          <>
            <div className="grid" style={{ marginBottom: 12 }}>
              <StatTile
                label="Recipients"
                value={formatCount(recipients.data.recipients.length)}
                hint="Rift holds public keys only"
              />
            </div>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Algorithm</th>
                    <th>Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.data.recipients.map((recipient) => (
                    <tr key={recipient.recipient_id}>
                      <td>
                        <code>{recipient.code}</code>
                      </td>
                      <td className="wrap">{recipient.name}</td>
                      <td>{recipient.algorithm}</td>
                      <td>
                        <StatusBadge status={recipient.is_active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>{formatDate(recipient.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </Section>
    </>
  );
}
