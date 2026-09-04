import type {
  AnalyticsSummary,
  OverrideListResponse,
  PurposeSummary,
  RecommendedPolicyResponse,
  ScanListResponse,
  ScanStatusResponse,
  VendorRecommendation,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, requestOrigin } from "@/lib/dashboard/api";
import { EmptyState, ErrorState, PageHeader, Section, StatusBadge } from "../_components/ui";
import { JourneyProgress, NotYetAvailable, type JourneyStepId } from "../_components/journey";
import { ScanPoller } from "../_components/scan-poller";
import { SdkSnippet } from "../_components/sdk-snippet";
import { FilterBar, SiteFilter, readFilter } from "../_components/filters";
import {
  acceptGeneratedPolicy,
  cancelScan,
  clearRecommendationOverride,
  createSiteFromUrl,
  rescan,
  setRecommendationOverride,
} from "./actions";

/**
 * Setup: one continuous journey from a website address to a protected site.
 *
 * Website -> Scan -> Configure -> Install -> Verify. The operator's job is to
 * enter a URL, look at what Rift found, accept or adjust what Rift proposes, and
 * paste one snippet. Everything else - which technologies exist, which regimes
 * are in play, which vendor belongs to which purpose - is Rift's job.
 *
 * ## Where the operator's judgement is still required, and why
 *
 * Accepting the generated policy approves an immutable version of Rift's
 * recommendations. It does **not** declare purposes, and that is a deliberate
 * property of the platform rather than an unfinished edge: a purpose is
 * operator-declared free text describing that operator's own processing, so a
 * guessed mapping would be confident, unauditable and often wrong. The journey
 * therefore shows what is still undeclared and links to Configure rather than
 * quietly inventing purpose codes on someone's behalf.
 *
 * ## What this screen will not claim
 *
 * "Connected" describes setup. It is never a statement that a site is compliant,
 * because nothing in this product decides that. The policy engine returns
 * REVIEW far more often than it returns an obligation, and the open questions
 * are shown next to the answers for exactly that reason.
 */

export const dynamic = "force-dynamic";

/** Markets an operator can declare, limited to what the requirement matrix answers for. */
const MARKETS: Array<{ code: string; label: string }> = [
  { code: "DE", label: "European Union" },
  { code: "IN", label: "India" },
  { code: "US-CA", label: "California" },
  { code: "BR", label: "Brazil" },
];

/** Scanner confidence, said in words an operator can act on. */
const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Confirmed",
  medium: "Likely",
  low: "Uncertain",
};

/** What Rift proposes to do about a vendor, in plain language. */
const ACTION_LABEL: Record<string, string> = {
  allow: "No consent gate",
  require_consent: "Controlled until consent",
  block: "Not loaded",
  ignore: "Out of scope",
  review: "Needs your decision",
};

const REQUIREMENT_LABEL: Record<string, string> = {
  required: "Consent required",
  not_required: "No consent requirement found",
  conditional: "Conditional",
  unknown: "Not determined",
};

function marketsFrom(params: Record<string, string | string[] | undefined>): string[] {
  const raw = params.market;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return [raw];
  return ["DE"];
}

