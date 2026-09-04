import type { NextRequest } from "next/server";
import { setCorsHeaders } from "@/lib/cors";
import { guardIngest } from "@/lib/ingest-guard";
import { availableRights, type DetectedLocation, type Jurisdiction } from "@/lib/rights";

/**
 * Which privacy controls apply, for the markets an operator serves.
 *
 * Browser plane, so a preference centre can render the right controls without
 * the page deciding which they are. The answer comes from the policy engine:
 * the regimes genuinely differ, and a fixed list of buttons would be wrong
 * somewhere the first day it shipped.
 *
 * ## What this returns, and what it refuses to
 *
 * Each control is `always`, `indicated` or `unknown`.
 *
 * `unknown` means the matrix carries no requirement of that family for these
 * jurisdictions. It is emphatically **not** a finding that the control does not
 * apply - `matrix/coverage.md` says silence means "not converted" - and the
 * response says so in the note on every such row rather than leaving a caller
 * to infer it from an absence.
 *
 * `indicated` means a requirement of the right family was found, and the
 * requirement text is carried so a person can read what was actually cited.
 * It does not mean the right definitely exists: which specific rights a regime
 * confers is recorded in the matrix as prose, and parsing that sentence would
 * be inventing structure the research does not have.
 *
 * Markets are supplied by the caller (`?market=DE`). Nothing here geolocates
 * anybody, and no personal data is read to answer it - which is also why the
 * response is identical for every visitor and can be cached.
 */

const MAX_MARKETS = 20;

export async function GET(request: NextRequest): Promise<Response> {
  const guard = await guardIngest(request, {
    limit: "consentRead",
    route: "rights",
  });
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const markets = url.searchParams.getAll("market").slice(0, MAX_MARKETS);
  const locationSignals: DetectedLocation[] = markets.map((region) => ({
    region,
    source: "business_target_market",
  }));
  const assertedJurisdictions = url.searchParams
    .getAll("jurisdiction")
    .slice(0, MAX_MARKETS) as Jurisdiction[];

  const availability = availableRights({
    locationSignals,
    assertedJurisdictions,
    asOf: new Date(),
  });

  const response = Response.json(availability, {
    headers: {
      // Depends only on the markets in the query, never on the caller.
      "cache-control": "public, max-age=300, stale-while-revalidate=900",
    },
  });
  setCorsHeaders(response, guard.guarded.allowOrigin);
  return response;
}

export async function OPTIONS(request: NextRequest): Promise<Response> {
  const response = new Response(null, { status: 204 });
  setCorsHeaders(response, request.headers.get("origin"));
  return response;
}
