import type { NextRequest } from "next/server";
import { z } from "zod";
import { createPolicy, listPolicies, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * A policy is a document owned by the organisation; its text lives in immutable
 * versions. Creating a policy always creates its first version, because a policy
 * with no version cannot be referenced by a consent record.
 */
const createPolicySchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/, "code must be lowercase alphanumeric with - or _"),
    name: z.string().min(1).max(200),
    version: z.string().min(1).max(50),
    document_url: z.string().url().optional(),
    content_hash: z.string().min(1).max(200).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const policies = await listPolicies(prisma, auth.caller.organisationId);
  return Response.json({ policies }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, createPolicySchema);
  if (!body.ok) return body.response;

  const existing = await prisma.policy.findFirst({
    where: { organisationId: auth.caller.organisationId, code: body.data.code },
    select: { id: true },
  });
  if (existing) {
    return managementError(
      "conflict",
      `A policy with code "${body.data.code}" already exists.`,
      [],
      409,
    );
  }

  const policy = await createPolicy(prisma, {
    organisationId: auth.caller.organisationId,
    code: body.data.code,
    name: body.data.name,
    version: body.data.version,
    documentUrl: body.data.document_url ?? null,
    contentHash: body.data.content_hash ?? null,
  });

  return Response.json(policy, { status: 201 });
}
