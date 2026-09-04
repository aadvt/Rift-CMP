import { StatusBadge } from "./ui";

/**
 * One site, as the product journey sees it.
 *
 * The card answers the questions an operator actually opens the dashboard
 * with — is it connected, is protection on, when did Rift last look, what did
 * it find, does anything need me — and answers them in that order.
 *
 * ## Two words that are not the same word
 *
 * **Connected** means data has reached Rift from this site. It is an
 * observation, not a check: nothing here fetches the site and confirms the
 * script is present, because no such endpoint exists. A site nobody has visited
 * since installing is indistinguishable from one where the snippet was never
 * pasted, and the card says "waiting" rather than guessing between them.
 *
 * **Protected** means an approved configuration exists and the runtime has
 * something to act on. Neither word is ever a claim that the site is compliant.
 * Nothing in this product decides that, and a green badge that implied it would
 * be the most expensive lie the interface could tell.
 *
 * ## Calm on purpose
 *
 * Findings are counts, not alarms. A site with forty cookies is not in trouble;
 * it is a site with forty cookies. Only genuinely unresolved items — the ones
 * where Rift is asking for a decision it cannot make — get the attention tone,
 * because an interface that shouts about everything trains people to hear
 * nothing.
 */

export interface SiteStatus {
  siteId: string;
  name: string;
  domain: string;
  /** Data has arrived from this site's browsers. */
  connected: boolean;
  /** An approved consent policy version exists. */
  protected: boolean;
  /** Latest scan status, or null when the site has never been scanned. */
  scanStatus: string | null;
  scannedAt: string | null;
  findings: {
    pages: number;
    cookies: number;
    services: number;
    technologies: number;
  } | null;
  /** Vendors Rift could not confidently place, plus purposes still undeclared. */
  attention: number;
  /** Purpose codes the configuration references that nobody has declared. */
  undeclaredPurposes: string[];
  sessions: number;
  pageViews: number;
}

function relative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function SiteStatusCard({ status }: { status: SiteStatus }) {
  const {
    siteId,
    domain,
    connected,
    scanStatus,
    scannedAt,
    findings,
    attention,
    sessions,
    pageViews,
  } = status;

  return (
    <article className="card site-status">
      <header className="row-between">
        <div>
          <p className="site-status-domain">{domain}</p>
          {status.name !== domain ? <p className="small">{status.name}</p> : null}
        </div>
        <StatusBadge status={connected ? "connected" : "waiting for data"} />
      </header>

      <dl className="site-status-facts">
        <div>
          <dt>Privacy</dt>
          <dd>{status.protected ? "Protected" : "Not configured yet"}</dd>
        </div>
        <div>
          <dt>Scanner</dt>
          <dd>
            {scanStatus === null
              ? "Never scanned"
              : scanStatus === "completed"
                ? `Last scan ${relative(scannedAt)}`
                : `Scan ${scanStatus}`}
          </dd>
        </div>
        <div>
          <dt>Analytics</dt>
          <dd>
            {sessions > 0
              ? `${sessions.toLocaleString()} sessions · ${pageViews.toLocaleString()} page views`
              : "No traffic recorded yet"}
          </dd>
        </div>
      </dl>

      {findings ? (
        <ul className="findings">
          {(
            [
              [findings.pages, "page", "pages"],
              [findings.cookies, "cookie", "cookies"],
              [findings.services, "third-party service", "third-party services"],
              [findings.technologies, "technology", "technologies"],
            ] as Array<[number, string, string]>
          ).map(([count, one, many]) => (
            <li key={many}>
              <strong>{count.toLocaleString()}</strong> {count === 1 ? one : many}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small">Nothing found yet — Rift has not scanned this site.</p>
      )}

      {attention > 0 ? (
        <p className="site-status-attention">
          <StatusBadge status="needs attention" />{" "}
          <span className="small">
            {attention === 1
              ? "1 technology Rift could not classify"
              : `${attention} technologies Rift could not classify`}
          </span>
        </p>
      ) : null}

      <p className="row-actions">
        <a href={`/dashboard/onboarding?site_id=${siteId}`}>Open setup</a>
        <a href={`/dashboard/consent-experience?site_id=${siteId}`}>Consent experience</a>
      </p>
    </article>
  );
}
