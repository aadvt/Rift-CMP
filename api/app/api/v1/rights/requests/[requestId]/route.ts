import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, updateRightsRequest } from "database";
import { authenticateManagement } from "@/lib/auth";
import { managementError } from "@/lib/cors";
import { parseJsonBody } from "@/lib/validation";

/**
 * Moving a rights request along.
 *
 * Management plane. The status is a fact about what the operator has done, so
 * unlike a consent decision it is mutable — freezing it would mean a request
 * could never be answered. What cannot change is what was asked, by whom and
 * when: `kind`, the principal and `received_at` are not writable here.
 *
 * `completed` is the operator's claim that they did the work in their own
 * systems. Rift cannot verify it and does not pretend to; `resolution_note` is
 * the only record of what actually happened, which is why the schema keeps it.
 */

const STATUSES = ["received", "in_progress", "completed", "refused", "withdrawn"] as const;

const patchSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    resolution_note: z.string().max(4000).nullable().optional(),
    /**
     * Operator-declared. Statutory response deadlines differ by regime and Rift
     * does not compute one - inventing a date would be inventing the legal
     * conclusion behind it.
     */
    due_at: z.string().datetime().nullable().optional(),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { requestId } = await context.params;
  const parsed = await parseJsonBody(request, patchSchema);
  if (!parsed.ok) return parsed.response;

  const result = await updateRightsRequest(prisma, {
    organisationId: auth.caller.organisationId,
    requestId,
    status: parsed.data.status,
    resolutionNote: parsed.data.resolution_note,
    dueAt:
      parsed.data.due_at === undefined
        ? undefined
        : parsed.data.due_at === null
          ? null
          : new Date(parsed.data.due_at),
  });

  if (!result.ok) {
    // 404 rather than 403 for another tenant's request, like everywhere else.
    return managementError("not_found", result.message, [], 404);
  }

  return Response.json({ request: result.request }, { status: 200 });
}
