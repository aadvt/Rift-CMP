import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreateScanResponse, WebsiteSummary } from "@rift-cmp/shared";
import { apiGet, apiSend } from "@/lib/dashboard/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Section,
  StatusBadge,
  TableWrap,
} from "../_components/ui";
import { formatDateTime } from "../_components/format";

/**
 * Websites: add one, and scan it.
 *
 * This is the write half of onboarding, and until now it did not exist — sites
 * were created with `curl` and scans were queued the same way, which meant the
 * whole platform worked and nobody could reach it.
 *
 * Both actions go through the public API rather than the database, so the
 * dashboard stays a consumer like any other integrator and the validation an
 * operator hits here is the same validation an API caller hits.
 */

async function addWebsite(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const rawDomain = String(formData.get("domain") ?? "").trim();

  if (!name || !rawDomain) {
    redirect("/dashboard/sites?error=" + encodeURIComponent("Name and domain are both required."));
  }

  // Operators type what they know — "example.com", "https://example.com/pricing".
  // The API wants a hostname, so the URL is unwrapped here rather than rejected,
  // because refusing a pasted URL would be pedantry rather than validation.
  let domain = rawDomain;
  try {
    if (/^https?:\/\//i.test(rawDomain)) domain = new URL(rawDomain).hostname;
  } catch {
    redirect("/dashboard/sites?error=" + encodeURIComponent("That does not look like a domain."));
  }

  const created = await apiSend<WebsiteSummary>("/api/v1/sites", {
    method: "POST",
    body: { name, domain },
  });

  if (!created.ok) {
    redirect("/dashboard/sites?error=" + encodeURIComponent(created.message));
  }

  revalidatePath("/dashboard/sites");
  redirect(`/dashboard/sites?added=${encodeURIComponent(created.data.site_id)}`);
}

async function startScan(formData: FormData) {
  "use server";

  const siteId = String(formData.get("site_id") ?? "").trim();
  const startUrl = String(formData.get("start_url") ?? "").trim();

  if (!siteId || !startUrl) {
    redirect("/dashboard/sites?error=" + encodeURIComponent("A site and a start URL are required."));
  }

  const queued = await apiSend<CreateScanResponse>(`/api/v1/sites/${siteId}/scans`, {
    method: "POST",
    body: { start_url: startUrl },
  });

  if (!queued.ok) {
    // The SSRF guard and the URL validator both answer here, and their messages
    // are written to be read by a person, so they are shown verbatim.
    redirect("/dashboard/sites?error=" + encodeURIComponent(queued.message));
  }

  // Straight to the scan, which is what the operator wants to see next.
  redirect(`/dashboard/scans?site_id=${siteId}&scan_id=${queued.data.scan.scan_id}`);
}

export default async function SitesPage({ searchParams }: PageProps<"/dashboard/sites">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const added = typeof params.added === "string" ? params.added : null;

  const sites = await apiGet<{ sites: WebsiteSummary[] }>("/api/v1/sites");

  return (
    <>
      <PageHeader
        title="Websites"
        description="Register a site, then scan it. A scan is queued here and performed by the crawler worker, which renders the site in a real browser and reports what it found."
      />

      {error ? <ErrorState title="That did not work" message={error} /> : null}

      <Section title="Add a website">
        <p className="hint" style={{ marginTop: 0 }}>
          The domain is what the site serves from. A full URL is fine &mdash; the
          hostname is taken from it.
        </p>
        <form action={addWebsite} className="stack-form">
          <label>
            <span>Name</span>
            <input name="name" type="text" required placeholder="Marketing site" maxLength={200} />
          </label>
          <label>
            <span>Domain</span>
            <input name="domain" type="text" required placeholder="example.com" maxLength={255} />
          </label>
          <button type="submit">Add website</button>
        </form>
      </Section>

      {!sites.ok ? (
        <ErrorState title="Sites could not be loaded" message={sites.message} />
      ) : sites.data.sites.length === 0 ? (
        <EmptyState title="No websites yet" hint="Add one above to get started." />
      ) : (
        <>
          <Section title="Scan a website">
            <p className="hint" style={{ marginTop: 0 }}>
              Enter the page to start from. The crawler stays on the same origin, obeys
              robots.txt, and refuses any URL that resolves into private address space.
              Results appear under Scans once the worker has run.
            </p>
            <form action={startScan} className="stack-form">
              <label>
                <span>Website</span>
                <select name="site_id" required defaultValue={added ?? sites.data.sites[0]?.site_id}>
                  {sites.data.sites.map((site) => (
                    <option key={site.site_id} value={site.site_id}>
                      {site.name} ({site.domain})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Start URL</span>
                <input
                  name="start_url"
                  type="url"
                  required
                  placeholder="https://example.com/"
                  maxLength={2048}
                />
              </label>
              <button type="submit">Start scan</button>
            </form>
            <p className="hint">
              A queued scan waits for the crawler worker. Start it with{" "}
              <code>npm -w @rift-cmp/crawler run worker</code>.
            </p>
          </Section>

          <Section title="Your websites">
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Domain</th>
                    <th scope="col">Status</th>
                    <th scope="col">Public key</th>
                    <th scope="col">Added</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {sites.data.sites.map((site) => (
                    <tr key={site.site_id}>
                      <td>{site.name}</td>
                      <td>{site.domain}</td>
                      <td>
                        <StatusBadge status={site.is_active ? "active" : "inactive"} />
                      </td>
                      {/* Safe to display: the public key ships in page source
                          anyway, and an operator needs it to install the tag. */}
                      <td><code>{site.public_key}</code></td>
                      <td>{formatDateTime(site.created_at)}</td>
                      <td>
                        <a href={`/dashboard/scans?site_id=${site.site_id}`}>Scans</a>
                        {" · "}
                        <a href="/dashboard/integration">Install</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        </>
      )}
    </>
  );
}
