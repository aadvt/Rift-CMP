/**
 * Resource identity, and what changed between two scans.
 *
 * Phase 8A asks for "a reusable resource identity/fingerprint so recurring scans
 * can determine NEW / REMOVED / CHANGED / UNCHANGED". This is that, and the
 * whole design rests on one distinction:
 *
 *   **identity** — what makes this the *same* resource across scans
 *   **material** — what, if it differs, means the resource has *changed*
 *
 * Getting the split wrong breaks the diff in one of two silent ways. Put too
 * much in the identity and every scan reports everything as `removed` plus
 * `new` — a cookie whose expiry moved becomes a different cookie, and a diff
 * that says a site replaced its entire stack every night is worse than no diff,
 * because someone will stop reading it. Put too little in the material and real
 * changes vanish: a cookie that quietly loses `Secure` is exactly the finding a
 * recurring scan exists to surface, and it must not read as `unchanged`.
 *
 * So identity is deliberately narrow and stable, material is deliberately the
 * security- and privacy-relevant attributes, and both are written out per
 * resource kind below rather than derived from "all fields".
 *
 * ## What is deliberately excluded from both
 *
 * Counts and per-scan volumes. `request_count` rising from 12 to 14 is not a
 * change in what the site *runs*; it is a change in how many pages this crawl
 * happened to reach. Treating it as material would make the diff a function of
 * the crawl budget rather than of the site, and every scan would show churn.
 * The same applies to `observed_on` — which page a script was first seen on
 * depends on crawl order.
 *
 * Research artifact, not legal advice. See docs/crawler.md.
 */

import type {
  ScanCookieContract,
  ScanRequestContract,
  ScanScriptContract,
  ScanStorageContract,
  ScanTechnologyContract,
} from "@rift-cmp/shared";

/** How a resource compares to the previous scan. */
export type ChangeStatus = "new" | "removed" | "changed" | "unchanged";

/** The kinds of resource a scan diff covers. */
export type DiffResourceKind =
  | "cookie"
  | "script"
  | "request"
  | "storage"
  | "technology";

/**
 * A stable identity for one observed resource.
 *
 * `kind` is part of the string so identities from different tables can share one
 * namespace without colliding — a cookie named `_ga` and a storage key named
 * `_ga` are different resources that would otherwise fingerprint alike.
 */
export type Fingerprint = string;

export interface DiffEntry {
  readonly kind: DiffResourceKind;
  readonly fingerprint: Fingerprint;
  readonly status: ChangeStatus;
  /** A short human label, so a UI need not re-derive one from the fingerprint. */
  readonly label: string;
  /** Field names whose material value differs. Empty unless `status` is `changed`. */
  readonly changedFields: readonly string[];
  /** Material values before and after, for the fields that differ. */
  readonly before?: Readonly<Record<string, unknown>>;
  readonly after?: Readonly<Record<string, unknown>>;
}

export interface ScanDiffCounts {
  readonly new: number;
  readonly removed: number;
  readonly changed: number;
  readonly unchanged: number;
}

export interface ScanDiff {
  readonly entries: readonly DiffEntry[];
  readonly totals: ScanDiffCounts;
  readonly byKind: Readonly<Record<DiffResourceKind, ScanDiffCounts>>;
  readonly legalAdvice: false;
}

/** The five resource collections a diff is computed over. */
export interface DiffableScan {
  readonly cookies?: readonly ScanCookieContract[];
  readonly scripts?: readonly ScanScriptContract[];
  readonly requests?: readonly ScanRequestContract[];
  readonly storage?: readonly ScanStorageContract[];
  readonly technologies?: readonly ScanTechnologyContract[];
}

// ─── Identity and material, per resource kind ────────────────────────────────

/** Lower-case and trim, so casing noise never reads as a change. */
function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

interface Descriptor<T> {
  readonly kind: DiffResourceKind;
  /** What makes this the same resource across scans. */
  identity: (item: T) => string;
  /** What, if different, means it changed. */
  material: (item: T) => Record<string, unknown>;
  label: (item: T) => string;
}

