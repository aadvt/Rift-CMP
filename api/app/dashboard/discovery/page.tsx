import type { ClassifiedComponent, DiscoveryInventory, WebsiteSummary } from "@rift-cmp/shared";
import { apiGet } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatGrid,
  StatTile,
  TableWrap,
} from "../_components/ui";
import { formatCount, formatDateTime } from "../_components/format";
import { buildQuery, FilterBar, readFilter, SiteFilter } from "../_components/filters";

/**
 * What is actually running on a site's pages, where it sends data, and what
 * fired without consent.
 *
 * Ordered by what an operator has to act on rather than alphabetically:
 * violations first because they are evidence of a live problem, then unknown
 * third parties, then the full inventory.
 */
export default async function DiscoveryPage({ searchParams }: PageProps<"/dashboard/discovery">) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");

  const sites = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");
  const resolvedSiteId = siteId ?? (sites.ok ? sites.data.sites[0]?.site_id : undefined);

  const inventory = resolvedSiteId
    ? await apiGet<DiscoveryInventory>(
        `/api/v1/discovery/inventory${buildQuery({ site_id: resolvedSiteId })}`,
      )
    : null;

  return (
    <>
      <PageHeader
        title="Discovery"
        description="Every destination your pages contact, which component caused it, and where the data ends up. Observed from inside real page views by the SDK, not by a crawler — which is why a request that fired without consent can be recorded as evidence rather than guessed at."
      />

      <FilterBar action="/dashboard/discovery">
        {sites.ok ? <SiteFilter sites={sites.data.sites} value={resolvedSiteId} /> : null}
      </FilterBar>

      {sites.ok ? null : (
        <ErrorState title="Site list could not be loaded" message={sites.message} />
      )}

      {!resolvedSiteId ? (
        <EmptyState title="No sites yet" hint="Register a site before running discovery." />
      ) : !inventory ? null : !inventory.ok ? (
        <ErrorState title="Inventory could not be loaded" message={inventory.message} />
      ) : inventory.data.totals.destinations === 0 ? (
        <EmptyState
          title="Nothing observed yet"
          hint="Discovery is opt-in. Call analytics.discovery.start() after init() on the site you want to inspect, then load a page — the first report arrives within ten seconds."
        />
      ) : (
        <Inventory inventory={inventory.data} />
      )}
    </>
  );
}

function Inventory({ inventory }: { inventory: DiscoveryInventory }) {
  const { totals, components, storage, violations } = inventory;
  const thirdParty = components.filter((component) => component.third_party);
  const firstParty = components.filter((component) => !component.third_party);

  return (
    <>
      <Section title="Summary">
        <StatGrid>
          <StatTile label="Destinations" value={formatCount(totals.destinations)} />
          <StatTile
            label="Third party"
            value={formatCount(totals.third_party)}
            hint="Hosts other than your own origin"
          />
          <StatTile
            label="Unclassified"
            value={formatCount(totals.unclassified)}
            hint="Third parties we cannot name — check these first"
          />
          <StatTile
            label="Leaves India"
            value={formatCount(totals.cross_border)}
            hint="Known to terminate outside India"
          />
          <StatTile label="Storage keys" value={formatCount(totals.storage_items)} />
          <StatTile
            label="Consent violations"
            value={formatCount(totals.open_violations)}
            hint="Fired while consent was not granted"
          />
        </StatGrid>
      </Section>

      {violations.length > 0 ? (
        <Section title="Consent violations">
          <p className="hint" style={{ marginTop: 0 }}>
            These destinations were contacted while the principal&rsquo;s consent for that
            purpose was not granted. Recorded at the moment of the request, because effective
            consent is &ldquo;newest decision wins&rdquo; and cannot be reconstructed afterwards.
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Destination</th>
                  <th scope="col">Purpose</th>
                  <th scope="col">Consent was</th>
                  <th scope="col">Observed</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((violation, index) => (
                  <tr key={`${violation.host}-${violation.observed_at}-${index}`}>
                    <td><span className="mono">{violation.host}</span></td>
                    <td><span className="mono">{violation.purpose_code}</span></td>
                    <td>
                      <span className="badge badge-bad">{violation.consent_status}</span>
                    </td>
                    <td>{formatDateTime(violation.observed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      ) : null}

      <ComponentTable
        title="Third-party destinations"
        hint="Everything leaving your own origin. An unnamed vendor is not the same as a safe one — it is the row to investigate first."
        components={thirdParty}
      />

      {firstParty.length > 0 ? (
        <ComponentTable
          title="Your own origin"
          hint="Requests to the site's own host, listed for completeness."
          components={firstParty}
        />
      ) : null}

      {storage.length > 0 ? (
        <Section title="Storage written">
          <p className="hint" style={{ marginTop: 0 }}>
            Key names only. Values are never collected — a privacy tool that read them would
            be doing the thing it exists to prevent.
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Kind</th>
                  <th scope="col">Name</th>
                  <th scope="col">Written by</th>
                  <th scope="col">First seen</th>
                </tr>
              </thead>
              <tbody>
                {storage.map((item) => (
                  <tr key={`${item.kind}-${item.name}`}>
                    <td><span className="mono">{item.kind}</span></td>
                    <td><span className="mono">{item.name}</span></td>
                    <td>{item.writer ? <span className="mono">{item.writer}</span> : <span className="hint">page markup</span>}</td>
                    <td>{formatDateTime(item.first_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      ) : null}
    </>
  );
}

function ComponentTable({
  title,
  hint,
  components,
}: {
  title: string;
  hint: string;
  components: ClassifiedComponent[];
}) {
  if (components.length === 0) return null;

  return (
    <Section title={title}>
      <p className="hint" style={{ marginTop: 0 }}>
        {hint}
      </p>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">Destination</th>
              <th scope="col">Vendor</th>
              <th scope="col">Used for</th>
              <th scope="col">Caused by</th>
              <th scope="col">How</th>
              <th scope="col">Goes to</th>
              <th scope="col">Requests</th>
              <th scope="col">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={`${component.host}-${component.kind}`}>
                <td>
                  <span className="mono">{component.host}</span>
                  {component.sample_path ? (
                    <div className="hint" style={{ fontSize: "12px", margin: 0 }}>
                      {component.sample_path}
                    </div>
                  ) : null}
                </td>
                <td>
                  {component.vendor ?? (
                    <span className="badge badge-bad">Unclassified</span>
                  )}
                </td>
                <td>{component.category ? <span className="mono">{component.category}</span> : <span className="hint">—</span>}</td>
                <td>
                  {component.initiator ? (
                    <span className="mono">{component.initiator}</span>
                  ) : (
                    <span className="hint">page markup</span>
                  )}
                </td>
                <td><span className="mono">{component.kind}</span></td>
                <td>
                  {component.destination_country ? (
                    <span className={component.crosses_border ? "badge badge-bad" : "badge badge-ok"}>
                      {component.destination_country}
                    </span>
                  ) : (
                    <span className="hint">unknown</span>
                  )}
                </td>
                <td>{formatCount(component.request_count)}</td>
                <td>{formatDateTime(component.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Section>
  );
}
