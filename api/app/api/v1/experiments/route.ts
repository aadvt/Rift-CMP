import type { NextRequest } from "next/server";
import { z } from "zod";
import type { ExperimentStatus } from "@rift-cmp/shared/experiment";
import { EXPERIMENT_STATUSES } from "@rift-cmp/shared/experiment";
import { createExperiment, listExperiments, prisma } from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody, parseLimit } from "@/lib/validation";
import { checkExperiment, experimentBodySchema, toVariantInputs } from "@/lib/experiments";

/**
 * Consent-UX experiments.
 *
 * **Management plane only.**
 *
 * An experiment varies how a consent choice is presented and cannot vary what
 * the choice means — see `docs/consent-experiments.md`. That guarantee is in the
 * shape of a variant rather than in this route's validation, so what is checked
 * here is only what depends on context: that the site belongs to the caller,
 * that the allocations are coherent, and that a named policy version is one this
 * tenant actually approved.
 *
 * New experiments are created `DRAFT`. Nothing serves a visitor until an
 * operator starts it deliberately, which is the same posture enforcement takes
 * about `observe`: the dangerous thing is a change to a live site, so it is
 * always a separate act.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const limit = parseLimit(request, 200);
  if (!limit.ok) return limit.response;

  const siteId = request.nextUrl.searchParams.get("site_id");
  const status = request.nextUrl.searchParams.get("status");

  if (status && !(EXPERIMENT_STATUSES as readonly string[]).includes(status)) {
    return managementError(
      "invalid_request",
      `Unknown status "${status}". Expected one of: ${EXPERIMENT_STATUSES.join(", ")}.`,
    );
  }

  // A site filter narrows within the caller's organisation and can never widen
  // beyond it, so an unowned site id yields nothing rather than someone else's
  // experiments.
  if (siteId) {
    const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
    if (!website) return siteNotFound(siteId);
  }

  const experiments = await listExperiments(prisma, {
    organisationId: auth.caller.organisationId,
    ...(siteId ? { siteId } : {}),
    ...(status ? { status: status as ExperimentStatus } : {}),
    ...(limit.limit ? { limit: limit.limit } : {}),
  });

  return Response.json({ experiments }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, experimentBodySchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const website = await findOwnedWebsite(auth.caller.organisationId, input.site_id);
  if (!website) return siteNotFound(input.site_id);

  const variants = toVariantInputs(input.variants);
  const problems = await checkExperiment({
    organisationId: auth.caller.organisationId,
    siteId: input.site_id,
    policyVersionId: input.policy_version_id ?? null,
    variants,
    // Creation does not serve anyone, so a second experiment may be drafted
    // while one is running. Starting it is where the collision is refused.
    starting: false,
  });

  if (problems.length > 0) {
    // Reported in full and never repaired. Silently correcting an allocation or
    // dropping an unsafe override would leave an operator running something
    // other than what they wrote, and reading the result as though they had.
    return managementError(
      "invalid_request",
      "The experiment was not created.",
      problems.map((p) => ({ code: "invalid_request" as const, message: `${p.field}: ${p.message}` })),
      422,
    );
  }

  const experiment = await createExperiment(prisma, {
    organisationId: auth.caller.organisationId,
    siteId: input.site_id,
    name: input.name,
    description: input.description ?? null,
    startsAt: input.starts_at ? new Date(input.starts_at) : null,
    endsAt: input.ends_at ? new Date(input.ends_at) : null,
    policyVersionId: input.policy_version_id ?? null,
    createdBy: auth.caller.userId,
    variants,
  });

  return Response.json({ experiment }, { status: 201 });
}

/** Kept so the schema is exercised by the type checker even when unused. */
export type ExperimentBody = z.infer<typeof experimentBodySchema>;
