import type { NextRequest } from "next/server";
import { z } from "zod";
import { createScan, listScans, prisma } from "database";
import { checkUrlShape, SCAN_MODES } from "@rift-cmp/crawler";
import type { CreateScanResponse, ScanListResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody, parseLimit } from "@/lib/validation";
import { toScanMetadata, toScanSummary } from "@/lib/scan-view";

/**
 * Scans for one site.
 *
 * **Management plane only.** Starting a crawl is not something a site public
 * key may do, and the reason is specific rather than cautious: `pk_...` ships in
 * page source, so anyone who views a customer's HTML holds it. A public key that
 * could start crawls would turn every deployed tag into a button that spends our
 * browser capacity, and — with a supplied start URL — into a request-forgery
 * primitive anyone on the internet could aim. Crawling costs real resources and
 * reaches out from our network, so it takes the organisation secret.
 */

const createScanSchema = z
  .object({
    start_url: z.string().min(1).max(2048),
    // Only `baseline` is implemented. The enum is the full vocabulary so a
    // caller asking for an unimplemented mode gets an explicit refusal rather
    // than a silently different scan.
    mode: z.enum(SCAN_MODES).optional(),
    max_pages: z.number().int().min(1).max(500).optional(),
    max_depth: z.number().int().min(0).max(10).optional(),
    max_duration_ms: z.number().int().min(10_000).max(30 * 60 * 1000).optional(),
  })
  .strict();

const MAX_LIMIT = 100;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/v1/sites/[siteId]/scans">) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await ctx.params;

  const parsed = await parseJsonBody(request, createScanSchema);
  if (!parsed.ok) return parsed.response;

  // Tenant check before anything else touches the URL: a caller must not learn
  // whether another organisation's site exists by watching how we validate.
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  if (parsed.data.mode && parsed.data.mode !== "baseline") {
    return managementError(
      "invalid_request",
      `Scan mode "${parsed.data.mode}" is declared in the contract but not implemented. Only "baseline" runs today.`,
    );
  }

  // Cheap, synchronous SSRF checks happen here so an obviously hostile URL is
  // refused with a clear error instead of becoming a queued scan that fails
  // later for reasons the caller has to go and look up. The authoritative
  // check — including DNS — runs again in the crawler immediately before
  // navigation, because what a hostname resolves to can change in between.
  const shape = checkUrlShape(parsed.data.start_url);
  if (!shape.allowed) {
    return managementError(
      "invalid_request",
      `start_url was rejected: ${shape.reason}${shape.detail ? ` (${shape.detail})` : ""}`,
    );
  }

  const scan = await createScan(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    startUrl: parsed.data.start_url,
    mode: parsed.data.mode ?? "baseline",
    config: {
      ...(parsed.data.max_pages !== undefined ? { maxPages: parsed.data.max_pages } : {}),
      ...(parsed.data.max_depth !== undefined ? { maxDepth: parsed.data.max_depth } : {}),
      ...(parsed.data.max_duration_ms !== undefined
        ? { maxDurationMs: parsed.data.max_duration_ms }
        : {}),
    },
  });

  // 202: the scan is queued, not performed. A crawl takes minutes and must
  // never run inside an HTTP request.
  const body: CreateScanResponse = { scan: toScanMetadata(scan) };
  return Response.json(body, { status: 202 });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/sites/[siteId]/scans">) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await ctx.params;

  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const parsedLimit = parseLimit(request, MAX_LIMIT);
  if (!parsedLimit.ok) return parsedLimit.response;

  const scans = await listScans(prisma, auth.caller.organisationId, {
    siteId,
    limit: parsedLimit.limit ?? 50,
  });

  const body: ScanListResponse = {
    scans: scans.map((scan) => ({ ...toScanMetadata(scan), summary: toScanSummary(scan) })),
  };
  return Response.json(body, { status: 200 });
}
