/**
 * Resource fingerprints and the recurring-scan diff.
 *
 * Phase 8A asks for "a reusable resource identity/fingerprint so recurring scans
 * can determine NEW / REMOVED / CHANGED / UNCHANGED", and names "recurring scan
 * diff" as a required scenario.
 *
 * The tests that matter most here are the two failure modes on either side of
 * the identity/material split, because both are silent:
 *
 *   - identity too wide  → everything reports removed + new on every scan
 *   - material too narrow → a real regression reports unchanged
 *
 * No database, no browser.
 */

import { describe, expect, it } from "vitest";
import {
  diffScans,
  fingerprintCookie,
  fingerprintRequest,
  fingerprintScript,
  fingerprintStorage,
  fingerprintTechnology,
  type DiffableScan,
} from "@rift-cmp/crawler";
import type {
  ScanCookieContract,
  ScanRequestContract,
  ScanScriptContract,
  ScanStorageContract,
  ScanTechnologyContract,
} from "@rift-cmp/shared";

function cookie(over: Partial<ScanCookieContract> = {}): ScanCookieContract {
  return {
    name: "_ga",
    domain: ".example.com",
    path: "/",
    expires: "2027-01-01T00:00:00.000Z",
    secure: true,
    http_only: false,
    same_site: "Lax",
    third_party: true,
    ...over,
  };
}

function script(over: Partial<ScanScriptContract> = {}): ScanScriptContract {
  return {
    url: "https://www.googletagmanager.com/gtag/js",
    host: "www.googletagmanager.com",
    inline: false,
    third_party: true,
    observed_on: "https://example.com/",
    ...over,
  };
}

function request(over: Partial<ScanRequestContract> = {}): ScanRequestContract {
  return {
    host: "www.google-analytics.com",
    resource_type: "script",
    method: "GET",
    sample_path: "/collect",
    third_party: true,
    request_count: 3,
    failed_count: 0,
    status: 200,
    ...over,
  };
}

function storage(over: Partial<ScanStorageContract> = {}): ScanStorageContract {
  return {
    kind: "local_storage",
    name: "_hjSession",
    origin: "https://example.com",
    ...over,
  };
}

function technology(
  over: Partial<ScanTechnologyContract> = {},
): ScanTechnologyContract {
  return {
    detector_id: "google-analytics",
    name: "Google Analytics",
    category: "analytics",
    confidence: "high",
    evidence: [{ type: "script", value: "https://www.googletagmanager.com/gtag/js" }],
    destination_country: "US",
    crosses_border: true,
    ...over,
  };
}

const FULL: DiffableScan = {
  cookies: [cookie()],
  scripts: [script()],
  requests: [request()],
  storage: [storage()],
  technologies: [technology()],
};

// ─── The four statuses ───────────────────────────────────────────────────────

describe("NEW, REMOVED, CHANGED, UNCHANGED", () => {
  it("reports an identical scan as entirely unchanged", () => {
    const diff = diffScans(FULL, FULL);
    expect(diff.totals).toEqual({ new: 0, removed: 0, changed: 0, unchanged: 5 });
    expect(diff.entries.every((e) => e.status === "unchanged")).toBe(true);
  });

  it("reports a resource only in the later scan as new", () => {
    const diff = diffScans({ cookies: [] }, { cookies: [cookie()] });
    expect(diff.totals.new).toBe(1);
    expect(diff.entries[0].status).toBe("new");
    expect(diff.entries[0].label).toContain("_ga");
  });

  it("reports a resource only in the earlier scan as removed", () => {
    const diff = diffScans({ cookies: [cookie()] }, { cookies: [] });
    expect(diff.totals.removed).toBe(1);
    expect(diff.entries[0].status).toBe("removed");
  });

  it("reports a material difference as changed, naming the fields", () => {
    const diff = diffScans(
      { cookies: [cookie({ secure: true })] },
      { cookies: [cookie({ secure: false })] },
    );
    expect(diff.totals).toEqual({ new: 0, removed: 0, changed: 1, unchanged: 0 });
    expect(diff.entries[0].changedFields).toEqual(["secure"]);
    expect(diff.entries[0].before).toEqual({ secure: true });
    expect(diff.entries[0].after).toEqual({ secure: false });
  });

  it("counts every kind separately as well as in total", () => {
    const diff = diffScans({}, FULL);
    expect(diff.totals.new).toBe(5);
    expect(diff.byKind.cookie.new).toBe(1);
    expect(diff.byKind.script.new).toBe(1);
    expect(diff.byKind.request.new).toBe(1);
    expect(diff.byKind.storage.new).toBe(1);
    expect(diff.byKind.technology.new).toBe(1);
  });
});

