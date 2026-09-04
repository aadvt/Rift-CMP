"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type {
  ConsentPolicyVersionSummary,
  CreateScanResponse,
  RecommendedPolicyResponse,
  WebsiteSummary,
} from "@rift-cmp/shared";
import { apiGet, apiSend } from "@/lib/dashboard/api";

/**
 * Every mutation the onboarding journey performs.
 *
 * All of them go through `apiSend`, which is to say through the same public
 * `/api/v1` surface an external integrator would use, carrying the caller's own
 * organisation key. None of them reach past it: no Prisma, no crawler
 * internals, no policy evaluation. If one of these needed a capability the API
 * does not expose, the right move is to say so rather than to reach around the
 * boundary, because the boundary is where tenant isolation is enforced.
 */

const BASE = "/dashboard/onboarding";

/** Returns to the journey carrying a message the page can render. */
function back(params: Record<string, string | undefined>): never {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join("&");
  redirect(query ? `${BASE}?${query}` : BASE);
}

/**
 * Step 1. Turn a URL into a site.
 *
 * The operator types a website; everything else about the site record is
 * derived here rather than asked for, because Phase 11's first screen is one
 * field and a button. The name defaults to the hostname and stays editable
 * later under Websites.
 */
export async function createSiteFromUrl(formData: FormData) {
  const raw = String(formData.get("website_url") ?? "").trim();
  if (!raw) back({ error: "Enter your website address." });

  // Accept "example.com" as readily as "https://example.com/pricing".
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    back({ error: `"${raw}" does not look like a website address.` });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    back({ error: "Only http and https websites can be scanned." });
  }

  const created = await apiSend<WebsiteSummary>("/api/v1/sites", {
    method: "POST",
    body: { name: url.hostname, domain: url.hostname },
  });

  if (!created.ok) back({ error: created.message });

  revalidatePath(BASE);
  // Straight into the scan: the operator asked for their site to be looked at,
  // not for a site record to exist.
  return startScan(created.data.site_id, url.toString());
}

/**
 * Step 2. Ask the crawler to look at the site.
 *
 * The scan's lifecycle belongs to the API and the database. This only starts
 * one and hands back; nothing here tracks or mirrors its progress.
 */
export async function startScan(siteId: string, startUrl: string) {
  const started = await apiSend<CreateScanResponse>(`/api/v1/sites/${siteId}/scans`, {
    method: "POST",
    body: { start_url: startUrl },
  });

  if (!started.ok) back({ site_id: siteId, error: started.message });

  revalidatePath(BASE);
  back({ site_id: siteId });
}

/**
 * Step 2, restarted by hand — after a failure, to pick up site changes, or to
 * point the crawler somewhere else entirely.
 *
 * The URL is normalised the same way the first-run entry field normalises it,
 * so an operator can type `shop.example.com` without being told off about a
 * missing scheme. Whether the target is actually reachable, and whether it is
 * somewhere the crawler is allowed to go, are decided server-side: `POST /scans`
 * validates the shape and the SSRF guard resolves the host and refuses private
 * and loopback space. Nothing here is a security check.
 */
export async function rescan(formData: FormData) {
  const siteId = String(formData.get("site_id") ?? "");
  const raw = String(formData.get("start_url") ?? "").trim();

  if (!siteId || !raw) back({ site_id: siteId, error: "Enter the page you want scanned." });

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    back({ site_id: siteId, error: `"${raw}" does not look like a web address.` });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    back({ site_id: siteId, error: "Only http and https pages can be scanned." });
  }

  return startScan(siteId, url.toString());
}

/** Step 2, abandoned. Cancellation is cooperative and only valid before the end. */
export async function cancelScan(formData: FormData) {
  const siteId = String(formData.get("site_id") ?? "");
  const scanId = String(formData.get("scan_id") ?? "");

  const cancelled = await apiSend(`/api/v1/scans/${scanId}`, { method: "DELETE" });
  if (!cancelled.ok) back({ site_id: siteId, error: cancelled.message });

  revalidatePath(BASE);
  back({ site_id: siteId });
}

/**
 * Step 3. Accept the configuration Rift generated.
 *
 * The API deliberately does not re-derive the recommendations at approval time:
 * the body must carry the exact lines the operator reviewed, so that what was
 * approved is what was on screen and not whatever a re-run would produce a
 * moment later. That means re-fetching the policy here and posting it back
 * verbatim — the extra round trip is the point, not an inefficiency to remove.
 */
export async function acceptGeneratedPolicy(formData: FormData) {
  const siteId = String(formData.get("site_id") ?? "");
  const markets = String(formData.get("markets") ?? "");
  if (!siteId) back({ error: "Missing site." });

  const query = markets
    .split(",")
    .filter(Boolean)
    .map((m) => `market=${encodeURIComponent(m)}`)
    .join("&");

  const current = await apiGet<RecommendedPolicyResponse>(
    `/api/v1/sites/${siteId}/consent-policy${query ? `?${query}` : ""}`,
  );
  if (!current.ok) back({ site_id: siteId, error: current.message });

  const policy = current.data.policy;
  const approved = await apiSend<{ version: ConsentPolicyVersionSummary }>(
    `/api/v1/sites/${siteId}/consent-policy`,
    {
      method: "POST",
      body: {
        recommendations: policy.recommendations,
        jurisdictions: policy.jurisdictions,
        regimes: policy.regimes,
        scan_id: policy.scan_id,
        approval_note: "Accepted from the setup journey.",
      },
    },
  );

  if (!approved.ok) back({ site_id: siteId, markets, error: approved.message });

  revalidatePath(BASE);
  back({ site_id: siteId, markets, accepted: "1" });
}

/**
 * Step 3, human review. Classify one vendor Rift could not place.
 *
 * Overrides are keyed by `detector_id`, which is to say they are decisions
 * about a vendor across the whole site rather than about a single observation.
 * That is the granularity the API offers and the UI says so, because implying
 * per-page control that does not exist would be a lie the operator only
 * discovers when it matters.
 */
export async function setRecommendationOverride(formData: FormData) {
  const siteId = String(formData.get("site_id") ?? "");
  const markets = String(formData.get("markets") ?? "");
  const detectorId = String(formData.get("detector_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const purposeCode = String(formData.get("purpose_code") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!siteId || !detectorId || !action) {
    back({ site_id: siteId, markets, error: "Missing site, technology or decision." });
  }

  const saved = await apiSend(`/api/v1/sites/${siteId}/consent-policy/overrides`, {
    method: "POST",
    body: {
      detector_id: detectorId,
      action,
      ...(purposeCode ? { purpose_code: purposeCode } : {}),
      ...(note ? { note } : {}),
    },
  });

  if (!saved.ok) back({ site_id: siteId, markets, error: saved.message });

  revalidatePath(BASE);
  back({ site_id: siteId, markets });
}

/** Step 3, undone. Hands the line back to the engine. */
export async function clearRecommendationOverride(formData: FormData) {
  const siteId = String(formData.get("site_id") ?? "");
  const markets = String(formData.get("markets") ?? "");
  const detectorId = String(formData.get("detector_id") ?? "");

  const cleared = await apiSend(
    `/api/v1/sites/${siteId}/consent-policy/overrides?detector_id=${encodeURIComponent(detectorId)}`,
    { method: "DELETE" },
  );

  if (!cleared.ok) back({ site_id: siteId, markets, error: cleared.message });

  revalidatePath(BASE);
  back({ site_id: siteId, markets });
}
