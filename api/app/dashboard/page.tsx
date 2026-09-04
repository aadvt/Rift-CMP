import type {
  AnalyticsSummary,
  AuditResponse,
  PlatformOverview,
  RecommendedPolicyResponse,
  ScanListResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatGrid,
  StatTile,
  StatusBadge,
  TableWrap,
} from "./_components/ui";
import { formatCount, formatDateTime, shortId } from "./_components/format";
import { SiteStatusCard, type SiteStatus } from "./_components/site-status";

/**
 * The operational overview.
 *
 * Sites first, because the question an operator opens this page with is "are my
 * websites all right?" — a per-site answer, not an organisation-wide total.
 * Totals follow for the reader who wants them, then the timeline, because "is
 * anything happening?" precedes "what happened?".
 *
 * Every request here is independent and every failure is contained: one section
 * that cannot load must not blank the others, since a site being unreachable is
 * exactly when the rest of the page is worth reading.
 */
export default async function OverviewPage() {
  const [overview, audit, sitesResult, summary] = await Promise.all([
    apiGet<PlatformOverview>("/api/v1/analytics/overview"),
    apiGet<AuditResponse>("/api/v1/audit?limit=15"),
    apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites"),
    apiGet<AnalyticsSummary>("/api/v1/analytics/summary"),
  ]);

  const sites = sitesResult.ok ? sitesResult.data.sites : [];
  const activityBySite = new Map(
    (summary.ok ? summary.data.by_site : []).map((s) => [s.site_id, s]),
  );

  // Per-site status needs the site's scan and its policy, and neither is in any
  // organisation-wide response. The calls are made in parallel per site and each
  // one degrades on its own: a site whose scan cannot be read still reports
  // everything else about itself.
  const statuses: SiteStatus[] = await Promise.all(
    sites.map(async (site) => {
      const [scansResult, policyResult] = await Promise.all([
        apiGet<ScanListResponse>(`/api/v1/sites/${site.site_id}/scans?limit=1`),
        apiGet<RecommendedPolicyResponse>(`/api/v1/sites/${site.site_id}/consent-policy`),
      ]);

      const latestScan = scansResult.ok ? (scansResult.data.scans[0] ?? null) : null;
      const policy = policyResult.ok ? policyResult.data.policy : null;
      const activeVersion = policyResult.ok ? policyResult.data.active_version : null;

      // The scan list already carries each scan's summary, so there is no
      // second request per site to fetch counts we have been handed.
      const scanSummary =
        latestScan && latestScan.status === "completed" ? latestScan.summary : null;

      const activity = activityBySite.get(site.site_id);

      // "Attention" counts only what the *scanner* could not classify, which is
      // a fact about the site rather than about any jurisdiction.
      //
      // It deliberately does not count `recommended_action === "review"`, even
      // though the setup screen does. That verdict depends on the markets an
      // operator declares, and markets are chosen on the setup screen and stored
      // nowhere — so this page, which has no markets to send, gets a different
      // and more pessimistic answer from the same endpoint. Counting the
      // jurisdiction-independent half keeps the two screens from contradicting
      // each other with numbers that are both correct and different.
      const unresolved = policy
        ? policy.recommendations.filter((r) => !r.overridden && r.confidence === "low").length
        : 0;
      const undeclared = policy ? policy.undeclared_purposes : [];

      return {
        siteId: site.site_id,
        name: site.name,
        domain: site.domain,
        connected: (activity?.total_events ?? 0) > 0,
        protected: Boolean(activeVersion),
        scanStatus: latestScan?.status ?? null,
        scannedAt: latestScan?.completed_at ?? latestScan?.started_at ?? null,
        findings: scanSummary
          ? {
              pages: scanSummary.pages_scanned,
              cookies: scanSummary.cookies_found,
              services: scanSummary.third_party_domains,
              technologies: scanSummary.technologies_detected,
            }
          : null,
        attention: unresolved + undeclared.length,
        undeclaredPurposes: undeclared,
        sessions: activity?.sessions ?? 0,
        pageViews: activity?.page_views ?? 0,
      } satisfies SiteStatus;
    }),
  );

  return (
    <>
      <PageHeader
        title="Overview"
        description="Consent decisions, transfer authorisations and SDK activity across every site in this organisation."
      />

      <Section title="Your websites">
        {!sitesResult.ok ? (
          <ErrorState title="Websites could not be loaded" message={sitesResult.message} />
        ) : statuses.length === 0 ? (
          <EmptyState
            title="No websites yet"
            hint="Add one under Setup: enter your address and Rift scans it, prepares a configuration and generates your snippet."
          />
        ) : (
          <div className="site-status-grid">
            {statuses.map((status) => (
              <SiteStatusCard key={status.siteId} status={status} />
            ))}
          </div>
        )}
      </Section>

      {overview.ok ? <OverviewTiles overview={overview.data} /> : (
        <ErrorState title="Counts could not be loaded" message={overview.message} />
      )}

      <Section title="Recent activity">
        {!audit.ok ? (
          <ErrorState title="Activity could not be loaded" message={audit.message} />
        ) : audit.data.entries.length === 0 ? (
          <EmptyState
            title="No recorded activity yet"
            hint="Consent decisions, authorisations and transfers appear here as they happen. Install the SDK on a site, or record a decision through the API, to see the first entry."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Purpose</th>
                  <th>Principal</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.entries.map((entry) => (
                  <tr key={`${entry.kind}-${entry.at}-${entry.consent_record_id ?? entry.authorisation_id ?? entry.transfer_id ?? entry.summary}`}>
                    <td>{formatDateTime(entry.at)}</td>
                    <td>{entry.kind}</td>
                    <td>
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="mono">{entry.purpose_code}</td>
                    <td className="mono" title={entry.principal_external_id}>
                      {shortId(entry.principal_external_id)}
                    </td>
                    <td className="wrap">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}

function OverviewTiles({ overview }: { overview: PlatformOverview }) {
  return (
    <>
      <Section title="Sites">
        <StatGrid>
          <StatTile label="Total" value={formatCount(overview.sites.total)} />
          <StatTile label="Active" value={formatCount(overview.sites.active)} />
        </StatGrid>
      </Section>

      <Section title="Consent">
        <StatGrid>
          <StatTile
            label="Decisions"
            value={formatCount(overview.consent.total_decisions)}
            hint="Append-only; a withdrawal is a new decision"
          />
          <StatTile label="Granted" value={formatCount(overview.consent.granted)} />
          <StatTile label="Denied" value={formatCount(overview.consent.denied)} />
          <StatTile label="Withdrawn" value={formatCount(overview.consent.withdrawn)} />
          <StatTile
            label="Principals"
            value={formatCount(overview.consent.principals)}
            hint="Distinct people who decided at least once"
          />
        </StatGrid>
      </Section>

      <Section title="Authorisations">
        <StatGrid>
          <StatTile label="Total" value={formatCount(overview.authorisations.total)} />
          <StatTile label="Authorised" value={formatCount(overview.authorisations.authorised)} />
          <StatTile
            label="Consumed"
            value={formatCount(overview.authorisations.consumed)}
            hint="Single-use; spent on a transfer"
          />
          <StatTile label="Expired" value={formatCount(overview.authorisations.expired)} />
        </StatGrid>
      </Section>

      <Section title="Transfers">
        <StatGrid>
          <StatTile label="Total" value={formatCount(overview.transfers.total)} />
          <StatTile label="Recorded" value={formatCount(overview.transfers.recorded)} />
          <StatTile label="Delivered" value={formatCount(overview.transfers.delivered)} />
          <StatTile label="Failed" value={formatCount(overview.transfers.failed)} />
        </StatGrid>
      </Section>

      <Section title="Activity">
        <StatGrid>
          <StatTile
            label="Sessions"
            value={formatCount(overview.activity.sessions)}
            hint="Sessions, not unique visitors"
          />
          <StatTile label="Page views" value={formatCount(overview.activity.page_views)} />
          <StatTile label="Custom events" value={formatCount(overview.activity.custom_events)} />
        </StatGrid>
      </Section>
    </>
  );
}