// ─── Identity too wide: churn ────────────────────────────────────────────────

describe("identity is narrow enough not to manufacture churn", () => {
  /**
   * The first silent failure. If identity included the expiry, a cookie whose
   * expiry slides forward each night would report `removed` + `new` on every
   * scan, and a diff that claims the site replaced its stack nightly is one
   * nobody will keep reading.
   */
  it("treats a cookie with a later expiry as the same cookie", () => {
    const diff = diffScans(
      { cookies: [cookie({ expires: "2027-01-01T00:00:00.000Z" })] },
      { cookies: [cookie({ expires: "2028-06-01T00:00:00.000Z" })] },
    );
    expect(diff.totals).toEqual({ new: 0, removed: 0, changed: 0, unchanged: 1 });
  });

  it("does not treat a changed request count as a change to the site", () => {
    // Counts track how many pages this crawl reached, not what the site runs.
    const diff = diffScans(
      { requests: [request({ request_count: 3 })] },
      { requests: [request({ request_count: 41, failed_count: 2 })] },
    );
    expect(diff.totals.unchanged).toBe(1);
  });

  it("does not treat the page a script was first seen on as a change", () => {
    const diff = diffScans(
      { scripts: [script({ observed_on: "https://example.com/" })] },
      { scripts: [script({ observed_on: "https://example.com/pricing" })] },
    );
    expect(diff.totals.unchanged).toBe(1);
  });

  it("does not treat differing evidence as a change to a technology", () => {
    const diff = diffScans(
      { technologies: [technology({ evidence: [{ type: "script", value: "a" }] })] },
      { technologies: [technology({ evidence: [{ type: "cookie", value: "_ga" }] })] },
    );
    expect(diff.totals.unchanged).toBe(1);
  });

  it("ignores casing and surrounding whitespace in identity", () => {
    const diff = diffScans(
      { cookies: [cookie({ name: "_GA", domain: ".Example.com" })] },
      { cookies: [cookie({ name: "_ga", domain: " .example.com " })] },
    );
    expect(diff.totals.unchanged).toBe(1);
  });

  it("identifies a technology by detector rather than display name", () => {
    // A catalogue entry can be renamed without the vendor having changed.
    const diff = diffScans(
      { technologies: [technology({ name: "Google Analytics" })] },
      { technologies: [technology({ name: "Google Analytics 4" })] },
    );
    expect(diff.totals.unchanged).toBe(1);
  });
});

// ─── Material wide enough: real regressions surface ──────────────────────────

describe("material is wide enough to catch a real regression", () => {
  /**
   * The second silent failure, and the more dangerous one. These are precisely
   * the findings a recurring scan exists to produce; reporting them as
   * `unchanged` would make the feature actively misleading.
   */
  it("catches a cookie quietly losing Secure", () => {
    const diff = diffScans(
      { cookies: [cookie({ secure: true })] },
      { cookies: [cookie({ secure: false })] },
    );
    expect(diff.entries[0].status).toBe("changed");
  });

  it("catches a cookie quietly losing HttpOnly", () => {
    const diff = diffScans(
      { cookies: [cookie({ http_only: true })] },
      { cookies: [cookie({ http_only: false })] },
    );
    expect(diff.entries[0].changedFields).toContain("http_only");
  });

  it("catches SameSite being weakened", () => {
    const diff = diffScans(
      { cookies: [cookie({ same_site: "Strict" })] },
      { cookies: [cookie({ same_site: "None" })] },
    );
    expect(diff.entries[0].changedFields).toContain("same_site");
  });

  it("catches a session cookie becoming persistent", () => {
    const diff = diffScans(
      { cookies: [cookie({ expires: null })] },
      { cookies: [cookie({ expires: "2030-01-01T00:00:00.000Z" })] },
    );
    expect(diff.entries[0].changedFields).toEqual(["persistent"]);
  });

  it("catches a technology that stopped being identifiable", () => {
    // Usually means detection degraded, not that the vendor left - and an
    // operator needs to see that rather than a silent `unchanged`.
    const diff = diffScans(
      { technologies: [technology({ confidence: "high" })] },
      { technologies: [technology({ confidence: "low" })] },
    );
    expect(diff.entries[0].changedFields).toEqual(["confidence"]);
  });

  it("catches a destination that started crossing a border", () => {
    const diff = diffScans(
      {
        technologies: [
          technology({ crosses_border: false, destination_country: "DE" }),
        ],
      },
      {
        technologies: [
          technology({ crosses_border: true, destination_country: "US" }),
        ],
      },
    );
    expect(diff.entries[0].changedFields).toEqual([
      "crosses_border",
      "destination_country",
    ]);
  });

  it("catches a first-party resource becoming third-party", () => {
    const diff = diffScans(
      { requests: [request({ third_party: false })] },
      { requests: [request({ third_party: true })] },
    );
    expect(diff.entries[0].changedFields).toEqual(["third_party"]);
  });
});

