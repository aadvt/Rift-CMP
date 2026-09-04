import type { NextRequest } from "next/server";
import {
  approvePolicyVersion,
  getApprovedPolicyVersion,
  getScanWithObservations,
  listOverrides,
  listPolicyVersions,
  listPurposes,
  listScans,
  prisma,
} from "database";
import { z } from "zod";
import type {
  ConsentPolicyVersionListResponse,
  RecommendedPolicyResponse,
} from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";
import { generatePolicy, type DetectedLocation, type Jurisdiction } from "@/lib/autopilot";

/**
 * The consent autopilot: generate a recommended policy, and approve one.
 *
 * **Management plane only.** A recommendation is derived from a scan and the
 * requirement matrix, and approving one changes what every visitor's banner
 * offers. Neither is something a site public key may do.
 *
 * `GET` generates and returns; it writes nothing. There is deliberately no
 * stored draft: a draft is a second artifact that looks like configuration, and
 * the first question anyone asks of one is whether it is live — which is exactly
 * the ambiguity approval exists to remove.
 *
 * `POST` approves a set of recommendations and publishes them as the next
 * immutable version. **The caller sends back the recommendations it is
 * approving**, rather than the server re-deriving them, because the operator
 * must approve what they actually reviewed. Re-deriving at approval time would
 * mean a scan finishing mid-review silently changed what was agreed to.
 */

const MAX_MARKETS = 20;

const approveSchema = z
  .object({
    /** The recommendations exactly as reviewed. */
    recommendations: z.array(z.record(z.string(), z.unknown())).min(0).max(500),
    jurisdictions: z.array(z.string().max(32)).max(MAX_MARKETS).optional(),
    regimes: z.array(z.string().max(64)).max(32).optional(),
    scan_id: z.string().max(64).nullable().optional(),
    approval_note: z.string().max(2000).nullable().optional(),
  })
  .strict();

async function gather(organisationId: string, siteId: string, url: URL) {
  const markets = url.searchParams.getAll("market").slice(0, MAX_MARKETS);
  const locationSignals: DetectedLocation[] = markets.map((region) => ({
    region,
    source: "business_target_market",
  }));
  const assertedJurisdictions = url.searchParams
    .getAll("jurisdiction")
    .slice(0, MAX_MARKETS) as Jurisdiction[];

  const scans = await listScans(prisma, organisationId, { siteId, limit: 25 });
  const latest = scans.find((scan) => scan.status === "completed") ?? null;
  const withObservations = latest
    ? await getScanWithObservations(prisma, organisationId, latest.id)
    : null;

  const [purposes, overrides] = await Promise.all([
    listPurposes(prisma, organisationId),
    listOverrides(prisma, organisationId, siteId),
  ]);

  return {
    scanId: latest?.id ?? null,
    technologies: (withObservations?.technologies ?? []).map((t) => ({
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
    overrides: overrides.map((o) => ({
      detectorId: o.detector_id,
      purposeCode: o.purpose_code,
      action: o.action,
      note: o.note,
    })),
    locationSignals,
    assertedJurisdictions,
  };
}

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

  if (url.searchParams.get("versions") === "true") {
    const versions = await listPolicyVersions(prisma, auth.caller.organisationId, siteId);
    const body: ConsentPolicyVersionListResponse = { versions };
    return Response.json(body, { status: 200 });
  }

  const inputs = await gather(auth.caller.organisationId, siteId, url);
  const policy = generatePolicy({ siteId, ...inputs, asOf: new Date() });
  const activeVersion = await getApprovedPolicyVersion(
    prisma,
    auth.caller.organisationId,
    siteId,
  );

  const body: RecommendedPolicyResponse = { policy, active_version: activeVersion };
  return Response.json(body, { status: 200 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const parsed = await parseJsonBody(request, approveSchema);
  if (!parsed.ok) return parsed.response;

  const result = await approvePolicyVersion(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    scanId: parsed.data.scan_id ?? null,
    recommendations: parsed.data.recommendations as never,
    jurisdictions: parsed.data.jurisdictions ?? [],
    regimes: parsed.data.regimes ?? [],
    approvalNote: parsed.data.approval_note ?? null,
  });

  if (!result.ok) {
    return managementError(
      result.code === "site_not_found" ? "not_found" : "conflict",
      result.message,
      [],
      result.code === "site_not_found" ? 404 : 409,
    );
  }

  return Response.json({ version: result.version }, { status: 201 });
}
