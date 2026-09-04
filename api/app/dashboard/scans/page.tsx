import type {
  ScanListResponse,
  ScanResultsResponse,
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
} from "../_components/ui";
import { formatCount, formatDateTime, shortId } from "../_components/format";
import { buildQuery, FilterBar, readFilter, SiteFilter } from "../_components/filters";

/**
 * Website scans.
 *
 * This is the screen the onboarding flow leads to: a site is registered, a scan
 * is queued, and this is where its findings become something an operator can
 * read and act on.
 *
 * Three things it is careful about.
 *
 * **A scan that has not finished is not shown as an inventory.** `queued`,
 * `running` and `failed` render their state rather than a table of zero
 * findings, because an empty inventory and an unfinished scan look identical in
 * a count and mean opposite things.
 *
 * **Every finding carries its evidence.** The question an operator asks first is
 * "why do you think my site uses this?", and a classification they cannot
 * interrogate is one they cannot correct.
 *
 * **Nothing here says what the law requires.** The scanner observes; whether a
 * cookie needs consent is a question for the policy engine and a human, and this
 * page deliberately renders no verdict. See docs/crawler.md.
 */
export default async function ScansPage({ searchParams }: PageProps<"/dashboard/scans">) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const scanId = readFilter(params, "scan_id");

  const sites = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");
  const resolvedSiteId = siteId ?? (sites.ok ? sites.data.sites[0]?.site_id : undefined);

  const scans = resolvedSiteId
    ? await apiGet<ScanListResponse>(`/api/v1/sites/${resolvedSiteId}/scans${buildQuery({ limit: 20 })}`)
    : null;

  // Default to the newest scan so the page is useful without a second click.
  const selectedId =
    scanId ?? (scans?.ok ? scans.data.scans[0]?.scan_id : undefined);

  const results = selectedId
    ? await apiGet<ScanResultsResponse>(`/api/v1/scans/${selectedId}/results`)
    : null;

  return (
    <>
      <PageHeader
        title="Scans"
        description="What an external browser session found on your site: pages, cookies, scripts, third-party destinations and the technologies behind them. A scan observes the site logged out, at one moment, under one configuration — it is evidence about what was seen, not a statement about what the law requires."
      />

      <FilterBar action="/dashboard/scans">
        {sites.ok ? <SiteFilter sites={sites.data.sites} value={resolvedSiteId} /> : null}
      </FilterBar>

      {sites.ok ? null : <ErrorState title="Site list could not be loaded" message={sites.message} />}

      {!resolvedSiteId ? (
        <EmptyState title="No sites yet" hint="Register a site before running a scan." />
      ) : !scans ? null : !scans.ok ? (
        <ErrorState title="Scans could not be loaded" message={scans.message} />
      ) : scans.data.scans.length === 0 ? (
        <EmptyState
          title="No scans yet"
          hint="Start one with POST /api/v1/sites/{siteId}/scans, then run the crawler worker."
        />
      ) : (
        <>
          <Section title={"Scan history"}>
            <p className="hint" style={{ marginTop: 0 }}>
              Newest first. A scan is queued by the API and performed by the crawler worker, so a queued scan stays queued until a worker picks it up.
            </p>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Scan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Start URL</th>
                    <th scope="col">Pages</th>
                    <th scope="col">Technologies</th>
                    <th scope="col">Started</th>
                    <th scope="col">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.data.scans.map((scan) => (
                    <tr key={scan.scan_id} aria-selected={scan.scan_id === selectedId}>
                      <td>
                        <a href={`/dashboard/scans${buildQuery({ site_id: resolvedSiteId, scan_id: scan.scan_id })}`}>
                          {shortId(scan.scan_id)}
                        </a>
                      </td>
                      <td><StatusBadge status={scan.status} /></td>
                      <td>{scan.start_url}</td>
                      <td>
                        {scan.status === "completed"
                          ? formatCount(scan.summary.pages_scanned)
                          : "—"}
                      </td>
                      <td>
                        {scan.status === "completed"
                          ? formatCount(scan.summary.technologies_detected)
                          : "—"}
                      </td>
                      <td>{formatDateTime(scan.started_at)}</td>
                      <td>{formatDateTime(scan.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>

          {results === null ? null : !results.ok ? (
            <ErrorState title="Scan results could not be loaded" message={results.message} />
          ) : (
            <ScanDetail results={results.data} />
          )}
        </>
      )}
    </>
  );
}

function ScanDetail({ results }: { results: ScanResultsResponse }) {
  const { scan, summary } = results;

  // An unfinished or failed scan is not an inventory. Rendering its (empty)
  // tables would read as "this site runs nothing", which is the most dangerous
  // wrong answer this screen can give.
  if (scan.status !== "completed") {
    return (
      <Section title={`Scan ${shortId(scan.scan_id)}`}>
        <p className="hint" style={{ marginTop: 0 }}>
          {`Status ${scan.status}. Findings appear once the scan completes.`}
        </p>
        {scan.status === "failed" && scan.error ? (
          <ErrorState
            title={`Scan failed: ${scan.error.code}`}
            message={scan.error.message || "No further detail was recorded."}
          />
        ) : (
          <EmptyState
            title={scan.status === "queued" ? "Waiting for a worker" : "Scan in progress"}
            hint={
              scan.status === "queued"
                ? "The crawler worker claims queued scans. Start it with: npm -w @rift-cmp/crawler run worker"
                : "Counts update as pages are rendered."
            }
          />
        )}
      </Section>
    );
  }

  const thirdPartyRequests = results.requests.filter((request) => request.third_party);
  const thirdPartyScripts = results.scripts.filter((script) => script.third_party && script.url);

  return (
    <>
      <Section title={`Scan ${shortId(scan.scan_id)}`}>
        <p className="hint" style={{ marginTop: 0 }}>
          {`${scan.start_url} — completed ${formatDateTime(scan.completed_at)} by crawler ${scan.crawler_version ?? "unknown"}.`}
        </p>
        <StatGrid>
          <StatTile label="Pages scanned" value={formatCount(summary.pages_scanned)} />
          <StatTile label="Pages failed" value={formatCount(summary.pages_failed)} />
          <StatTile label="Cookies" value={formatCount(summary.cookies_found)} />
          <StatTile label="Scripts" value={formatCount(summary.scripts_found)} />
          <StatTile label="Third-party domains" value={formatCount(summary.third_party_domains)} />
          <StatTile label="Technologies" value={formatCount(summary.technologies_detected)} />
        </StatGrid>

        {summary.limit_reached ? (
          <p className="note">
            This scan stopped early at the <code>{summary.limit_reached}</code> limit, so every
            count above is a floor rather than a total.
          </p>
        ) : null}

        <p className="note">
          Consent interface detected: <strong>{summary.consent_ui_detected ? "yes" : "no"}</strong>
          {results.consent_ui.signals.length > 0
            ? ` — ${results.consent_ui.signals.map((s) => `${s.kind}: ${s.detail}`).join("; ")}`
            : null}
          . Detecting a consent interface is not a judgement about whether it is valid or sufficient.
        </p>
      </Section>

      <Section title={"Technologies"}>
        <p className="hint" style={{ marginTop: 0 }}>
          What the detectors identified, and the evidence behind each one. Confidence is low when only a hostname matched. `Unclassified` means the host is not in the catalogue — an unknown third party is the row worth looking at first, not a safe one.
        </p>
        {results.technologies.length === 0 ? (
          <EmptyState title="No technologies identified" />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Technology</th>
                  <th scope="col">Category</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {results.technologies.map((technology) => (
                  <tr key={technology.detector_id}>
                    <td>{technology.name}</td>
                    <td>{technology.category}</td>
                    <td><StatusBadge status={technology.confidence} /></td>
                    <td>
                      {technology.destination_country ?? "unknown"}
                      {technology.crosses_border ? " (cross-border)" : ""}
                    </td>
                    <td>
                      <ul className="evidence">
                        {technology.evidence.map((item, index) => (
                          <li key={`${item.type}-${item.value}-${index}`}>
                            <code>{item.type}</code> {item.value}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title={"Cookies"}>
        <p className="hint" style={{ marginTop: 0 }}>
          Names and flags only. Cookie values are never read or stored by the scanner.
        </p>
        {results.cookies.length === 0 ? (
          <EmptyState title="No cookies observed" />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Domain</th>
                  <th scope="col">Party</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Flags</th>
                </tr>
              </thead>
              <tbody>
                {results.cookies.map((cookie) => (
                  <tr key={`${cookie.name}-${cookie.domain}-${cookie.path}`}>
                    <td>{cookie.name}</td>
                    <td>{cookie.domain}</td>
                    <td>{cookie.third_party ? "third-party" : "first-party"}</td>
                    <td>{cookie.expires ? formatDateTime(cookie.expires) : "session"}</td>
                    <td>
                      {[cookie.secure ? "secure" : null, cookie.http_only ? "httpOnly" : null, cookie.same_site]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title={"Third-party destinations"}>
        <p className="hint" style={{ marginTop: 0 }}>
          Hosts the pages contacted that are not the site&rsquo;s own. Aggregated per host and resource type; query strings are stripped at capture and never stored.
        </p>
        {thirdPartyRequests.length === 0 ? (
          <EmptyState title="No third-party destinations observed" />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Host</th>
                  <th scope="col">Type</th>
                  <th scope="col">Requests</th>
                  <th scope="col">Failed</th>
                </tr>
              </thead>
              <tbody>
                {thirdPartyRequests.map((request) => (
                  <tr key={`${request.host}-${request.resource_type}-${request.method}`}>
                    <td>{request.host}</td>
                    <td>{request.resource_type}</td>
                    <td>{formatCount(request.request_count)}</td>
                    <td>{formatCount(request.failed_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title={"Third-party scripts"}>
        <p className="hint" style={{ marginTop: 0 }}>
          External scripts loaded by the pages. Inline scripts are counted but never captured.
        </p>
        {thirdPartyScripts.length === 0 ? (
          <EmptyState title="No third-party scripts observed" />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Script</th>
                  <th scope="col">Host</th>
                  <th scope="col">Observed on</th>
                </tr>
              </thead>
              <tbody>
                {thirdPartyScripts.map((script, index) => (
                  <tr key={`${script.url}-${index}`}>
                    <td>{script.url}</td>
                    <td>{script.host}</td>
                    <td>{script.observed_on}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title={"Pages"}>
        <p className="hint" style={{ marginTop: 0 }}>
          Every page the crawler attempted. A failed page is listed rather than hidden &mdash; &ldquo;we tried and could not&rdquo; is information.
        </p>
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th scope="col">URL</th>
                <th scope="col">Status</th>
                <th scope="col">Depth</th>
                <th scope="col">Title</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.pages.map((page) => (
                <tr key={page.url}>
                  <td>{page.url}</td>
                  <td>{page.status ?? "—"}</td>
                  <td>{page.depth}</td>
                  <td>{page.title ?? "—"}</td>
                  <td>{page.rendered ? "rendered" : (page.error ?? "failed")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      {results.storage.length > 0 ? (
        <Section title={"Browser storage"}>
          <p className="hint" style={{ marginTop: 0 }}>
            Key names only. Stored values are never read by the scanner.
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Kind</th>
                  <th scope="col">Key</th>
                  <th scope="col">Origin</th>
                </tr>
              </thead>
              <tbody>
                {results.storage.map((item, index) => (
                  <tr key={`${item.kind}-${item.name}-${index}`}>
                    <td>{item.kind}</td>
                    <td>{item.name}</td>
                    <td>{item.origin}</td>
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
