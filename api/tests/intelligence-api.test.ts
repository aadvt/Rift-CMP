/**
 * The intelligence endpoints, viewed as an attack surface.
 *
 * Every route here answers "what is running on this website, and what did its
 * visitors agree to" — which is exactly the report a competitor would most like
 * to read about somebody else's site. The interesting property is therefore not
 * that the numbers are right (the unit tests cover that) but that the routes
 * refuse to produce them for anyone who is not the owner.
 *
 * The specific failure worth guarding is the one where a caller authenticates
 * perfectly well against their own organisation and then passes somebody else's
 * `siteId` in the path. A route that scopes its query by `siteId` alone, rather
 * than by `siteId` *and* the caller's organisation, serves that request happily
 * — and nothing in the response looks wrong. So each route is asked for a site
 * in another tenant with a genuine key, and must not answer.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { GET as intelligence } from "@/app/api/v1/sites/[siteId]/intelligence/route";
import { GET as quality } from "@/app/api/v1/sites/[siteId]/quality/route";
import { GET as pages } from "@/app/api/v1/sites/[siteId]/pages/route";
import { GET as autopilot } from "@/app/api/v1/sites/[siteId]/autopilot/route";
import { GET as consentAnalytics } from "@/app/api/v1/analytics/consent/route";
import { createOwnershipTree, managementRequest, resetDatabase, siteParams } from "./helpers/fixtures";

type SiteRoute = (
  request: ReturnType<typeof managementRequest>,
  context: ReturnType<typeof siteParams>,
) => Promise<Response>;

/** Every site-scoped intelligence route, so none can be added without a guard. */
const SITE_ROUTES: Array<[string, SiteRoute]> = [
  ["intelligence", intelligence as SiteRoute],
  ["quality", quality as SiteRoute],
  ["pages", pages as SiteRoute],
  ["autopilot", autopilot as SiteRoute],
];

let tree: Awaited<ReturnType<typeof createOwnershipTree>>;

beforeEach(async () => {
  await resetDatabase();
  tree = await createOwnershipTree();
});

describe.each(SITE_ROUTES)("GET /sites/[siteId]/%s", (name, route) => {
  it("answers for a site the caller owns", async () => {
    const response = await route(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/${name}`, {
        key: tree.orgA.secretKey,
      }),
      siteParams(tree.siteA1.siteId),
    );

    expect(response.status).toBe(200);
  });

  it("refuses a site in another organisation, with a real key", async () => {
    // Organisation B is properly authenticated. It is simply not the owner.
    const response = await route(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/${name}`, {
        key: tree.orgB.secretKey,
      }),
      siteParams(tree.siteA1.siteId),
    );

    expect(response.status).toBe(404);

    // Not 403: a distinguishable "exists but forbidden" would let somebody
    // enumerate site ids by watching the status code change. The answer for
    // another tenant's real site must be the answer for a site that is not
    // there at all, modulo the id the caller themselves supplied.
    const absent = "00000000-0000-4000-8000-000000000000";
    const missing = await route(
      managementRequest(`/api/v1/sites/${absent}/${name}`, { key: tree.orgB.secretKey }),
      siteParams(absent),
    );

    expect(missing.status).toBe(response.status);
    const foreignBody = JSON.stringify(await response.json()).replaceAll(tree.siteA1.siteId, "ID");
    const missingBody = JSON.stringify(await missing.json()).replaceAll(absent, "ID");
    expect(foreignBody).toBe(missingBody);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await route(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/${name}`),
      siteParams(tree.siteA1.siteId),
    );

    expect(response.status).toBe(401);
  });

  it("refuses a key that is not a key", async () => {
    const response = await route(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/${name}`, {
        key: "sk_not_a_real_key",
      }),
      siteParams(tree.siteA1.siteId),
    );

    expect(response.status).toBe(401);
  });

  it("refuses the site's own public key", async () => {
    // `pk_` is published in every visitor's browser. If it opened these
    // reports, the reports would be public.
    const response = await route(
      managementRequest(`/api/v1/sites/${tree.siteA1.siteId}/${name}`, {
        key: tree.siteA1.publicKey,
      }),
      siteParams(tree.siteA1.siteId),
    );

    expect(response.status).toBe(401);
  });

  it("answers for a site with no scan rather than failing", async () => {
    // Every fixture site is unscanned, so this is the ordinary first-run state:
    // the report must be empty, not an error.
    const response = await route(
      managementRequest(`/api/v1/sites/${tree.siteA2.siteId}/${name}`, {
        key: tree.orgA.secretKey,
      }),
      siteParams(tree.siteA2.siteId),
    );

    expect(response.status).toBe(200);
  });
});

describe("GET /analytics/consent", () => {
  it("answers for the caller's own organisation", async () => {
    const response = await consentAnalytics(
      managementRequest("/api/v1/analytics/consent", { key: tree.orgA.secretKey }),
    );

    expect(response.status).toBe(200);
  });

  it("refuses an unauthenticated caller", async () => {
    const response = await consentAnalytics(managementRequest("/api/v1/analytics/consent"));
    expect(response.status).toBe(401);
  });

  it("will not report on a site in another organisation", async () => {
    // The site filter is a query parameter, which makes it the easiest thing in
    // the API to point somewhere it does not belong.
    const response = await consentAnalytics(
      managementRequest("/api/v1/analytics/consent", {
        key: tree.orgB.secretKey,
        query: { site_id: tree.siteA1.siteId },
      }),
    );

    expect(response.status).toBe(404);
  });

  it("never claims a dimension it does not record", async () => {
    const response = await consentAnalytics(
      managementRequest("/api/v1/analytics/consent", { key: tree.orgA.secretKey }),
    );
    const body = (await response.json()) as {
      consent: { unavailable_dimensions: Array<{ dimension: string; reason: string }> };
    };

    const dimensions = body.consent.unavailable_dimensions.map((d) => d.dimension);
    // Country is the one people ask for most, and the one Rift can never
    // answer, because it never geolocates anybody.
    expect(dimensions).toContain("country");
    for (const d of body.consent.unavailable_dimensions) {
      expect(d.reason.length).toBeGreaterThan(0);
    }
  });
});
