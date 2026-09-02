import type { NextRequest } from "next/server";
import { getDiscoveryInventory, prisma } from "database";
import type { DiscoveryInventory } from "@rift-cmp/shared";
import { authenticateManagement, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";

/**
 * The discovery inventory for one site: every destination its pages contact,
 * every storage key they write, and every consent violation observed.
 *
 * Management plane, organisation secret only. This deliberately returns no CORS
 * headers — it is a server-to-server read. The inventory names every vendor a
 * business uses, which is commercially sensitive and must not be reachable with
 * the public key that ships in page source.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const siteId = request.nextUrl.searchParams.get("site_id")?.trim();
  if (!siteId) {
    return managementError("invalid_request", "Query parameter `site_id` is required.");
  }

  const sinceParam = request.nextUrl.searchParams.get("since")?.trim();
  let since: Date | undefined;
  if (sinceParam) {
    const parsed = new Date(sinceParam);
    if (Number.isNaN(parsed.getTime())) {
      return managementError("invalid_request", "`since` must be a valid RFC3339 timestamp.");
    }
    since = parsed;
  }

  // The site is re-resolved against the caller's organisation inside the read
  // model, so a valid key for one tenant cannot read another tenant's site by
  // guessing its id — a missing result is indistinguishable from a foreign one.
  const inventory: DiscoveryInventory | null = await getDiscoveryInventory(prisma, {
    organisationId: auth.caller.organisationId,
    siteId,
    since,
  });

  if (!inventory) {
    return siteNotFound(siteId);
  }

  return Response.json(inventory, { status: 200 });
}