// ─── Fingerprints ────────────────────────────────────────────────────────────

describe("fingerprints", () => {
  it("are stable across calls", () => {
    expect(fingerprintCookie(cookie())).toBe(fingerprintCookie(cookie()));
  });

  it("namespace by kind, so a cookie and a storage key cannot collide", () => {
    const name = "shared_name";
    const c = fingerprintCookie(cookie({ name, domain: "example.com", path: "/" }));
    const s = fingerprintStorage(
      storage({ name, kind: "cookie", origin: "example.com" }),
    );
    expect(c).not.toBe(s);
    expect(c.startsWith("cookie:")).toBe(true);
    expect(s.startsWith("storage:")).toBe(true);
  });

  it("separate two cookies that differ only by domain", () => {
    expect(fingerprintCookie(cookie({ domain: "a.example.com" }))).not.toBe(
      fingerprintCookie(cookie({ domain: "b.example.com" })),
    );
  });

  it("separate two requests that differ only by method", () => {
    expect(fingerprintRequest(request({ method: "GET" }))).not.toBe(
      fingerprintRequest(request({ method: "POST" })),
    );
  });

  it("separate two scripts on different hosts", () => {
    expect(fingerprintScript(script({ url: "https://a.test/x.js" }))).not.toBe(
      fingerprintScript(script({ url: "https://b.test/x.js" })),
    );
  });

  it("give an inline script a stable identity without inventing a URL", () => {
    const inline = script({ url: null, inline: true, host: "example.com" });
    expect(fingerprintScript(inline)).toBe(fingerprintScript(inline));
    expect(fingerprintScript(inline)).toContain("inline@example.com");
  });

  it("identify a technology by detector id", () => {
    expect(fingerprintTechnology(technology())).toContain("google-analytics");
  });
});

// ─── Determinism and shape ───────────────────────────────────────────────────

describe("the diff is deterministic and safe to store", () => {
  it("does not depend on the order resources are listed in", () => {
    const a: DiffableScan = { cookies: [cookie({ name: "a" }), cookie({ name: "b" })] };
    const b: DiffableScan = { cookies: [cookie({ name: "b" }), cookie({ name: "a" })] };
    expect(JSON.stringify(diffScans({}, a))).toBe(JSON.stringify(diffScans({}, b)));
  });

  it("orders entries most interesting first", () => {
    const diff = diffScans(
      { cookies: [cookie({ name: "gone" }), cookie({ name: "same" })] },
      {
        cookies: [
          cookie({ name: "same" }),
          cookie({ name: "fresh" }),
          cookie({ name: "moved", secure: false }),
        ],
      },
    );
    const order = diff.entries.map((e) => e.status);
    const rank = { new: 0, changed: 1, removed: 2, unchanged: 3 } as const;
    expect(order.map((s) => rank[s])).toEqual([...order.map((s) => rank[s])].sort());
  });

  it("survives a scan with no collections at all", () => {
    const diff = diffScans({}, {});
    expect(diff.totals).toEqual({ new: 0, removed: 0, changed: 0, unchanged: 0 });
    expect(diff.entries).toEqual([]);
  });

  it("treats a duplicated resource as one, so a crawler bug cannot inflate it", () => {
    const diff = diffScans({}, { cookies: [cookie(), cookie(), cookie()] });
    expect(diff.totals.new).toBe(1);
  });

  it("round-trips through JSON", () => {
    const diff = diffScans({ cookies: [cookie({ secure: true })] }, FULL);
    const round = JSON.parse(JSON.stringify(diff)) as typeof diff;
    expect(round.entries.length).toBe(diff.entries.length);
    expect(round.totals).toEqual(diff.totals);
  });

  it("carries no legal determination", () => {
    const diff = diffScans({}, FULL);
    expect(diff.legalAdvice).toBe(false);
    const text = JSON.stringify(diff).toLowerCase();
    for (const word of ["lawful", "compliant", "consent_required", "violation"]) {
      expect(text).not.toContain(word);
    }
  });

  it("reports everything as new when the earlier scan observed nothing", () => {
    // The documented trap: diffing against a failed scan is not a finding that
    // the site changed. Asserted so the behaviour is pinned and explainable.
    const diff = diffScans({}, FULL);
    expect(diff.totals.new).toBe(5);
    expect(diff.totals.removed).toBe(0);
  });
});
