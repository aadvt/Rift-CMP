import type { NextRequest } from "next/server";
import { clearOverride, listOverrides, prisma, setOverride } from "database";
import { z } from "zod";
import type { OverrideListResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Operator overrides: "we decided differently about this vendor".
 *
 * An override is the mechanism the brief calls "ability for the company to
 * review/change it", and it is the reason a generated recommendation can be
 * regenerated safely. Without it, every rescan would either overwrite considered
 * human judgements or require the whole policy to be re-approved from scratch.
 *
 * Keyed on the detector, not on a scan row, so it survives the vendor
 * disappearing from a scan and reapplies when it returns. A vendor absent from
 * one crawl has usually not been removed — the crawl reached fewer pages.
 *
 * Mutable, unlike an approved policy version. An override is a standing
 * preference; changing your mind about a vendor is the point of it. What is
 * immutable is the version that was approved while the old preference was in
 * force, which still records what was actually served.
 */

const ACTIONS = ["allow", "require_consent", "block", "ignore", "review"] as const;

const setSchema = z
  .object({
    detector_id: z.string().min(1).max(128),
    /** Null means "no purpose of ours covers this vendor". */
    purpose_code: z.string().min(1).max(64).nullable().optional(),
    action: z.enum(ACTIONS),
    note: z.string().max(2000).nullable().optional(),
  })
  .strict();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const overrides = await listOverrides(prisma, auth.caller.organisationId, siteId);
  const body: OverrideListResponse = { overrides };
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

  const parsed = await parseJsonBody(request, setSchema);
  if (!parsed.ok) return parsed.response;

  const result = await setOverride(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    detectorId: parsed.data.detector_id,
    purposeCode: parsed.data.purpose_code ?? null,
    action: parsed.data.action,
    note: parsed.data.note ?? null,
  });

  if (!result.ok) return managementError("not_found", result.message, [], 404);
  return Response.json({ override: result.override }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const detectorId = new URL(request.url).searchParams.get("detector_id");
  if (!detectorId) {
    return managementError(
      "invalid_request",
      "detector_id is required.",
      [],
      400,
    );
  }

  const removed = await clearOverride(
    prisma,
    auth.caller.organisationId,
    siteId,
    detectorId,
  );
  // Idempotent: clearing an override that is not there is the state the caller
  // asked for, and reporting 404 would make a retry look like a failure.
  return Response.json({ cleared: removed }, { status: 200 });
}
