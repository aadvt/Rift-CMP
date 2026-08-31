import type { NextRequest } from "next/server";
import { z } from "zod";
import { createPurpose, listPurposes, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Purposes are what a fiduciary uses data for. They are reference data owned by
 * the organisation, so they live on the management plane and are shared across
 * all of that organisation's sites - a fiduciary declares "analytics" once.
 */
const createPurposeSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9_-]+$/, "code must be lowercase alphanumeric with - or _"),
    name: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const purposes = await listPurposes(prisma, auth.caller.organisationId);
  return Response.json({ purposes }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, createPurposeSchema);
  if (!body.ok) return body.response;

  const existing = await prisma.purpose.findFirst({
    where: { organisationId: auth.caller.organisationId, code: body.data.code },
    select: { id: true },
  });
  if (existing) {
    return managementError(
      "conflict",
      `A purpose with code "${body.data.code}" already exists.`,
      [],
      409,
    );
  }

  const purpose = await createPurpose(prisma, {
    organisationId: auth.caller.organisationId,
    code: body.data.code,
    name: body.data.name,
    description: body.data.description,
  });

  return Response.json(purpose, { status: 201 });
}
