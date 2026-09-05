import type { NextRequest } from "next/server";
import { z } from "zod";
import type { EnforcementReportResponse } from "@rift-cmp/shared";
import { hostOf } from "@rift-cmp/shared";
import { prisma, recordEnforcementEvents } from "database";
import { guardIngest } from "@/lib/ingest-guard";
import { parseJsonBody } from "@/lib/validation";
import { setCorsHeaders } from "@/lib/cors";

/**
 * What the browser blocked, reported back.
 *
 * **Ingest plane.** Authenticated with the site's public key, origin-checked and
 * rate-limited like every other browser-facing endpoint, because this one is
 * reachable from any page that has the key — which is every page the snippet is
 * on, and any page an attacker copies it to.
 *
 * ## Everything here is a claim, not a measurement
 *
 * These rows are written by a browser, and a browser can say anything. Somebody
 * could post a thousand invented BLOCK decisions for a vendor that was never on
 * the site. The mitigations are the ones that exist for analytics ingestion —
 * the key is site-scoped, the origin must match, the rate limit applies — and
 * they bound the damage without changing the nature of it. That is why the
 * events are stored with `source: "client"` and the history endpoint says what
 * client enforcement covers: a number from this plane is evidence about what the
 * SDK saw, not proof about what the site did.
 *
 * ## Only the host is kept
 *
 * The SDK sends the resource it decided about, which is a URL. The URL is
 * reduced to its host before anything is written, because a tracking URL's query
 * string is where the tracking data actually is — storing it would put the
 * payload into the one table built to hold no payloads.
 */

const decisionSchema = z.object({
  resource: z.string().min(1).max(2048),
  vendor: z.string().max(256).nullable().optional(),
  purpose: z.string().max(128).nullable().optional(),
  decision: z.enum(["ALLOW", "BLOCK", "REDACT", "REQUIRE_CONSENT", "REVIEW", "allow", "block"]),
  reason: z.string().max(1024),
  observed_only: z.boolean(),
  at: z.string().datetime().optional(),
});

const bodySchema = z.object({
  // A page that blocked 200 things has a configuration problem, not 200 things
  // worth reporting individually. The cap bounds one request; the rate limit
  // bounds the rest.
  decisions: z.array(decisionSchema).min(1).max(100),
});

/** The SDK's two-way vocabulary, mapped onto the firewall's five. */
function classify(raw: string, purpose: string | null | undefined): string {
  const upper = raw.toUpperCase();
  if (upper !== "ALLOW" && upper !== "BLOCK") return upper;
  if (upper === "BLOCK") return purpose ? "REQUIRE_CONSENT" : "BLOCK";
  return "ALLOW";
}

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await guardIngest(request, {
    limit: "consentWrite",
    route: "enforcement-report",
  });
  if (!guard.ok) return guard.response;
  const { caller, allowOrigin } = guard.guarded;

  const parsed = await parseJsonBody(request, bodySchema, { cors: true });
  if (!parsed.ok) return parsed.response;

  const now = new Date();
  let rejected = 0;

  const events = parsed.data.decisions.flatMap((decision) => {
    const host = hostOf(decision.resource, "https://report.invalid");
    if (!host || host === "report.invalid") {
      // A resource with no host is a `data:` URI or a malformed string. There is
      // nothing to attribute it to, and a row with a null destination would be
      // noise in the one log an operator is meant to be able to read.
      rejected += 1;
      return [];
    }

    const at = decision.at ? new Date(decision.at) : now;
    // A browser clock can be wrong or lying. A timestamp in the future is
    // clamped rather than rejected, so a skewed clock does not silently drop a
    // real block.
    const occurredAt = Number.isNaN(at.getTime()) || at > now ? now : at;

    const classified = classify(decision.decision, decision.purpose);

    return [
      {
        organisationId: caller.organisationId,
        siteId: caller.siteId,
        occurredAt,
        source: "client" as const,
        destinationHost: host,
        vendor: decision.vendor ?? null,
        purpose: decision.purpose ?? null,
        decision: classified,
        effect: (classified === "ALLOW" || classified === "REVIEW" || classified === "REDACT"
          ? "allow"
          : "block") as "allow" | "block",
        observedOnly: decision.observed_only,
        // The browser does not get to assert which policy version applied; that
        // is a server fact and an unverified claim about it would be worse than
        // its absence.
        policyVersion: null,
        matchedRule: null,
        reason: decision.reason,
        severity: classified === "BLOCK" || classified === "REQUIRE_CONSENT" ? "medium" : "info",
        redactions: null,
      },
    ];
  });

  const accepted = await recordEnforcementEvents(prisma, events);

  const body: EnforcementReportResponse = { accepted, rejected };
  return setCorsHeaders(Response.json(body, { status: 202 }), allowOrigin);
}
