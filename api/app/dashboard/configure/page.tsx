import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  PurposeSummary,
  ScanListResponse,
  ScanResultsResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, apiSend } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatusBadge,
  TableWrap,
} from "../_components/ui";
import { buildQuery, FilterBar, readFilter, SiteFilter } from "../_components/filters";

/**
 * Consent configuration: declare purposes, and see what the scanner found
 * against them.
 *
 * ## Why the mapping is not automatic
 *
 * The obvious feature here would be a button that turns "we detected Google
 * Analytics" into "analytics consent is required". It is deliberately absent.
 *
 * A purpose is operator-declared free text scoped to an organisation
 * (`purposes.code`), so the platform cannot know that *your* `analytics` purpose
 * is the one that covers Google Analytics — only you do. `docs/discovery.md`
 * reached the same conclusion for in-page discovery: "The mapping from host to
 * purpose belongs to the operator, not the SDK: only the fiduciary knows which
 * of its vendors serve which declared purpose."
 *
 * So this screen puts the two lists side by side, shows which technologies have
 * no purpose that plausibly covers them, and leaves the decision to a person.
 * A guessed mapping would be confident, unauditable and often wrong — and it
 * would be a legal conclusion drawn by a pattern match.
 *
 * Nothing here says what the law requires. That question belongs to the policy
 * engine and a human; see docs/policy-engine.md.
 */

async function declarePurpose(formData: FormData) {
  "use server";

  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const siteId = String(formData.get("site_id") ?? "").trim();

  const back = (message: string) =>
    redirect(`/dashboard/configure${buildQuery({ site_id: siteId })}${siteId ? "&" : "?"}error=${encodeURIComponent(message)}`);

  if (!code || !name || !description) {
    back("Code, name and description are all required.");
  }

  const created = await apiSend<PurposeSummary>("/api/v1/purposes", {
    method: "POST",
    body: { code, name, description },
  });

  if (!created.ok) {
    back(created.message);
  }

  revalidatePath("/dashboard/configure");
  redirect(`/dashboard/configure${buildQuery({ site_id: siteId })}`);
}

/** Categories the shipped detectors emit that are plainly not analytics or ads. */
const INFRASTRUCTURE_CATEGORIES = new Set([
  "cdn",
  "fonts",
  "payments",
  "consent_management",
  "error_monitoring",
  "hosting",
]);

