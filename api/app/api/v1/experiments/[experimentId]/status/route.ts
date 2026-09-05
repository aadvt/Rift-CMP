import type { NextRequest } from "next/server";
import { z } from "zod";
import { EXPERIMENT_STATUSES, type ExperimentStatus } from "@rift-cmp/shared/experiment";
import { getExperiment, prisma, setExperimentStatus } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";
import { checkExperiment, checkTransition } from "@/lib/experiments";

/**
 * Start, pause, complete or archive an experiment.
 *
 * **Management plane only.**
 *
 * One endpoint rather than four verbs, because the interesting logic is the
 * transition itself and splitting it would put the same lifecycle table in four
 * places. The move is validated against where the experiment actually is, not
 * against what the caller believes — a stale dashboard tab asking to start
 * something already completed gets a refusal that says so.
 *
 * Starting re-runs the full configuration check. An experiment can be drafted
 * while another runs, and can sit in draft while the site's approved policy
 * changes underneath it; the moment that matters is the moment it would begin
 * showing a real visitor a different banner.
 */
const bodySchema = z.object({
  status: z.enum(EXPERIMENT_STATUSES as unknown as [string, ...string[]]),
});

export async function POST(
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

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const target = parsed.data.status as ExperimentStatus;

  const problems = [...checkTransition(existing.status, target)];

  if (problems.length === 0 && target === "RUNNING") {
    problems.push(
      ...(await checkExperiment({
        organisationId: auth.caller.organisationId,
        siteId: existing.site_id,
        experimentId,
        policyVersionId: existing.policy_version_id,
        variants: existing.variants.map((v) => ({
          key: v.key,
          name: v.name,
          description: v.description,
          allocation: v.allocation,
          text: v.text,
          isControl: v.is_control,
        })),
        starting: true,
      })),
    );
  }

  if (problems.length > 0) {
    return managementError(
      "invalid_request",
      `The experiment was not changed to ${target}.`,
      problems.map((p) => ({
        code: "invalid_request" as const,
        message: `${p.field}: ${p.message}`,
      })),
      409,
    );
  }

  const experiment = await setExperimentStatus(
    prisma,
    auth.caller.organisationId,
    experimentId,
    target,
  );

  return Response.json({ experiment }, { status: 200 });
}
