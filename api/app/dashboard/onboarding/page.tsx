import type {
  ConsentProposalResponse,
  PurposeSummary,
  ScanListResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, requestOrigin } from "@/lib/dashboard/api";
import { EmptyState, ErrorState, PageHeader, Section, StatusBadge, TableWrap } from "../_components/ui";
import { buildQuery, FilterBar, readFilter, SiteFilter } from "../_components/filters";
import { SdkSnippet } from "../_components/sdk-snippet";

/**
 * Onboarding: one screen from "we scanned your site" to "paste this".
 *
 * Phase 8B says a website owner should not have to understand the policy
 * engine, the database, jurisdiction resolution or anything cryptographic, and
 * should see six things: their website, its protection status, the trackers
 * found, the regulations that apply, a recommended configuration, and a way to
 * activate. That is the order of this page.
 *
 * ## What "recommended" means here, precisely
 *
 * Everything under *Recommended configuration* is a **proposal**, computed on
 * demand and stored nowhere. Rift does not declare a purpose on an operator's
 * behalf, and the reason is the one the Configure screen already gives: a
 * purpose is operator-declared free text, so only the operator knows which of
 * theirs covers a detected vendor, and a guessed mapping would be confident,
 * unauditable and often wrong.
 *
 * So each suggested purpose shows the technologies behind it and the evidence
 * that produced it, and the action is a link to Configure rather than a button
 * that writes. "Activate" is declaring the purposes and pasting the snippet —
 * both deliberate acts by a person.
 *
 * ## Why the regulations block is worded the way it is
 *
 * It reports what the policy engine considered applicable and, alongside it,
 * everything the engine would not decide. That second list is usually longer,
 * and showing only the first would present a research artifact as a compliance
 * verdict. The engine returns REVIEW far more often than it returns an
 * obligation; a screen that hid that would be the dishonest part of this phase.
 */

export const dynamic = "force-dynamic";

