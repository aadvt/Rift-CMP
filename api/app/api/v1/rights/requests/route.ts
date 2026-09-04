import type { NextRequest } from "next/server";
import { z } from "zod";
import { listRightsRequests, prisma, submitRightsRequest } from "database";
import { authenticateManagement } from "@/lib/auth";
import { jsonError, setCorsHeaders } from "@/lib/cors";
import { guardIngest, requireConsentSession } from "@/lib/ingest-guard";
import { parseJsonBody, parseLimit } from "@/lib/validation";
import {
  availableRights,
  isSubmittableControl,
  type DetectedLocation,
} from "@/lib/rights";

/**
 * Rights requests: a principal asks, an operator answers.
 *
 * `POST` is on the **browser plane** and requires a consent session, for the
 * same reason recording a decision does since 6A: a site public key ships in
 * page source, so it is evidence of nothing about who is asking. Without the
 * session, anyone could file a deletion request naming somebody else's
 * principal id — and a deletion request is a more damaging thing to forge than
 * a consent record.
 *
 * `GET` is on the **management plane**, because the list is a queue of requests
 * from identifiable people and includes the contact details they supplied.
 *
 * ## Rift records; it does not fulfil
 *
 * Nothing here reaches into the customer's systems. Access and deletion touch
 * data Rift does not hold, and marking a request "completed" from its own
 * tables would be certifying something it cannot see. What this provides is the
 * workflow record, the evidence around it, and the audit trail.
 */

const MAX_MARKETS = 20;

const submitSchema = z
  .object({
    principal_external_id: z.string().min(1).max(200),
    /** One of `RIGHTS_CONTROLS`; an unknown kind is refused. */
    kind: z.string().min(1).max(64),
    message: z.string().max(4000).nullable().optional(),
    /**
     * Where to send the answer. Optional, and deliberately so: a request made
     * through a session that already identifies the principal needs no contact
     * detail, and asking for one would collect more than the request requires.
     */
    contact: z.string().max(320).nullable().optional(),
    markets: z.array(z.string().max(32)).max(MAX_MARKETS).optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  const guard = await guardIngest(request, {
    limit: "consentWrite",
    route: "rights-requests",
  });
  if (!guard.ok) return guard.response;

  const { caller, allowOrigin } = guard.guarded;

  const session = await requireConsentSession(request, caller, allowOrigin);
  if (!session.ok) return session.response;

  const parsed = await parseJsonBody(request, submitSchema);
  if (!parsed.ok) return parsed.response;

  if (!isSubmittableControl(parsed.data.kind)) {
    return jsonError(
      "invalid_request",
      `Unknown request kind: ${parsed.data.kind}.`,
      [],
      400,
      { allowOrigin },
    );
  }

  // A session binds one principal. A request naming a different one is the
  // forgery this endpoint exists to prevent, so it is refused rather than
  // silently rewritten to the session's principal.
  if (
    parsed.data.principal_external_id !== session.session.principalExternalId
  ) {
    return jsonError(
      "forbidden",
      "A rights request may only be made for the principal the session is bound to.",
      [],
      403,
      { allowOrigin },
    );
  }

  // The engine's view at the moment of the request, snapshotted onto it. Which
  // rules were cited when somebody asked is part of the record; re-deriving it
  // later would answer under a matrix that has since moved.
  const markets = parsed.data.markets ?? [];
  const availability = availableRights({
    locationSignals: markets.map<DetectedLocation>((region) => ({
      region,
      source: "business_target_market",
    })),
    asOf: new Date(),
  });
  const control = availability.controls.find((c) => c.control === parsed.data.kind);

  const result = await submitRightsRequest(prisma, {
    organisationId: caller.organisationId,
    siteId: caller.siteId,
    principalExternalId: parsed.data.principal_external_id,
    kind: parsed.data.kind,
    jurisdictions: availability.jurisdictions,
    ruleReferences: control?.rule_references ?? [],
    message: parsed.data.message ?? null,
    contact: parsed.data.contact ?? null,
  });

  if (!result.ok) {
    return jsonError("not_found", result.message, [], 404, { allowOrigin });
  }

  // A request is accepted even where the matrix indicated nothing. Refusing one
  // because no requirement was found would turn an incomplete research artifact
  // into a reason to deny somebody a request — exactly backwards. That it was
  // accepted without support is visible in the empty `rule_references`.
  const response = Response.json(
    {
      request: {
        request_id: result.request.request_id,
        kind: result.request.kind,
        status: result.request.status,
        received_at: result.request.received_at,
        rule_references: result.request.rule_references,
        // The browser plane never echoes a contact detail back.
      },
      availability: control ?? null,
    },
    { status: 201 },
  );
  setCorsHeaders(response, allowOrigin);
  return response;
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const limit = parseLimit(request, 500);
  if (!limit.ok) return limit.response;

  const url = new URL(request.url);
  const requests = await listRightsRequests(prisma, auth.caller.organisationId, {
    siteId: url.searchParams.get("site_id") ?? undefined,
    principalExternalId: url.searchParams.get("principal_external_id") ?? undefined,
    limit: limit.limit,
  });

  return Response.json({ requests }, { status: 200 });
}

export async function OPTIONS(request: NextRequest): Promise<Response> {
  const response = new Response(null, { status: 204 });
  setCorsHeaders(response, request.headers.get("origin"));
  return response;
}