/**
 * A cookie is identified by name + domain + path — the tuple a browser itself
 * uses to decide whether a `Set-Cookie` replaces an existing cookie or creates
 * a second one. Expiry is material rather than identity: a session cookie
 * becoming a two-year persistent cookie is the same cookie behaving differently,
 * and it is precisely the change worth reporting.
 */
const COOKIE: Descriptor<ScanCookieContract> = {
  kind: "cookie",
  identity: (c) => `${norm(c.name)}|${norm(c.domain)}|${norm(c.path) || "/"}`,
  material: (c) => ({
    secure: c.secure,
    http_only: c.http_only,
    same_site: norm(c.same_site) || null,
    third_party: c.third_party,
    // Persistence, not the exact timestamp: an expiry that slides forward by a
    // day on every scan is the same policy, and diffing the instant would
    // report a change every single night.
    persistent: c.expires !== null,
  }),
  label: (c) => `${c.name} (${c.domain}${c.path})`,
};

/**
 * A script is identified by its URL, which the crawler has already stripped of
 * its query string. Inline scripts have no URL and are deliberately **not**
 * diffable: they are counted, not captured, so there is nothing stable to
 * identify one by and pretending otherwise would invent churn.
 */
const SCRIPT: Descriptor<ScanScriptContract> = {
  kind: "script",
  identity: (s) => norm(s.url ?? `inline@${s.host ?? "unknown"}`),
  material: (s) => ({ third_party: s.third_party, host: norm(s.host) }),
  label: (s) => s.url ?? `inline script on ${s.host ?? "unknown"}`,
};

/**
 * Requests are already aggregated per (host, resource_type, method), so that
 * tuple is the identity. Counts are excluded from material — see the file
 * header; they track crawl budget, not the site.
 */
const REQUEST: Descriptor<ScanRequestContract> = {
  kind: "request",
  identity: (r) => `${norm(r.host)}|${norm(r.resource_type)}|${norm(r.method)}`,
  material: (r) => ({ third_party: r.third_party }),
  label: (r) => `${r.method} ${r.host} (${r.resource_type})`,
};

const STORAGE: Descriptor<ScanStorageContract> = {
  kind: "storage",
  identity: (s) => `${norm(s.kind)}|${norm(s.origin)}|${norm(s.name)}`,
  material: () => ({}),
  label: (s) => `${s.kind}: ${s.name}`,
};

/**
 * A technology is identified by its detector, not its name — a catalogue entry
 * can be renamed without becoming a different vendor.
 *
 * Confidence is material, and that is the point of including it: a vendor that
 * drops from `high` to `low` between scans has usually not gone away, it has
 * stopped being identifiable, and an operator should see that rather than a
 * silent `unchanged`. Evidence is not material — it is the working, and it
 * varies with which pages the crawl reached.
 */
const TECHNOLOGY: Descriptor<ScanTechnologyContract> = {
  kind: "technology",
  identity: (t) => norm(t.detector_id),
  material: (t) => ({
    category: norm(t.category),
    confidence: t.confidence,
    crosses_border: t.crosses_border,
    destination_country: norm(t.destination_country) || null,
  }),
  label: (t) => t.name,
};

/** `kind:identity`, so one namespace covers every table without collisions. */
export function fingerprint<T>(descriptor: Descriptor<T>, item: T): Fingerprint {
  return `${descriptor.kind}:${descriptor.identity(item)}`;
}

/** The fingerprint of a cookie, as the diff computes it. Exported for callers. */
export const fingerprintCookie = (c: ScanCookieContract) => fingerprint(COOKIE, c);
export const fingerprintScript = (s: ScanScriptContract) => fingerprint(SCRIPT, s);
export const fingerprintRequest = (r: ScanRequestContract) => fingerprint(REQUEST, r);
export const fingerprintStorage = (s: ScanStorageContract) => fingerprint(STORAGE, s);
export const fingerprintTechnology = (t: ScanTechnologyContract) =>
  fingerprint(TECHNOLOGY, t);

