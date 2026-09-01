/**
 * Formatting used across every dashboard screen.
 *
 * Centralised so a count, a timestamp or an identifier looks the same wherever
 * it appears — inconsistent formatting is what makes a set of screens feel like
 * separate tools rather than one product.
 */

/** Thousands separators and tabular digits. `0` stays `0`, never "-" or blank. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

/** Absolute, unambiguous, and identical in every table. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/**
 * Shortens an opaque identifier for display.
 *
 * Dashboards are full of UUIDs that nobody reads in full. The full value stays
 * available as a `title` attribute wherever this is used.
 */
export function shortId(value: string | null | undefined, length = 8): string {
  if (!value) return "—";
  return value.length <= length ? value : `${value.slice(0, length)}…`;
}

/** Trims a URL to its path, which is what a top-pages table is actually about. */
export function displayPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

/** Percentage share of a total, for breakdown tables. Guards divide-by-zero. */
export function formatShare(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
