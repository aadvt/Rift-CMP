import type { NextRequest } from "next/server";
import { findOwnedWebsite, siteNotFound } from "./auth";
import { managementError } from "./cors";

/**
 * Shared parsing for the analytics endpoints: an optional site filter and an
 * optional date range. Both endpoints take the same inputs, so they parse them
 * the same way rather than drifting apart.
 */
export type AnalyticsQuery =
  | { ok: true; siteId?: string; from?: Date; to?: Date }
  | { ok: false; response: Response };

function parseDate(value: string | null): Date | null | "invalid" {
  if (value === null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
}

export async function parseAnalyticsQuery(
  request: NextRequest,
  organisationId: string,
): Promise<AnalyticsQuery> {
  const params = request.nextUrl.searchParams;
  const siteId = params.get("site_id")?.trim() || undefined;

  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));

  for (const [label, value] of [["from", from], ["to", to]] as const) {
    if (value === "invalid") {
      return {
        ok: false,
        response: managementError(
          "invalid_request",
          `Query parameter \`${label}\` must be an ISO 8601 date.`,
        ),
      };
    }
  }

  if (from instanceof Date && to instanceof Date && from >= to) {
    return {
      ok: false,
      response: managementError("invalid_request", "`from` must be earlier than `to`."),
    };
  }

  // Narrowing to a site the caller does not own is a 404, as everywhere else,
  // so site ids cannot be probed across tenants.
  if (siteId && !(await findOwnedWebsite(organisationId, siteId))) {
    return { ok: false, response: siteNotFound(siteId) };
  }

  return {
    ok: true,
    siteId,
    from: from instanceof Date ? from : undefined,
    to: to instanceof Date ? to : undefined,
  };
}
