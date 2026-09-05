import type { NextRequest } from "next/server";
import {
  getScanTechnologies,
  listPurposes,
  listScans,
  prisma,
} from "database";
import type { ConsentProposalResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import {
  buildProposal,
  type DetectedLocation,
  type Jurisdiction,
} from "@/lib/consent-config";

/**
 * What Rift suggests a site should declare, and the evidence for each line.
 *
 * **Management plane only, and read-only.** It writes nothing: a proposal is
 * computed on demand from the latest completed scan and the purposes already
 * declared, and it is never stored, never applied and never activated. The
 * operator turns it into configuration by declaring purposes through
 * `POST /api/v1/purposes`, which is the pre-existing flow and is unchanged.
 *
 * ## Why this is not an "auto-configure" button
 *
 * `app/dashboard/configure/page.tsx` argues that Rift cannot know which of an
 * operator's declared purposes covers a detected vendor — a purpose is
 * operator-declared free text, and a guessed mapping would be "confident,
 * unauditable and often wrong". That argument stands.
 *
 * What this adds is the half that was missing: Rift *can* say which
 * technologies were observed, which regimes appear to be in play, and what a
 * reasonable starting point looks like — provided every line carries the
 * evidence behind it and the whole thing is marked `requires_review`. A
 * suggestion a person can disagree with specifically is useful; a mapping
 * applied silently is not.
 *
 * ## Jurisdiction inputs
 *
 * The caller passes the markets it targets (`?market=DE&market=IN`) or asserts
 * jurisdictions outright (`?jurisdiction=EU`). Nothing here geolocates anybody:
 * a target market is a decision the business made and can evidence, which is
 * both the strongest signal available and the one that needs no personal data
 * at all. Absent either, no jurisdiction resolves and the engine says so rather
 * than guessing.
 */

const MAX_MARKETS = 20;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const url = new URL(request.url);

  // Markets the business targets. A region code, never an address.
  const markets = url.searchParams.getAll("market").slice(0, MAX_MARKETS);
  const locationSignals: DetectedLocation[] = markets.map((region) => ({
    region,
    source: "business_target_market",
  }));

  const assertedJurisdictions = url.searchParams
    .getAll("jurisdiction")
    .slice(0, MAX_MARKETS) as Jurisdiction[];

  // The most recent *completed* scan. A failed or running scan has partial
  // observations, and proposing from those would understate what a site runs
  // while looking exactly as confident as a complete one.
  const scans = await listScans(prisma, auth.caller.organisationId, {
    siteId,
    limit: 25,
  });
  const latest = scans.find((scan) => scan.status === "completed") ?? null;

  // The proposal reads technologies and nothing else, so nothing else is loaded.
  const technologies = latest
    ? ((await getScanTechnologies(prisma, auth.caller.organisationId, latest.id)) ?? [])
    : [];

  const purposes = await listPurposes(prisma, auth.caller.organisationId);

  const proposal = buildProposal({
    siteId,
    scanId: latest?.id ?? null,
    technologies: technologies.map((t) => ({
      name: t.name,
      category: t.category,
      confidence: (t.confidence === "high" || t.confidence === "medium"
        ? t.confidence
        : "low") as "high" | "medium" | "low",
    })),
    declaredPurposes: purposes.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      isActive: p.is_active,
    })),
    locationSignals,
    assertedJurisdictions,
    // Requested time, not "now" hidden inside the engine: the evaluator is
    // deterministic precisely because its instant is an input, and a commenced
    // requirement should change the answer on the day it commences, visibly.
    asOf: new Date(),
  });

  const body: ConsentProposalResponse = { proposal };
  return Response.json(body, { status: 200 });
}