/** Markets an operator can declare, limited to what the matrix can answer for. */
const MARKETS: Array<{ code: string; label: string }> = [
  { code: "DE", label: "European Union" },
  { code: "IN", label: "India" },
  { code: "US-CA", label: "California" },
  { code: "BR", label: "Brazil" },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 9px",
        borderRadius: 999,
        border: "1px solid var(--line, #d9dee5)",
        fontSize: 12,
        marginRight: 6,
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const markets = (Array.isArray(params.market)
    ? params.market
    : params.market
      ? [params.market]
      : ["DE"]) as string[];

  const sites = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");
  if (!sites.ok) {
    return <ErrorState title="Could not load websites" message={sites.message} />;
  }

  const selected =
    sites.data.sites.find((s) => s.site_id === siteId) ?? sites.data.sites[0] ?? null;

  if (!selected) {
    return (
      <>
        <PageHeader
          title="Get started"
          description="Add a website, scan it, and Rift will suggest a starting configuration."
        />
        <EmptyState
          title="No websites yet"
          hint="Add one under Websites, then come back here."
        />
      </>
    );
  }

  const query = markets.map((m) => `market=${encodeURIComponent(m)}`).join("&");
  const [proposalResult, scansResult, purposesResult, origin] = await Promise.all([
    apiGet<ConsentProposalResponse>(
      `/api/v1/sites/${selected.site_id}/consent-proposal?${query}`,
    ),
    apiGet<ScanListResponse>(`/api/v1/sites/${selected.site_id}/scans?limit=1`),
    apiGet<{ purposes: PurposeSummary[] }>("/api/v1/purposes"),
    requestOrigin(),
  ]);

  const proposal = proposalResult.ok ? proposalResult.data.proposal : null;
  const latestScan = scansResult.ok ? (scansResult.data.scans[0] ?? null) : null;
  const declared = purposesResult.ok
    ? purposesResult.data.purposes.filter((p) => p.is_active)
    : [];

  // "Protected" is deliberately a description of setup, not a compliance claim.
  const hasScan = latestScan?.status === "completed";
  const hasPurposes = declared.length > 0;
  const stage = !hasScan ? "scan" : !hasPurposes ? "configure" : "install";

  return (
    <>
      <PageHeader
        title="Get started"
        description="What we found on your site, what appears to apply, and the one snippet to install."
      />

      <FilterBar action="/dashboard/onboarding">
        <SiteFilter sites={sites.data.sites} value={selected.site_id} />
      </FilterBar>

      {/* 1. Website + 2. Protection status */}
      <Section title="Your website">
        <div className="card">
          <p style={{ margin: 0, fontWeight: 600 }}>{selected.name}</p>
          <p style={{ margin: "4px 0 12px", color: "var(--muted, #5a626b)" }}>
            {selected.domain}
          </p>
          <p style={{ margin: 0 }}>
            <StatusBadge
              status={
                stage === "install"
                  ? "ready to install"
                  : stage === "configure"
                    ? "needs purposes"
                    : "not scanned yet"
              }
            />
          </p>
          <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--muted, #5a626b)" }}>
            {stage === "scan"
              ? "Run a scan under Scans to see what this site loads."
              : stage === "configure"
                ? "The scan finished. Declare the purposes below, then install the snippet."
                : "Purposes are declared. Paste the snippet and the banner will appear for visitors."}
          </p>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: "var(--muted, #767e88)" }}>
            This status describes how far setup has got. It is not a statement
            that the site is compliant — nothing here decides that.
          </p>
        </div>
      </Section>

      {/* 3. Detected trackers */}
      <Section title="What we found">
        {!hasScan ? (
          <EmptyState
            title="No completed scan"
            hint="Start one under Scans. A scan renders your pages in a real browser and reports what they load."
          />
        ) : proposal && proposal.purposes.length + proposal.unmapped_technologies.length === 0 ? (
          <EmptyState
            title="No third-party technologies were identified"
            hint="That may be correct, or the crawl may not have reached the pages that load them."
          />
        ) : (
          <div className="card">
            {proposal?.purposes.flatMap((p) => p.technologies).map((name) => (
              <Chip key={name}>{name}</Chip>
            ))}
            {proposal?.unmapped_technologies.map((t) => (
              <Chip key={t.name}>
                {t.name} · unclassified
              </Chip>
            ))}
            {proposal && proposal.unmapped_technologies.length > 0 ? (
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: "var(--muted, #5a626b)" }}>
                Unclassified means we saw it and could not name it. Those are the
                rows worth looking at first.
              </p>
            ) : null}
          </div>
        )}
      </Section>

      {/* 4. Applicable regulations */}
      <Section title="What appears to apply">
        <div className="card">
          <form method="get" style={{ marginBottom: 14 }}>
            <input type="hidden" name="site_id" value={selected.site_id} />
            <p style={{ margin: "0 0 8px", fontSize: 13 }}>
              Which markets do you offer this service in? This is a decision you
              make about your business — we do not try to work it out from
              anyone&apos;s location.
            </p>
            {MARKETS.map((m) => (
              <label key={m.code} style={{ marginRight: 14, fontSize: 14 }}>
                <input
                  type="checkbox"
                  name="market"
                  value={m.code}
                  defaultChecked={markets.includes(m.code)}
                />{" "}
                {m.label}
              </label>
            ))}
            <button type="submit" className="button" style={{ marginLeft: 10 }}>
              Update
            </button>
          </form>

          {proposal && proposal.regimes.length > 0 ? (
            <p style={{ margin: 0 }}>
              {proposal.regimes.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14 }}>
              No market selected, so nothing was resolved. That is not a finding
              that nothing applies.
            </p>
          )}

          {proposal && proposal.open_questions.length > 0 ? (
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 14 }}>
                {proposal.open_questions.length} things this cannot decide for you
              </summary>
              <ul style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
                {proposal.open_questions.slice(0, 12).map((q, i) => (
                  <li key={`${q.reason}-${i}`}>{q.detail}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </Section>

      {/* 5. Recommended configuration */}
      <Section title="Recommended configuration">
        {!proposal || proposal.purposes.length === 0 ? (
          <EmptyState
            title="Nothing to suggest yet"
            hint="Suggestions come from a completed scan. Until then, declare purposes yourself under Configure."
          />
        ) : (
          <>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Suggested purpose</th>
                    <th>Because we saw</th>
                    <th>Confidence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.purposes.map((p) => (
                    <tr key={p.suggested_code}>
                      <td>
                        <strong>{p.suggested_name}</strong>
                        <div style={{ fontSize: 12, color: "var(--muted, #5a626b)" }}>
                          {p.suggested_description}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{p.technologies.join(", ")}</td>
                      <td>
                        <StatusBadge status={p.confidence} />
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {p.already_declared ? "Already declared" : "Not declared yet"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--muted, #5a626b)" }}>
              These are suggestions, not settings. Nothing is applied until you
              declare a purpose yourself on the{" "}
              <a href={`/dashboard/configure${buildQuery({ site_id: selected.site_id })}`}>
                Configure
              </a>{" "}
              screen — only you know which of your purposes covers which vendor.
            </p>
          </>
        )}
      </Section>

      {/* 6. Activate */}
      <Section title="Install">
        <SdkSnippet site={selected} origin={origin} hasPurposes={hasPurposes} />
      </Section>
    </>
  );
}
