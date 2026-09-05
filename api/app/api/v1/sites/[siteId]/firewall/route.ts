import type { NextRequest } from "next/server";
import { z } from "zod";
import type { FirewallEvaluationResponse } from "@rift-cmp/shared";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { guardOutboundRequest } from "@/lib/firewall";
import { parseJsonBody } from "@/lib/validation";
import { managementError } from "@/lib/cors";

/**
 * Ask the firewall what it would do, without doing it.
 *
 * **Management plane only.**
 *
 * This is the dry run an operator needs before turning enforcement on, and the
 * one an integrator needs while wiring `guardOutboundRequest` into their own
 * server. It runs the real evaluator against the real approved configuration and
 * the visitor's real recorded decisions — a preview computed by a different code
 * path would be a preview of something else.
 *
 * ## The payload is never stored and never echoed
 *
 * A caller may send a sample payload to see which redaction rules would fire.
 * The response says which rules matched which paths and nothing more: it does
 * not return the redacted payload, and the evaluation is not written to the
 * enforcement log. An endpoint that echoed a payload back would be a way to
 * launder sensitive data through the audit surface, and one that logged it would
 * put it in the table this subsystem exists to keep clean.
 */

const redactionRuleSchema = z.object({
  id: z.string().min(1).max(64),
  field: z.string().min(1).max(256),
  match: z.enum(["name", "path"]),
  locations: z.array(z.enum(["body", "query", "header"])).max(3).optional(),
  strategy: z.enum(["remove", "mask", "hash"]),
  case_sensitive: z.boolean().optional(),
});

const bodySchema = z.object({
  destination: z.string().min(1).max(2048),
  principal_external_id: z.string().min(1).max(256).optional(),
  vendor: z.string().max(256).nullable().optional(),
  purpose: z.string().max(128).nullable().optional(),
  data_categories: z.array(z.string().max(128)).max(64).optional(),
  payload: z.unknown().optional(),
  redaction: z
    .object({
      rules: z.array(redactionRuleSchema).max(128),
      mask_token: z.string().max(64).optional(),
      hash_salt: z.string().max(256).optional(),
    })
    .optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await context.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const outcome = await guardOutboundRequest({
    organisationId: auth.caller.organisationId,
    siteId,
    request: {
      url: input.destination,
      ...(input.payload === undefined ? {} : { body: input.payload }),
    },
    ...(input.principal_external_id ? { principalExternalId: input.principal_external_id } : {}),
    ...(input.vendor === undefined ? {} : { vendor: input.vendor }),
    ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
    ...(input.data_categories ? { dataCategories: input.data_categories } : {}),
    ...(input.redaction
      ? {
          redaction: {
            rules: input.redaction.rules.map((r) => ({
              id: r.id,
              field: r.field,
              match: r.match,
              strategy: r.strategy,
              ...(r.locations ? { locations: r.locations } : {}),
              ...(r.case_sensitive === undefined ? {} : { caseSensitive: r.case_sensitive }),
            })),
            ...(input.redaction.mask_token ? { maskToken: input.redaction.mask_token } : {}),
            ...(input.redaction.hash_salt ? { hashSalt: input.redaction.hash_salt } : {}),
          },
        }
      : {}),
    // A dry run is not an enforcement event. Recording it would fill the audit
    // trail with things that never happened.
    record: false,
  });

  const decision = outcome.decision;

  const body: FirewallEvaluationResponse = {
    decision: {
      decision: decision.decision,
      effect: decision.effect,
      destination_host: decision.host,
      vendor: decision.vendor,
      purpose: decision.purpose,
      user_state: decision.userState,
      matched_rule: decision.matchedRule,
      policy_version: decision.policyVersion,
      reason: decision.reason,
      severity: decision.severity,
      evidence: decision.evidence,
      redactions: decision.redactions,
      observed_only: decision.observedOnly,
      source: decision.source,
    },
    // Paths and rule ids. The redacted payload itself is deliberately absent.
    redaction_applied: outcome.redactionApplied,
    would_send: outcome.send !== null,
    config_problems: outcome.configProblems,
    legal_advice: false,
  };

  if (outcome.configProblems.length > 0) {
    return managementError(
      "invalid_request",
      "The redaction rules were rejected, so nothing was evaluated against them.",
      outcome.configProblems.map((message) => ({ code: "invalid_request" as const, message })),
      422,
    );
  }

  return Response.json(body, { status: 200 });
}