export default async function ConfigurePage({ searchParams }: PageProps<"/dashboard/configure">) {
  const params = await searchParams;
  const siteId = readFilter(params, "site_id");
  const error = typeof params.error === "string" ? params.error : null;

  const [sites, purposes] = await Promise.all([
    apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites"),
    apiGet<{ purposes: PurposeSummary[] }>("/api/v1/purposes"),
  ]);

  const resolvedSiteId = siteId ?? (sites.ok ? sites.data.sites[0]?.site_id : undefined);

  // The newest completed scan is the evidence this screen reasons over.
  const scans = resolvedSiteId
    ? await apiGet<ScanListResponse>(`/api/v1/sites/${resolvedSiteId}/scans${buildQuery({ limit: 20 })}`)
    : null;
  const latestCompleted = scans?.ok
    ? scans.data.scans.find((scan) => scan.status === "completed")
    : undefined;
  const results = latestCompleted
    ? await apiGet<ScanResultsResponse>(`/api/v1/scans/${latestCompleted.scan_id}/results`)
    : null;

  const declared = purposes.ok ? purposes.data.purposes : [];

  return (
    <>
      <PageHeader
        title="Configure consent"
        description="Declare the purposes your site processes data for, and review them against what the scanner actually found. The platform will not map a detected technology to a purpose for you: only you know which of your vendors serve which declared purpose, and a guess here would be a legal conclusion drawn by a pattern match."
      />

      {error ? <ErrorState title="That did not work" message={error} /> : null}

      <FilterBar action="/dashboard/configure">
        {sites.ok ? <SiteFilter sites={sites.data.sites} value={resolvedSiteId} /> : null}
      </FilterBar>

      <Section title="Declare a purpose">
        <p className="hint" style={{ marginTop: 0 }}>
          A purpose is what you process data <em>for</em>, in your own words. The code is
          what the SDK and the consent API refer to it by, so keep it stable once
          visitors have decided against it.
        </p>
        <form action={declarePurpose} className="stack-form">
          <input type="hidden" name="site_id" value={resolvedSiteId ?? ""} />
          <label>
            <span>Code</span>
            <input
              name="code"
              type="text"
              required
              placeholder="analytics"
              pattern="[a-z0-9_\-]+"
              maxLength={100}
            />
          </label>
          <label>
            <span>Name</span>
            <input name="name" type="text" required placeholder="Analytics" maxLength={200} />
          </label>
          <label>
            <span>Description</span>
            <input
              name="description"
              type="text"
              required
              placeholder="Measuring how the site is used."
              maxLength={2000}
            />
          </label>
          <button type="submit">Declare purpose</button>
        </form>
      </Section>

      <Section title="Declared purposes">
        {!purposes.ok ? (
          <ErrorState title="Purposes could not be loaded" message={purposes.message} />
        ) : declared.length === 0 ? (
          <EmptyState
            title="No purposes declared"
            hint="Declare at least one before asking visitors to consent to anything."
          />
        ) : (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                {declared.map((purpose) => (
                  <tr key={purpose.purpose_id}>
                    <td><code>{purpose.code}</code></td>
                    <td>{purpose.name}</td>
                    <td>{purpose.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Section>

      <Section title="What the scanner found">
        {!resolvedSiteId ? (
          <EmptyState title="No site selected" hint="Add a website first." />
        ) : !latestCompleted ? (
          <EmptyState
            title="No completed scan for this site"
            hint="Run a scan from Websites, then come back — configuration is easier with evidence in front of you."
          />
        ) : !results ? null : !results.ok ? (
          <ErrorState title="Scan results could not be loaded" message={results.message} />
        ) : results.data.technologies.length === 0 ? (
          <EmptyState title="The scan identified no technologies" />
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              From the scan completed{" "}
              {latestCompleted.completed_at ? new Date(latestCompleted.completed_at).toISOString().slice(0, 10) : ""}.
              A category is what a technology is normally used for &mdash; it is not a
              consent purpose, and it is not a legal category. Deciding which purpose
              covers which technology is yours to make.
            </p>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Technology</th>
                    <th scope="col">Category</th>
                    <th scope="col">Confidence</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Needs a decision</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.technologies.map((technology) => {
                    // "Unresolved" is an honest default: this checks only whether a
                    // purpose exists whose code plainly matches the category, and a
                    // match is a hint for the operator, never an assignment.
                    const plausible = declared.filter(
                      (purpose) =>
                        purpose.code === technology.category ||
                        technology.category.includes(purpose.code) ||
                        purpose.code.includes(technology.category),
                    );
                    const infrastructure = INFRASTRUCTURE_CATEGORIES.has(technology.category);

                    return (
                      <tr key={technology.detector_id}>
                        <td>{technology.name}</td>
                        <td>{technology.category}</td>
                        <td><StatusBadge status={technology.confidence} /></td>
                        <td>
                          <ul className="evidence">
                            {technology.evidence.slice(0, 2).map((item, index) => (
                              <li key={`${item.type}-${index}`}>
                                <code>{item.type}</code> {item.value}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td>
                          {plausible.length > 0 ? (
                            <>
                              Possibly <code>{plausible[0].code}</code> &mdash; confirm
                            </>
                          ) : infrastructure ? (
                            <>Review: often necessary, but that is your call</>
                          ) : (
                            <strong>Unresolved &mdash; no declared purpose matches</strong>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <p className="hint">
              &ldquo;Unresolved&rdquo; means no purpose you have declared plainly covers
              this technology. It does <strong>not</strong> mean consent is required, and
              it does not mean the technology is unlawful &mdash; only that the platform
              will not decide for you. Whether a regime requires anything here is a
              question for the policy engine and a human reviewer.
            </p>
          </>
        )}
      </Section>
    </>
  );
}
