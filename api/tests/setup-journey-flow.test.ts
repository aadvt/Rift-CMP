/**
 * The customer journey, walked through the contracts the frontend actually calls.
 *
 * The setup screen is a composition of API calls: create a site, start a scan,
 * read the generated policy, approve it, produce a snippet, look for evidence
 * that data arrived. This test walks that sequence against the real routes and
 * a real database, so the page's assumptions about each contract are checked
 * rather than assumed.
 *
 * ## What this deliberately does not do
 *
 * It does not run a crawl. A scan launches a real browser against a real
 * website, and a test that waited for one would be slow and would fail for
 * reasons that have nothing to do with the journey. Scan *rendering* is covered
 * by the crawler's own browser suite; what matters here is that the journey
 * reads the scan's lifecycle correctly, including the states the frontend has
 * to handle and cannot produce on demand.
 *
 * It also does not assert on an installation-verification endpoint, because
 * there is not one. The journey's Verify step reports whether ingestion has
 * seen the site, and that is what is checked.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { GET as listSites, POST as createSite } from "@/app/api/v1/sites/route";
import { POST as startScan, GET as listScans } from "@/app/api/v1/sites/[siteId]/scans/route";
import {
  GET as getConsentPolicy,
  POST as approveConsentPolicy,
} from "@/app/api/v1/sites/[siteId]/consent-policy/route";
import {
  GET as listOverrides,
  POST as setOverride,
  DELETE as clearOverride,
} from "@/app/api/v1/sites/[siteId]/consent-policy/overrides/route";
import { GET as analyticsSummary } from "@/app/api/v1/analytics/summary/route";
import { buildInstallSnippet } from "@/lib/install-snippet";
import { createOwnershipTree, managementRequest, resetDatabase, siteParams } from "./helpers/fixtures";

const ORIGIN = "https://app.example.com";

let secretKey: string;

beforeEach(async () => {
  await resetDatabase();
  const tree = await createOwnershipTree({ prefix: "journey-" });
  secretKey = tree.orgA.secretKey;
});

describe("step 1: entering a website", () => {
  it("turns an address into a site with a public key that can ship to browsers", async () => {
    const response = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );

    expect(response.status).toBe(201);
    const site = await response.json();

    expect(site.site_id).toBeTruthy();
    // The setup screen puts this key straight into a snippet on somebody's
    // page, so the prefix matters: a secret key here would be a disclosure.
    expect(site.public_key.startsWith("pk_")).toBe(true);
    expect(site.public_key.startsWith("sk_")).toBe(false);
  });

  it("makes the new site visible to the screen that lists them", async () => {
    await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );

    const listed = await listSites(managementRequest("/api/v1/sites", { key: secretKey }));
    const { sites } = await listed.json();

    expect(sites.some((s: { domain: string }) => s.domain === "example.com")).toBe(true);
  });
});

describe("step 2: the scan lifecycle the journey renders", () => {
  it("queues a scan and reports it as queued, which is the first state on screen", async () => {
    const created = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );
    const site = await created.json();

    const started = await startScan(
      managementRequest(`/api/v1/sites/${site.site_id}/scans`, {
        key: secretKey,
        method: "POST",
        body: { start_url: "https://example.com" },
      }),
      siteParams(site.site_id),
    );

    expect(started.status).toBe(202);
    const { scan } = await started.json();
    expect(scan.status).toBe("queued");

    // The journey derives its step from the newest scan, so the list has to
    // return it immediately rather than once a worker picks it up.
    const listed = await listScans(
      managementRequest(`/api/v1/sites/${site.site_id}/scans`, {
        key: secretKey,
        query: { limit: "5" },
      }),
      siteParams(site.site_id),
    );
    const { scans } = await listed.json();
    expect(scans[0].scan_id).toBe(scan.scan_id);
    expect(scans[0].summary).toBeTruthy();
  });
});

describe("steps 3 and 4: the generated configuration and accepting it", () => {
  async function siteWithPolicy() {
    const created = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );
    const site = await created.json();

    const policyResponse = await getConsentPolicy(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy`, {
        key: secretKey,
        query: { market: "DE" },
      }),
      siteParams(site.site_id),
    );

    return { site, policyResponse };
  }

  it("generates a policy without anybody having configured one", async () => {
    const { policyResponse } = await siteWithPolicy();

    expect(policyResponse.status).toBe(200);
    const body = await policyResponse.json();

    // The point of the phase: a configuration exists to be accepted, rather
    // than a blank form to be filled in.
    expect(body.policy).toBeTruthy();
    expect(Array.isArray(body.policy.recommendations)).toBe(true);
    expect(body.policy.requires_approval).toBe(true);
    // Nothing is live until a person approves it.
    expect(body.active_version).toBeNull();
  });

  it("never returns a recommendation that silently permits", async () => {
    const { policyResponse } = await siteWithPolicy();
    const body = await policyResponse.json();

    // "Absence never permits": a line the engine could not decide must come
    // back as review, never as allow. The setup screen groups on this, so an
    // undecided vendor showing up as "No consent gate" would be a false
    // reassurance rendered in the primary summary.
    for (const r of body.policy.recommendations) {
      if (r.confidence === "low" && !r.overridden) {
        expect(r.recommended_action).not.toBe("allow");
      }
    }
  });

  it("approves exactly the recommendations that were reviewed", async () => {
    const { site, policyResponse } = await siteWithPolicy();
    const { policy } = await policyResponse.json();

    const approved = await approveConsentPolicy(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy`, {
        key: secretKey,
        method: "POST",
        body: {
          recommendations: policy.recommendations,
          jurisdictions: policy.jurisdictions,
          regimes: policy.regimes,
          scan_id: policy.scan_id,
          approval_note: "Accepted from the setup journey.",
        },
      }),
      siteParams(site.site_id),
    );

    expect(approved.status).toBe(201);
    const { version } = await approved.json();
    expect(version.status).toBe("approved");
    expect(version.version).toBe(1);

    // The journey moves to Install the moment a version is active, so the very
    // next read has to show it.
    const after = await getConsentPolicy(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy`, { key: secretKey }),
      siteParams(site.site_id),
    );
    const { active_version } = await after.json();
    expect(active_version?.policy_version_id).toBe(version.policy_version_id);
  });
});

describe("human review: a company decision, kept distinct from Rift's", () => {
  it("records an override and hands it back marked as the operator's", async () => {
    const created = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );
    const site = await created.json();

    const saved = await setOverride(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy/overrides`, {
        key: secretKey,
        method: "POST",
        body: { detector_id: "unknown-tracker", action: "require_consent", note: "Asked the vendor." },
      }),
      siteParams(site.site_id),
    );
    expect(saved.status).toBeLessThan(300);

    const listed = await listOverrides(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy/overrides`, {
        key: secretKey,
      }),
      siteParams(site.site_id),
    );
    const { overrides } = await listed.json();

    const mine = overrides.find((o: { detector_id: string }) => o.detector_id === "unknown-tracker");
    expect(mine).toBeTruthy();
    expect(mine.action).toBe("require_consent");
  });

  it("lets the operator hand the decision back to Rift", async () => {
    const created = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );
    const site = await created.json();

    await setOverride(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy/overrides`, {
        key: secretKey,
        method: "POST",
        body: { detector_id: "unknown-tracker", action: "block" },
      }),
      siteParams(site.site_id),
    );

    await clearOverride(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy/overrides`, {
        key: secretKey,
        method: "DELETE",
        query: { detector_id: "unknown-tracker" },
      }),
      siteParams(site.site_id),
    );

    const listed = await listOverrides(
      managementRequest(`/api/v1/sites/${site.site_id}/consent-policy/overrides`, {
        key: secretKey,
      }),
      siteParams(site.site_id),
    );
    const { overrides } = await listed.json();

    expect(
      overrides.some((o: { detector_id: string }) => o.detector_id === "unknown-tracker"),
    ).toBe(false);
  });
});

describe("step 5: the one snippet", () => {
  it("carries the site and its public key, and no secret", async () => {
    const created = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );
    const site = await created.json();

    const snippet = buildInstallSnippet({
      siteId: site.site_id,
      publicKey: site.public_key,
      origin: ORIGIN,
      withBanner: true,
    });

    expect(snippet).toContain(site.site_id);
    expect(snippet).toContain(site.public_key);
    // One snippet, not one per capability: consent, tracking and analytics all
    // come from the same script tag.
    expect(snippet.match(/<script/g)?.length).toBe(2);
    expect(snippet).not.toContain(secretKey);
    expect(snippet).not.toContain("sk_");
  });
});

describe("verification, reported only from evidence that exists", () => {
  it("shows no activity for a site nobody has visited", async () => {
    const created = await createSite(
      managementRequest("/api/v1/sites", {
        key: secretKey,
        method: "POST",
        body: { name: "example.com", domain: "example.com" },
      }),
    );
    const site = await created.json();

    const response = await analyticsSummary(
      managementRequest("/api/v1/analytics/summary", {
        key: secretKey,
        query: { site_id: site.site_id },
      }),
    );

    expect(response.status).toBe(200);
    const summary = await response.json();

    // This zero is what the Verify step renders as "waiting", and it is the
    // only signal available: there is no endpoint that fetches the site and
    // confirms the script is on the page. The screen says so rather than
    // presenting this as a failed check.
    expect(summary.totals.total_events).toBe(0);
  });
});
