import type { NextRequest } from "next/server";
import { getExperiment, prisma, updateExperiment } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";
import {
  checkExperiment,
  editabilityProblem,
  experimentUpdateSchema,
  toVariantInputs,
} from "@/lib/experiments";

/**
 * One experiment.
 *
 * **Management plane only.** Scoped by organisation in the same query that finds
 * it, so an experiment in another tenant is indistinguishable from one that does
 * not exist — a separate "exists but forbidden" would let somebody enumerate ids
 * by watching the status code change.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ experimentId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { experimentId } = await context.params;
  const experiment = await getExperiment(prisma, auth.caller.organisationId, experimentId);

  if (!experiment) {
    return managementError("not_found", `No experiment found with id: ${experimentId}.`, [], 404);
  }

  return Response.json({ experiment }, { status: 200 });
}

/**
 * Change an experiment's definition.
 *
 * Only before it has served anybody. Editing an allocation mid-run moves some
 * visitors between arms — a browser bucketed at 55 shifts when 50/50 becomes
 * 70/30 — so a decision taken under one banner would be counted against an arm
 * that person was never shown. There is no correct merge, so this refuses rather
 * than inventing one.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ experimentId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { experimentId } = await context.params;
  const existing = await getExperiment(prisma, auth.caller.organisationId, experimentId);
  if (!existing) {
    return managementError("not_found", `No experiment found with id: ${experimentId}.`, [], 404);
  }

  const parsed = await parseJsonBody(request, experimentUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const editability = editabilityProblem(existing.status);
  if (editability) {
    return managementError(
      "invalid_request",
      "The experiment was not changed.",
      [{ code: "invalid_request", message: `${editability.field}: ${editability.message}` }],
      409,
    );
  }

  const variants = input.variants ? toVariantInputs(input.variants) : null;

  if (variants || input.policy_version_id !== undefined) {
    const problems = await checkExperiment({
      organisationId: auth.caller.organisationId,
      siteId: existing.site_id,
      experimentId,
      policyVersionId: input.policy_version_id ?? null,
      // Unchanged variants are re-checked against the rest of the change, so an
      // edit cannot leave a coherent set attached to an incoherent experiment.
      variants:
        variants ??
        existing.variants.map((v) => ({
          key: v.key,
          name: v.name,
          description: v.description,
          allocation: v.allocation,
          text: v.text,
          isControl: v.is_control,
        })),
      starting: false,
    });

    if (problems.length > 0) {
      return managementError(
        "invalid_request",
        "The experiment was not changed.",
        problems.map((p) => ({
          code: "invalid_request" as const,
          message: `${p.field}: ${p.message}`,
        })),
        422,
      );
    }
  }

  const experiment = await updateExperiment(prisma, auth.caller.organisationId, experimentId, {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.starts_at === undefined
      ? {}
      : { startsAt: input.starts_at ? new Date(input.starts_at) : null }),
    ...(input.ends_at === undefined
      ? {}
      : { endsAt: input.ends_at ? new Date(input.ends_at) : null }),
    ...(input.policy_version_id === undefined
      ? {}
      : { policyVersionId: input.policy_version_id }),
    ...(variants ? { variants } : {}),
  });

  return Response.json({ experiment }, { status: 200 });
}