// ─── The diff ────────────────────────────────────────────────────────────────

const EMPTY_COUNTS: ScanDiffCounts = { new: 0, removed: 0, changed: 0, unchanged: 0 };

function diffCollection<T>(
  descriptor: Descriptor<T>,
  before: readonly T[],
  after: readonly T[],
): DiffEntry[] {
  // Later duplicates lose. The crawler already deduplicates, so a collision
  // here means two rows share an identity, and keeping the first is stable.
  const index = (items: readonly T[]) => {
    const map = new Map<string, T>();
    for (const item of items) {
      const key = fingerprint(descriptor, item);
      if (!map.has(key)) map.set(key, item);
    }
    return map;
  };

  const previous = index(before);
  const current = index(after);
  const entries: DiffEntry[] = [];

  for (const [key, item] of current) {
    const old = previous.get(key);
    if (old === undefined) {
      entries.push({
        kind: descriptor.kind,
        fingerprint: key,
        status: "new",
        label: descriptor.label(item),
        changedFields: [],
        after: descriptor.material(item),
      });
      continue;
    }

    const oldMaterial = descriptor.material(old);
    const newMaterial = descriptor.material(item);
    const changedFields = Object.keys(newMaterial)
      .filter((field) => !Object.is(oldMaterial[field], newMaterial[field]))
      .sort();

    entries.push(
      changedFields.length === 0
        ? {
            kind: descriptor.kind,
            fingerprint: key,
            status: "unchanged",
            label: descriptor.label(item),
            changedFields: [],
          }
        : {
            kind: descriptor.kind,
            fingerprint: key,
            status: "changed",
            label: descriptor.label(item),
            changedFields,
            before: Object.fromEntries(changedFields.map((f) => [f, oldMaterial[f]])),
            after: Object.fromEntries(changedFields.map((f) => [f, newMaterial[f]])),
          },
    );
  }

  for (const [key, item] of previous) {
    if (current.has(key)) continue;
    entries.push({
      kind: descriptor.kind,
      fingerprint: key,
      status: "removed",
      label: descriptor.label(item),
      changedFields: [],
      before: descriptor.material(item),
    });
  }

  return entries;
}

function tally(entries: readonly DiffEntry[]): ScanDiffCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const entry of entries) counts[entry.status] += 1;
  return counts;
}

/**
 * Compare two scans of the same site.
 *
 * Pure and order-independent: the result depends only on the two sets of
 * observations, never on the order they were produced in or the order of the
 * arguments beyond which one is `before`.
 *
 * A missing collection is treated as empty, which is correct for a scan that
 * genuinely observed nothing — but note the consequence, because it is a real
 * trap: **diffing against a failed scan reports everything as `new`.** A caller
 * comparing recurring scans should compare against the last *completed* one, and
 * `docs/scan-api.md` says so at the endpoint that exposes this.
 */
export function diffScans(before: DiffableScan, after: DiffableScan): ScanDiff {
  const entries = [
    ...diffCollection(COOKIE, before.cookies ?? [], after.cookies ?? []),
    ...diffCollection(SCRIPT, before.scripts ?? [], after.scripts ?? []),
    ...diffCollection(REQUEST, before.requests ?? [], after.requests ?? []),
    ...diffCollection(STORAGE, before.storage ?? [], after.storage ?? []),
    ...diffCollection(TECHNOLOGY, before.technologies ?? [], after.technologies ?? []),
  ];

  // Deterministic order: most interesting first, then by fingerprint. A diff a
  // human reads should not reorder itself between two identical runs.
  const rank: Record<ChangeStatus, number> = {
    new: 0,
    changed: 1,
    removed: 2,
    unchanged: 3,
  };
  entries.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0),
  );

  const byKind = {} as Record<DiffResourceKind, ScanDiffCounts>;
  for (const kind of [
    "cookie",
    "script",
    "request",
    "storage",
    "technology",
  ] as const) {
    byKind[kind] = tally(entries.filter((e) => e.kind === kind));
  }

  return { entries, totals: tally(entries), byKind, legalAdvice: false };
}
