import type { ReactNode } from "react";
import type { WebsiteSummary } from "@rift-cmp/shared";

/**
 * Filters are a plain GET form.
 *
 * Submitting navigates to the same route with the values in the query string,
 * which every page already reads from `searchParams`. That keeps a filtered view
 * linkable and back-button-able, and keeps these pages server components: there
 * is no client-side form state to hold.
 */

export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form className="filters" method="get" action={action}>
      {children}
      <button type="submit" className="primary">
        Apply
      </button>
    </form>
  );
}

export function SiteFilter({
  sites,
  value,
}: {
  sites: readonly WebsiteSummary[];
  value?: string;
}) {
  return (
    <div>
      <label htmlFor="site_id">Site</label>
      <select id="site_id" name="site_id" defaultValue={value ?? ""}>
        <option value="">All sites</option>
        {sites.map((site) => (
          <option key={site.site_id} value={site.site_id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextFilter({
  name,
  label,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="text" defaultValue={value ?? ""} placeholder={placeholder} autoComplete="off" />
    </div>
  );
}

export function DateFilter({ name, label, value }: { name: string; label: string; value?: string }) {
  return (
    <div>
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="date" defaultValue={value ?? ""} />
    </div>
  );
}

/**
 * One filter value out of `searchParams`.
 *
 * A repeated query parameter arrives as an array; the first value wins rather
 * than the page erroring, and blank means "no filter" rather than an empty
 * string being forwarded to the API.
 */
export function readFilter(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params[key];
  const single = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

/** Builds a query string from filters, omitting the ones that are not set. */
export function buildQuery(entries: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}
