import type { NextRequest } from "next/server";
import type { EnforcementHistoryResponse } from "@rift-cmp/shared";
import { listEnforcementEvents, prisma, summariseEnforcement } from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { parseLimit } from "@/lib/validation";

/**
 * What the firewall actually did on this site.
 *
 * **Management plane only.**
 *
 * Served with a `coverage` block rather than as a bare list, because a count of
 * blocked requests reads as completeness unless something says otherwise. An
 * operator looking at "14 blocked" will conclude that 14 is the number of things
 * that tried to leave, and on the client plane that is not what it means — it is
 * the number the SDK saw, which excludes everything that ran before it and
 * everything that never touched the browser at all.
 *
 * Stating that next to the number is the difference between a useful log and a
 * misleading one.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const limit = parseLimit(request, 500);
  if (!limit.ok) return limit.response;

  const decision = request.nextUrl.searchParams.get("decision");
  const sinceRaw = request.nextUrl.searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : undefined;

  const filter = {
    organisationId: auth.caller.organisationId,
    siteId,
    ...(decision ? { decision } : {}),
    ...(since && !Number.isNaN(since.getTime()) ? { since } : {}),
  };

  const [events, summary] = await Promise.all([
    listEnforcementEvents(prisma, { ...filter, ...(limit.limit ? { limit: limit.limit } : {}) }),
    summariseEnforcement(prisma, filter),
  ]);

  const body: EnforcementHistoryResponse = {
    events,
    summary,
    coverage: {
      client_enforcement:
        "Decisions the browser SDK took and reported. It sees what the page does after it loads.",
      server_enforcement:
        "Decisions taken on a request path routed through Rift's firewall. A block here means the bytes did not leave.",
      not_covered: [
        "Anything the page loaded before the SDK ran, including every script in the served HTML. Only a Content-Security-Policy header or removing the tag can stop those.",
        "Requests made by your own backend that do not go through the firewall.",
        "Traffic between a vendor's servers and anywhere else. Rift is not on that path.",
        "Anything a hostile script on the page chose to undo. The browser controls are ordinary JavaScript on a page you control.",
      ],
    },
    legal_advice: false,
  };

  return Response.json(body, { status: 200 });
}
