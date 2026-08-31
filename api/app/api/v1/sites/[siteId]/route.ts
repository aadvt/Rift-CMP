import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, toWebsiteSummary } from "database";
import { authenticateManagement, findOwnedWebsite, siteNotFound } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation";

// Only presentation and activation are mutable. `organisation_id`, `site_id` and
// `public_key` are absent by design, and `.strict()` turns an attempt to send
// them into a validation error rather than a silently ignored field.
const updateSiteSchema = z
  .object({
    name: z.string().min(1).optional(),
    domain: z.string().min(1).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest, ctx: RouteContext<"/api/v1/sites/[siteId]">) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await ctx.params;
  const website = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!website) return siteNotFound(siteId);

  return Response.json(toWebsiteSummary(website), { status: 200 });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/v1/sites/[siteId]">) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const { siteId } = await ctx.params;

  const parsed = await parseJsonBody(request, updateSiteSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await findOwnedWebsite(auth.caller.organisationId, siteId);
  if (!existing) return siteNotFound(siteId);

  // Updating through the `(id, organisation_id)` unique key keeps the tenant
  // filter in the SQL WHERE clause, so this can never touch another org's site.
  const website = await prisma.website.update({
    where: {
      id_organisationId: { id: siteId, organisationId: auth.caller.organisationId },
    },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.domain !== undefined ? { domain: parsed.data.domain } : {}),
      ...(parsed.data.is_active !== undefined ? { isActive: parsed.data.is_active } : {}),
    },
  });

  return Response.json(toWebsiteSummary(website), { status: 200 });
}
