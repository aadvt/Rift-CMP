import type { AnalyticsSummary, BreakdownEntry, WebsiteSummary } from "@rift-cmp/shared";
import { apiGet } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatTile,
  TableWrap,
} from "../_components/ui";
import { displayPath, formatCount, formatDate, formatShare } from "../_components/format";
import {
  buildQuery,
  DateFilter,
  FilterBar,
  readFilter,
  SiteFilter,
} from "../_components/filters";

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const from = readFilter(params, "from");
  const to = readFilter(params, "to");

  const [sites, summary] = await Promise.all([
    apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites"),
    apiGet<AnalyticsSummary>(
      `/api/v1/analytics/summary${buildQuery({ site_id: siteId, from, to })}`,
    ),
  ]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="What the SDK is capturing. A fixed set of counts, not a query tool — enough to confirm an install is working and see roughly what it records."
      />

      <FilterBar action="/dashboard/analytics">
        {sites.ok ? <SiteFilter sites={sites.data.sites} value={siteId} /> : null}
        <DateFilter name="from" label="From" value={from} />
        <DateFilter name="to" label="To" value={to} />
      </FilterBar>

      {sites.ok ? null : (
        <ErrorState title="Site list could not be loaded" message={sites.message} />
      )}

      {!summary.ok ? (
        <ErrorState title="Analytics could not be loaded" message={summary.message} />
      ) : summary.data.totals.total_events === 0 ? (
        <EmptyState
          title="No events in this range"
          hint="Counts appear once a site with the SDK installed records a page view or a custom event. Widen the date range, or check the install snippet on the Integration page."
        />
      ) : (
        <Summary summary={summary.data} />
      )}
    </>
  );
}

function Summary({ summary }: { summary: AnalyticsSummary }) {
  const { totals } = summary;

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Showing {formatDate(summary.range.from)} to {formatDate(summary.range.to)}. These are{" "}
        <strong>sessions, not unique visitors</strong>: a session id lives in{" "}
        <code>sessionStorage</code> and expires after 30 minutes of inactivity, so one person
        across two days counts twice. The only durable per-person identifier in the system is{" "}
        <code>Principal</code>, which belongs to the consent domain and is deliberately never
        joined to analytics rows.
      </p>

      <Section title="Totals">
        <div className="grid">
          <StatTile
            label="Sessions"
            value={formatCount(totals.sessions)}
            hint="Not unique visitors"
          />
          <StatTile label="Page views" value={formatCount(totals.page_views)} />
          <StatTile label="Custom events" value={formatCount(totals.custom_events)} />
          <StatTile label="Total events" value={formatCount(totals.total_events)} />
          <StatTile label="Active sites" value={formatCount(totals.active_sites)} />
        </div>
      </Section>

      <Section title="Top pages">
        {summary.top_pages.length === 0 ? (
          <EmptyState
            title="No page views in this range"
            hint="The SDK emits a page_view automatically on load, once the consent gate allows it."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Title</th>
                  <th className="num">Views</th>
                </tr>
              </thead>
              <tbody>
                {summary.top_pages.map((page) => (
                  <tr key={page.url}>
                    <td className="wrap mono" title={page.url}>
                      {displayPath(page.url)}
                    </td>
                    <td className="wrap">{page.title}</td>
                    <td className="num">{formatCount(page.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title="Breakdowns">
        <div className="grid">
          <Breakdown title="Devices" rows={summary.devices} total={totals.total_events} />
          <Breakdown title="Browsers" rows={summary.browsers} total={totals.total_events} />
          <Breakdown
            title="Operating systems"
            rows={summary.operating_systems}
            total={totals.total_events}
          />
        </div>
      </Section>

      <Section title="By site">
        {summary.by_site.length === 0 ? (
          <EmptyState
            title="No site recorded activity"
            hint="A site appears here once it sends its first event."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th className="num">Sessions</th>
                  <th className="num">Page views</th>
                  <th className="num">Total events</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_site.map((site) => (
                  <tr key={site.site_id}>
                    <td>{site.name}</td>
                    <td className="num">{formatCount(site.sessions)}</td>
                    <td className="num">{formatCount(site.page_views)}</td>
                    <td className="num">{formatCount(site.total_events)}</td>
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

/** Share is against every event in range, so the three tables are comparable. */
function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: readonly BreakdownEntry[];
  total: number;
}) {
  return (
    <div>
      <h3 style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px", fontWeight: 500 }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <EmptyState title="Nothing recorded" />
      ) : (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th className="num">Events</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td className="num">{formatCount(row.events)}</td>
                  <td className="num">{formatShare(row.events, total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