/** A vendor Rift could not confidently place. These are the rows to look at first. */
function needsReview(r: VendorRecommendation): boolean {
  return !r.overridden && (r.recommended_action === "review" || r.confidence === "low");
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const error = readFilter(params, "error");
  const accepted = readFilter(params, "accepted") === "1";
  const markets = marketsFrom(params);
  const marketQuery = markets.map((m) => `market=${encodeURIComponent(m)}`).join("&");

  const sitesResult = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");
  if (!sitesResult.ok) {
    return <ErrorState title="Could not load your websites" message={sitesResult.message} />;
  }

  const sites = sitesResult.data.sites;
  const site = sites.find((s) => s.site_id === siteId) ?? sites[0] ?? null;

  // Step 1: no site yet.
  if (!site) {
    return (
      <>
        <PageHeader
          title="Protect your website with Rift"
          description="Enter your website and Rift will scan it, work out what is running on it, prepare your privacy configuration, and generate your installation snippet."
        />
        <JourneyProgress current="website" />
        {error ? <ErrorState title="That did not work" message={error} /> : null}
        <Section>
          <form action={createSiteFromUrl} className="card entry-form">
            <label htmlFor="website_url">Your website address</label>
            <input
              id="website_url"
              name="website_url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com"
              required
              aria-describedby="website_url_hint"
            />
            <p id="website_url_hint" className="hint">
              Rift opens your site in a real browser and reports what it loads. It
              reads only what any visitor would.
            </p>
            <button type="submit" className="primary">
              Scan my website
            </button>
          </form>
        </Section>
      </>
    );
  }

  const siteRoot = `https://${site.domain}`;

  const [scansResult, policyResult, overridesResult, purposesResult, activityResult, origin] =
    await Promise.all([
      apiGet<ScanListResponse>(`/api/v1/sites/${site.site_id}/scans?limit=5`),
      apiGet<RecommendedPolicyResponse>(
        `/api/v1/sites/${site.site_id}/consent-policy${marketQuery ? `?${marketQuery}` : ""}`,
      ),
      apiGet<OverrideListResponse>(`/api/v1/sites/${site.site_id}/consent-policy/overrides`),
      apiGet<{ purposes: PurposeSummary[] }>("/api/v1/purposes"),
      apiGet<AnalyticsSummary>(`/api/v1/analytics/summary?site_id=${site.site_id}`),
      requestOrigin(),
    ]);

  const scans = scansResult.ok ? scansResult.data.scans : [];
  const latestScan = scans[0] ?? null;

  // The URL to scan defaults to whatever was scanned last, so "scan again"
  // repeats what the operator actually chose rather than silently reverting to
  // the site root. A staging URL or a deep page stays put between runs.
  const startUrl = latestScan?.start_url ?? siteRoot;
  const policy = policyResult.ok ? policyResult.data.policy : null;
  const activeVersion = policyResult.ok ? policyResult.data.active_version : null;
  const overrides = overridesResult.ok ? overridesResult.data.overrides : [];
  const declaredPurposes = purposesResult.ok
    ? purposesResult.data.purposes.filter((p) => p.is_active)
    : [];

  // Real evidence the snippet has run: the ingestion plane has seen this site.
  const totals = activityResult.ok ? activityResult.data.totals : null;
  const hasReceivedData = Boolean(totals && totals.total_events > 0);

  const scanRunning = latestScan?.status === "queued" || latestScan?.status === "running";
  const scanCompleted = latestScan?.status === "completed";

  const step: JourneyStepId = !latestScan
    ? "scan"
    : scanRunning || !scanCompleted
      ? "scan"
      : !activeVersion
        ? "configure"
        : !hasReceivedData
          ? "install"
          : "verify";

  const reviewItems = policy ? policy.recommendations.filter(needsReview) : [];

  return (
    <>
      <PageHeader
        title={site.domain}
        description="What Rift found on your site, what it proposes, and the one snippet that activates it."
      />
      {sites.length > 1 ? (
        <FilterBar action="/dashboard/onboarding">
          <SiteFilter sites={sites} value={site.site_id} />
        </FilterBar>
      ) : null}

      <JourneyProgress current={step} />
      <ScanPoller active={Boolean(scanRunning)} />

      {error ? <ErrorState title="That did not work" message={error} /> : null}
      {accepted ? (
        <div className="card note" role="status">
          <p className="note-title">Configuration accepted</p>
          <div className="note-body">
            <p>
              Rift saved this as an approved version. Approved versions cannot be
              edited - accepting again creates a new one, so the record of what
              was approved and when stays intact.
            </p>
          </div>
        </div>
      ) : null}

      <Section title="Scan">
        {!latestScan ? (
          <div className="card">
            <p>Rift has not looked at this site yet.</p>
            <ScanForm siteId={site.site_id} startUrl={startUrl} label="Start scan" primary />
          </div>
        ) : (
          <div className="card">
            <p className="row-between">
              <span>
                <StatusBadge status={latestScan.status} />
              </span>
              <span className="muted small">
                {latestScan.status === "running"
                  ? "Rift is opening your pages in a real browser."
                  : latestScan.status === "queued"
                    ? "Waiting for a browser to become free."
                    : null}
              </span>
            </p>

            <ScanFindings scanId={latestScan.scan_id} />

            {latestScan.status === "failed" ? (
              <p className="small">
                The scan stopped early. Anything it managed to collect before
                stopping is still shown above - a failed scan is not an empty one.
              </p>
            ) : null}

            <div className="row-actions">
              {scanRunning ? (
                <form action={cancelScan}>
                  <input type="hidden" name="site_id" value={site.site_id} />
                  <input type="hidden" name="scan_id" value={latestScan.scan_id} />
                  <button type="submit">
                    Stop scan
                  </button>
                </form>
              ) : (
                <ScanForm siteId={site.site_id} startUrl={startUrl} label="Scan again" />
              )}
            </div>
          </div>
        )}
      </Section>

      {scanCompleted ? (
        <>
          <Section title="What appears to apply">
            <div className="card">
              <form method="get" className="markets-form">
                <input type="hidden" name="site_id" value={site.site_id} />
                <p className="small">
                  Which markets do you offer this service in? That is a decision
                  about your business - Rift does not try to infer it from
                  anybody&apos;s location.
                </p>
                <div className="market-options">
                  {MARKETS.map((m) => (
                    <label key={m.code} className="market-option">
                      <input
                        type="checkbox"
                        name="market"
                        value={m.code}
                        defaultChecked={markets.includes(m.code)}
                      />{" "}
                      {m.label}
                    </label>
                  ))}
                </div>
                <button type="submit">
                  Update
                </button>
              </form>

              {policy && policy.regimes.length > 0 ? (
                <p className="chips">
                  {policy.regimes.map((r) => (
                    <span className="chip" key={r}>
                      {r}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="small">
                  No market selected, so nothing was resolved. That is not a
                  finding that nothing applies.
                </p>
              )}

              {policy && policy.open_questions.length > 0 ? (
                <details className="disclosure">
                  <summary>
                    {policy.open_questions.length} things Rift will not decide for you
                  </summary>
                  <ul className="reasons">
                    {policy.open_questions.slice(0, 12).map((q, i) => (
                      <li key={`${q.reason}-${i}`}>{q.detail}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </Section>

          <Section title="Your Rift configuration">
            {!policy || policy.recommendations.length === 0 ? (
              <EmptyState
                title="Nothing to configure yet"
                hint="The scan found no third-party technologies. That may be correct, or the crawl may not have reached the pages that load them."
              />
            ) : (
              <>
                <div className="card">
                  <p className="lede">
                    Rift analysed {site.domain} and prepared this configuration
                    from what it found.
                  </p>
                  <ConfigurationSummary recommendations={policy.recommendations} />

                  {activeVersion ? (
                    <p className="small">
                      Version {activeVersion.version} is approved and serving.
                      Accepting again creates a new version.
                    </p>
                  ) : null}

                  <form action={acceptGeneratedPolicy} className="row-actions">
                    <input type="hidden" name="site_id" value={site.site_id} />
                    <input type="hidden" name="markets" value={markets.join(",")} />
                    <button type="submit" className="primary">
                      {activeVersion ? "Accept updated configuration" : "Use Rift configuration"}
                    </button>
                  </form>

                  {policy.undeclared_purposes.length > 0 ? (
                    <p className="small">
                      {policy.undeclared_purposes.length} purpose
                      {policy.undeclared_purposes.length === 1 ? "" : "s"} referenced
                      here {policy.undeclared_purposes.length === 1 ? "is" : "are"} not
                      declared yet ({policy.undeclared_purposes.join(", ")}). Accepting
                      approves Rift&apos;s recommendations; declaring a purpose is still
                      yours to do on{" "}
                      <a href={`/dashboard/configure?site_id=${site.site_id}`}>Configure</a>,
                      because only you know which of your purposes covers which vendor.
                    </p>
                  ) : null}
                </div>

                {reviewItems.length > 0 ? (
                  <div className="card review-card">
                    <p className="note-title">
                      {reviewItems.length === 1
                        ? "1 item needs your attention"
                        : `${reviewItems.length} items need your attention`}
                    </p>
                    <p className="small">
                      Rift found evidence of these but could not confidently
                      determine what they do. Leaving one unresolved is a valid
                      choice - unresolved is not the same as requiring consent.
                    </p>
                    {reviewItems.map((r) => (
                      <ReviewRow
                        key={r.detector_id}
                        recommendation={r}
                        siteId={site.site_id}
                        markets={markets.join(",")}
                        purposes={declaredPurposes}
                      />
                    ))}
                  </div>
                ) : null}

                <details className="disclosure card">
                  <summary>Review every technology ({policy.recommendations.length})</summary>
                  <div className="recommendation-list">
                    {policy.recommendations.map((r) => (
                      <RecommendationDetail
                        key={r.detector_id}
                        recommendation={r}
                        siteId={site.site_id}
                        markets={markets.join(",")}
                        overridden={overrides.some((o) => o.detector_id === r.detector_id)}
                      />
                    ))}
                  </div>
                </details>
              </>
            )}
          </Section>
        </>
      ) : null}

      {activeVersion ? (
        <Section title="Install">
          <SdkSnippet site={site} origin={origin} hasPurposes={declaredPurposes.length > 0} />
        </Section>
      ) : null}

      {activeVersion ? (
        <Section title="Verify">
          <div className="card">
            {hasReceivedData ? (
              <>
                <p className="row-between">
                  <StatusBadge status="connected" />
                  <span className="muted small">
                    {totals?.total_events === 1
                      ? "1 event received"
                      : `${totals?.total_events.toLocaleString()} events received`}
                  </span>
                </p>
                <p>
                  Rift has received data from {site.domain}, so the snippet is
                  installed and running.
                </p>
              </>
            ) : (
              <>
                <p>
                  <StatusBadge status="waiting" />
                </p>
                <p>
                  Nothing has arrived from {site.domain} yet. Once the snippet is on
                  a page a visitor loads, this will change on its own.
                </p>
                <p className="small">
                  If it stays empty: the snippet may not be on the page yet, the
                  page may be cached, or a Content Security Policy may be blocking
                  the script.
                </p>
              </>
            )}
          </div>

          <NotYetAvailable title="Rift cannot actively check your installation">
            <p>
              This panel reports whether Rift has <em>received</em> data, which is
              real evidence that the snippet ran. It is not an active check of your
              site: there is no endpoint that fetches your page and confirms the
              script, the site identity, and the consent and tracking controls
              individually.
            </p>
            <p>
              A site that has had no visitors since installing will show as waiting
              even though the snippet is correctly in place, and this screen will
              not tell those two situations apart.
            </p>
          </NotYetAvailable>
        </Section>
      ) : null}
    </>
  );
}

/**
 * Which URL to scan.
 *
 * Editable rather than derived, because the page an operator wants looked at is
 * often not the site root: a staging deployment, a checkout flow behind a
 * different path, a subdomain that loads the third parties the marketing page
 * does not. The crawler follows links from wherever it starts, so the starting
 * point decides what gets found.
 *
 * The value is validated server-side by `POST /scans` and by the SSRF guard,
 * which refuses private and loopback addresses whatever is typed here.
 */
function ScanForm({
  siteId,
  startUrl,
  label,
  primary = false,
}: {
  siteId: string;
  startUrl: string;
  label: string;
  primary?: boolean;
}) {
  const inputId = `start_url_${siteId}`;
  return (
    <form action={rescan} className="scan-form">
      <input type="hidden" name="site_id" value={siteId} />
      <label htmlFor={inputId}>Page to scan</label>
      <input
        id={inputId}
        name="start_url"
        type="text"
        inputMode="url"
        defaultValue={startUrl}
        required
        aria-describedby={`${inputId}_hint`}
      />
      <p id={`${inputId}_hint`} className="hint">
        Rift starts here and follows links from this page. Local and private
        addresses are refused.
      </p>
      <button type="submit" className={primary ? "primary" : undefined}>
        {label}
      </button>
    </form>
  );
}

/** Counts from the scan, fetched separately so a status poll stays cheap. */
async function ScanFindings({ scanId }: { scanId: string }) {
  const result = await apiGet<ScanStatusResponse>(`/api/v1/scans/${scanId}`);
  if (!result.ok) return null;

  const s = result.data.summary;
  // Singular and plural both occur constantly here - one cookie is an ordinary
  // result - and "1 cookies" makes a careful tool look careless.
  const found: Array<[string, string, number]> = [
    ["page", "pages", s.pages_scanned],
    ["cookie", "cookies", s.cookies_found],
    ["script", "scripts", s.scripts_found],
    ["third-party domain", "third-party domains", s.third_party_domains],
    ["technology", "technologies", s.technologies_detected],
  ];

  return (
    <>
      <ul className="findings">
        {found.map(([one, many, count]) => (
          <li key={many}>
            <strong>{count.toLocaleString()}</strong> {count === 1 ? one : many}
          </li>
        ))}
      </ul>
      {s.limit_reached ? (
        <p className="small">
          The crawl stopped at a limit ({s.limit_reached}), so every count above is
          a floor rather than a total.
        </p>
      ) : null}
      {s.pages_failed > 0 ? (
        <p className="small">
          {s.pages_failed} page{s.pages_failed === 1 ? "" : "s"} could not be
          reached. The rest were still scanned.
        </p>
      ) : null}
    </>
  );
}

/** How the generated configuration groups what was found. */
function ConfigurationSummary({ recommendations }: { recommendations: VendorRecommendation[] }) {
  const groups = new Map<string, number>();
  for (const r of recommendations) {
    const key =
      !r.overridden && needsReview(r)
        ? "Needs your decision"
        : (ACTION_LABEL[r.recommended_action] ?? r.recommended_action);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return (
    <ul className="config-groups">
      {[...groups].map(([label, count]) => (
        <li key={label}>
          <span className="config-group-count">{count}</span>
          <span className="config-group-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/** One vendor Rift could not place, with the decision the operator can make. */
function ReviewRow({
  recommendation,
  siteId,
  markets,
  purposes,
}: {
  recommendation: VendorRecommendation;
  siteId: string;
  markets: string;
  purposes: PurposeSummary[];
}) {
  const r = recommendation;
  return (
    <div className="review-row">
      <div>
        <p className="review-name">{r.vendor_name}</p>
        {r.detector_id !== r.vendor_name ? (
          <p className="muted small">{r.detector_id}</p>
        ) : null}
        <p className="small">{r.reason}</p>
      </div>
      <form action={setRecommendationOverride} className="review-form">
        <input type="hidden" name="site_id" value={siteId} />
        <input type="hidden" name="markets" value={markets} />
        <input type="hidden" name="detector_id" value={r.detector_id} />

        <label htmlFor={`action-${r.detector_id}`} className="sr-only">
          What should Rift do about {r.vendor_name}?
        </label>
        <select id={`action-${r.detector_id}`} name="action" defaultValue="require_consent">
          <option value="require_consent">Control until consent</option>
          <option value="allow">Allow without consent</option>
          <option value="block">Do not load</option>
          <option value="ignore">Out of scope</option>
        </select>

        {purposes.length > 0 ? (
          <>
            <label htmlFor={`purpose-${r.detector_id}`} className="sr-only">
              Purpose for {r.vendor_name}
            </label>
            <select id={`purpose-${r.detector_id}`} name="purpose_code" defaultValue="">
              <option value="">No purpose</option>
              {purposes.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <button type="submit">
          Classify
        </button>
      </form>
      <p className="small muted">
        Your choice overrides Rift&apos;s recommendation for this technology across
        the whole site.
      </p>
    </div>
  );
}

/** The full explanation behind one line of the configuration. */
function RecommendationDetail({
  recommendation,
  siteId,
  markets,
  overridden,
}: {
  recommendation: VendorRecommendation;
  siteId: string;
  markets: string;
  overridden: boolean;
}) {
  const r = recommendation;
  return (
    <div className="recommendation">
      <p className="recommendation-head">
        <strong>{r.vendor_name}</strong>
        <StatusBadge status={CONFIDENCE_LABEL[r.confidence] ?? r.confidence} />
        {r.overridden ? <StatusBadge status="your decision" /> : null}
      </p>
      <dl className="recommendation-facts">
        <dt>Detected as</dt>
        <dd>{r.category}</dd>
        <dt>Rift proposes</dt>
        <dd>{ACTION_LABEL[r.recommended_action] ?? r.recommended_action}</dd>
        <dt>Consent</dt>
        <dd>{REQUIREMENT_LABEL[r.consent_requirement] ?? r.consent_requirement}</dd>
        {r.suggested_purpose ? (
          <>
            <dt>Purpose</dt>
            <dd>{r.suggested_purpose}</dd>
          </>
        ) : null}
        <dt>Evidence</dt>
        <dd>
          {r.evidence.length > 0 ? r.evidence.map((e) => e.detail).join("; ") : "None recorded."}
        </dd>
        {r.rule_references.length > 0 ? (
          <>
            <dt>Rules cited</dt>
            <dd>{r.rule_references.join(", ")}</dd>
          </>
        ) : null}
      </dl>
      {!r.observed_in_latest_scan ? (
        <p className="small">
          The latest scan did not see this. It is kept rather than dropped: a vendor
          vanishing is usually a crawl that reached fewer pages, not a vendor that
          was removed.
        </p>
      ) : null}
      {overridden ? (
        <form action={clearRecommendationOverride}>
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="markets" value={markets} />
          <input type="hidden" name="detector_id" value={r.detector_id} />
          <button type="submit" className="quiet">
            Use Rift&apos;s recommendation instead
          </button>
        </form>
      ) : null}
    </div>
  );
}
