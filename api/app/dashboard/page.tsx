import type { AuditResponse, PlatformOverview } from "@rift-cmp/shared";
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

/**
 * The operational overview.
 *
 * Counts first, then the timeline, because the question an operator opens this
 * page with is "is anything happening?" and only then "what happened?". The two
 * requests are independent, so one failing must not blank the other.
 */
export default async function OverviewPage() {
  const [overview, audit] = await Promise.all([
    apiGet<PlatformOverview>("/api/v1/analytics/overview"),
    apiGet<AuditResponse>("/api/v1/audit?limit=15"),
  ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Consent decisions, transfer authorisations and SDK activity across every site in this organisation."
      />

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
