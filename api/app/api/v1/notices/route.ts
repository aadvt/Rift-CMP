import type { NextRequest } from "next/server";
import { z } from "zod";
import { createNotice, listNotices, prisma } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * A notice is what was actually shown to a principal: one policy version, in one
 * locale, disclosing a specific set of purposes.
 *
 * Recording which purposes a notice disclosed is what lets a consent record cite
 * it as cover. `recordConsentDecision` rejects a decision that names a notice
 * which never disclosed that purpose.
 */
const createNoticeSchema = z
  .object({
    policy_version_id: z.string().uuid(),
    version: z.string().min(1).max(50),
    locale: z.string().min(2).max(35).optional(),
    purpose_codes: z.array(z.string().min(1).max(100)).min(1),
  })
  .strict();

export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const notices = await listNotices(prisma, auth.caller.organisationId);
  return Response.json({ notices }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const body = await parseJsonBody(request, createNoticeSchema);
  if (!body.ok) return body.response;

  const result = await createNotice(prisma, {
    organisationId: auth.caller.organisationId,
    policyVersionId: body.data.policy_version_id,
    version: body.data.version,
    locale: body.data.locale,
    purposeCodes: [...new Set(body.data.purpose_codes)],
  });

  if (!result.ok) {
    // A policy version or purpose belonging to another organisation is reported
    // exactly like one that does not exist.
    return managementError(result.code, result.message, [], 400);
  }

  return Response.json(result.notice, { status: 201 });
}
