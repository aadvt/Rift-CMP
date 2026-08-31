import type { NextRequest } from "next/server";
import { z } from "zod";
import { createPolicyVersion, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Publishes a new version of an existing policy.
 *
 * Versions are append-only in practice: there is no update or delete route,
 * because consent records point at the version that was in force when a decision
 * was made. Editing a version in place would silently rewrite what a principal
 * actually agreed to.
 */
const createVersionSchema = z
  .object({
    version: z.string().min(1).max(50),
    document_url: z.string().url().optional(),
    content_hash: z.string().min(1).max(200).optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/v1/policies/[policyId]/versions">,
) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { policyId } = await ctx.params;

  const body = await parseJsonBody(request, createVersionSchema);
  if (!body.ok) return body.response;

  const duplicate = await prisma.policyVersion.findFirst({
    where: {
      organisationId: auth.caller.organisationId,
      policyId,
      version: body.data.version,
    },
    select: { id: true },
  });
  if (duplicate) {
    return managementError(
      "conflict",
      `Version "${body.data.version}" already exists for this policy.`,
      [],
      409,
    );
  }

  // Returns null when the policy is not owned by the caller, which we surface as
  // 404 rather than 403 so policy ids cannot be probed across tenants.
  const version = await createPolicyVersion(prisma, {
    organisationId: auth.caller.organisationId,
    policyId,
    version: body.data.version,
    documentUrl: body.data.document_url ?? null,
    contentHash: body.data.content_hash ?? null,
  });

  if (!version) {
    return managementError("not_found", `No policy found with id: ${policyId}.`, [], 404);
  }

  return Response.json(version, { status: 201 });
}
