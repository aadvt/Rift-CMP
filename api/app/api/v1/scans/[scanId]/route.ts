import type { NextRequest } from "next/server";
import { cancelScan, getScan, prisma } from "database";
import type { ScanStatusResponse } from "@rift-cmp/shared";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { toScanMetadata, toScanSummary } from "@/lib/scan-view";

/**
 * One scan's status and counts.
 *
 * Deliberately separate from `/results`: an onboarding UI polls this every
 * couple of seconds while a crawl runs, and it should not drag several hundred
 * observation rows across the wire each time to render a progress number.
 *
 * Every lookup is scoped by `organisationId` in the SQL WHERE clause, so a scan
 * belonging to another tenant is indistinguishable from one that does not
 * exist — the same treatment sites and consent reference data already get.
 */

function scanNotFound(scanId: string): Response {
  return managementError("not_found", `No scan with id "${scanId}".`, [], 404);
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/scans/[scanId]">) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { scanId } = await ctx.params;
  const scan = await getScan(prisma, auth.caller.organisationId, scanId);
  if (!scan) return scanNotFound(scanId);

  const body: ScanStatusResponse = {
    scan: toScanMetadata(scan),
    summary: toScanSummary(scan),
  };
  return Response.json(body, { status: 200 });
}

/**
 * Cancels a queued or running scan.
 *
 * Cancellation is cooperative: it marks the row, and a running crawl notices at
 * its next page boundary. It does not kill a browser mid-navigation, because a
 * half-torn-down context is a worse state than one extra page.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/v1/scans/[scanId]">) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { scanId } = await ctx.params;

  const scan = await getScan(prisma, auth.caller.organisationId, scanId);
  if (!scan) return scanNotFound(scanId);

  const cancelled = await cancelScan(prisma, auth.caller.organisationId, scanId);
  if (!cancelled) {
    return managementError(
      "conflict",
      `Scan "${scanId}" is ${scan.status} and can no longer be cancelled.`,
      [],
      409,
    );
  }

  const updated = await getScan(prisma, auth.caller.organisationId, scanId);
  const body: ScanStatusResponse = {
    scan: toScanMetadata(updated!),
    summary: toScanSummary(updated!),
  };
  return Response.json(body, { status: 200 });
}
