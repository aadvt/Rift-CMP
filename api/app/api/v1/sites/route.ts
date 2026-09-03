import type { NextRequest } from "next/server";
import { z } from "zod";
import { createWebsite, prisma, toWebsiteSummary } from "database";
import { authenticateManagement } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation";

// `.strict()` matters: it rejects attempts to set `organisation_id`, `site_id`
// or `public_key` directly. Ownership and key material are server-assigned.
const createSiteSchema = z
  .object({
    name: z.string().min(1),
    domain: z.string().min(1),
    // Phase 6A. Opting in makes the ingestion plane refuse this site's analytics
    // events unless the request proves the purpose is currently GRANTED. Null,
    // the default, is the pre-6A behaviour.
    analytics_consent_purpose: z.string().min(1).max(100).nullish(),
    allowed_origins: z.array(z.string().min(1).max(255)).max(20).optional(),
  })
  .strict();

/** Lists every site owned by the authenticated organisation, and only those. */
export async function GET(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const websites = await prisma.website.findMany({
    where: { organisationId: auth.caller.organisationId },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ sites: websites.map(toWebsiteSummary) }, { status: 200 });
}

/** Creates a site owned by the authenticated organisation. */
export async function POST(request: NextRequest) {
  const auth = await authenticateManagement(request);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(request, createSiteSchema);
  if (!parsed.ok) return parsed.response;

  // The owning organisation comes from the credential, never from the body.
  const site = await createWebsite(prisma, {
    organisationId: auth.caller.organisationId,
    name: parsed.data.name,
    domain: parsed.data.domain,
    analyticsConsentPurpose: parsed.data.analytics_consent_purpose ?? null,
    allowedOrigins: parsed.data.allowed_origins ?? [],
  });

  return Response.json(site, { status: 201 });
}
