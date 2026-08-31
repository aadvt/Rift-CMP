import type { NextRequest } from "next/server";
import { z } from "zod";
import { getEffectiveConsent, prisma, recordConsentDecision } from "database";
import type { ConsentDecisionResponse, ConsentStateResponse } from "@rift-cmp/shared";
import { CONSENT_STATUSES } from "@rift-cmp/shared";
import { jsonError, setCorsHeaders } from "@/lib/cors";
import { authenticateIngest } from "@/lib/auth";

/**
 * The browser-facing consent plane, authenticated with the site public key -
 * the same credential the SDK already uses for events.
 *
 * A public key can record decisions and read the state of *one* principal whose
 * high-entropy id the caller already knows. It deliberately cannot list
 * principals or read the audit trail; that is the management plane's job
 * (`/api/v1/consent/history`), which requires the organisation secret.
 */

/**
 * A decision may not be dated meaningfully in the future.
 *
 * This is an integrity guard, not a legal rule. Effective consent is "newest
 * decision wins", so a client that could backdate a GRANT into the future would
 * pin it permanently and make every later withdrawal a no-op. The allowance
 * absorbs ordinary client clock skew.
 */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const decisionSchema = z
  .object({
    principal_external_id: z.string().min(1).max(200),
    principal_kind: z.string().min(1).max(50).optional(),
    purpose_code: z.string().min(1).max(100),
    status: z.enum(CONSENT_STATUSES),
    notice_id: z.string().uuid().optional(),
    policy_version_id: z.string().uuid().optional(),
    decided_at: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "decided_at must be a valid RFC3339 timestamp",
      })
      .refine((value) => Date.parse(value) <= Date.now() + MAX_CLOCK_SKEW_MS, {
        message: "decided_at may not be in the future",
      })
      .optional(),
    source: z.string().min(1).max(50).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  // Strict: `site_id` and `organisation_id` are absent by design. The tenant
  // comes from the credential, so sending one is a validation error rather than
  // a silently ignored field.
  .strict();

export async function OPTIONS() {
  return setCorsHeaders(new Response(null, { status: 204 }));
}

/** Appends one immutable consent decision for a principal on the authenticated site. */
export async function POST(request: NextRequest) {
  const auth = await authenticateIngest(request);
  if (!auth.ok) return auth.response;
  const { siteId, organisationId } = auth.caller;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_json", "Request body must be valid JSON.");
  }

  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "Invalid consent decision.",
      parsed.error.issues.map((issue) => ({
        code: "invalid_request" as const,
        message: `${issue.path.join(".") || "body"}: ${issue.message}`,
      })),
    );
  }

  const input = parsed.data;
  const result = await recordConsentDecision(prisma, {
    organisationId,
    siteId,
    principalExternalId: input.principal_external_id,
    principalKind: input.principal_kind,
    purposeCode: input.purpose_code,
    status: input.status,
    noticeId: input.notice_id ?? null,
    policyVersionId: input.policy_version_id ?? null,
    // This plane is reached with a site public key, which in practice means the
    // browser SDK, so "sdk" is the right default here. `recordConsentDecision`
    // defaults to "api" instead, for direct library callers such as the seed
    // script or a bulk import.
    source: input.source ?? "sdk",
    decidedAt: input.decided_at ? new Date(input.decided_at) : undefined,
    metadata: input.metadata ?? null,
  });

  if (!result.ok) {
    return jsonError(result.code, result.message, [], 400);
  }

  // Return the resulting state alongside the record so a client needs one call.
  const state = await getEffectiveConsent(prisma, {
    siteId,
    principalExternalId: input.principal_external_id,
  });

  const responseBody: ConsentDecisionResponse = {
    record: result.record,
    effective: state?.effective ?? [],
  };

  return setCorsHeaders(Response.json(responseBody, { status: 201 }));
}

/**
 * The decision currently in force for each purpose, for one principal.
 *
 * A principal that has never been seen returns an empty list rather than 404:
 * "no decision recorded" is the normal state for a first-time visitor, and
 * absence of a decision already means "not granted" to `isPurposeGranted`.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateIngest(request);
  if (!auth.ok) return auth.response;
  const { siteId } = auth.caller;

  const principalExternalId = request.nextUrl.searchParams.get("principal_external_id")?.trim();
  if (!principalExternalId) {
    return jsonError("invalid_request", "Query parameter `principal_external_id` is required.");
  }

  const state = await getEffectiveConsent(prisma, { siteId, principalExternalId });

  const responseBody: ConsentStateResponse = {
    site_id: siteId,
    principal_external_id: principalExternalId,
    purposes: state?.effective ?? [],
  };

  return setCorsHeaders(Response.json(responseBody, { status: 200 }));
}
