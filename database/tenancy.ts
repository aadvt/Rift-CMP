import type { OrganisationSummary, OrganisationCreated, WebsiteSummary } from "@rift-cmp/shared";
import type { PrismaClient } from "./generated/client";
import { generatePublicKey, generateSecretKey, hashSecretKey } from "./keys";

/**
 * Provisioning helpers for the ownership model.
 *
 * Organisations are deliberately created here rather than over HTTP: there is no
 * credential that could authenticate "create a tenant", so exposing it as a
 * public endpoint would be an unauthenticated write. Tenants are provisioned by
 * an operator (seed script or a future admin tool) instead.
 */

/** Row shapes these helpers accept, so callers can pass narrow `select`s. */
type OrganisationRow = { id: string; name: string; slug: string; createdAt: Date };
type WebsiteRow = {
  id: string;
  organisationId: string;
  name: string;
  domain: string;
  publicKey: string;
  isActive: boolean;
  analyticsConsentPurpose: string | null;
  allowedOrigins: string[];
  createdAt: Date;
};

export function toOrganisationSummary(row: OrganisationRow): OrganisationSummary {
  return {
    organisation_id: row.id,
    name: row.name,
    slug: row.slug,
    created_at: row.createdAt.toISOString(),
  };
}

export function toWebsiteSummary(row: WebsiteRow): WebsiteSummary {
  return {
    site_id: row.id,
    organisation_id: row.organisationId,
    name: row.name,
    domain: row.domain,
    public_key: row.publicKey,
    is_active: row.isActive,
    analytics_consent_purpose: row.analyticsConsentPurpose,
    allowed_origins: row.allowedOrigins,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * Creates a tenant and returns its plaintext secret key. This is the only moment
 * the secret exists in readable form; only its digest is persisted.
 */
export async function createOrganisation(
  prisma: PrismaClient,
  input: { name: string; slug: string; id?: string },
): Promise<OrganisationCreated> {
  const secretKey = generateSecretKey();

  const organisation = await prisma.organisation.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      name: input.name,
      slug: input.slug,
      secretKeyHash: hashSecretKey(secretKey),
    },
  });

  return { ...toOrganisationSummary(organisation), secret_key: secretKey };
}

/** Creates a website owned by `organisationId`, minting its public key. */
export async function createWebsite(
  prisma: PrismaClient,
  input: {
    organisationId: string;
    name: string;
    domain: string;
    id?: string;
    isActive?: boolean;
    /** Opt in to server-side consent enforcement for this site's analytics. */
    analyticsConsentPurpose?: string | null;
    allowedOrigins?: string[];
  },
): Promise<WebsiteSummary> {
  const website = await prisma.website.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      organisationId: input.organisationId,
      name: input.name,
      domain: input.domain,
      publicKey: generatePublicKey(),
      isActive: input.isActive ?? true,
      analyticsConsentPurpose: input.analyticsConsentPurpose ?? null,
      allowedOrigins: input.allowedOrigins ?? [],
    },
  });

  return toWebsiteSummary(website);
}

/**
 * Offboards a tenant: the one supported way to destroy history.
 *
 * Phase 6A put deletion guards on `consent_records`, `transfer_authorisations`
 * and `transfer_records`, so a plain `prisma.organisation.delete()` now fails
 * the moment the cascade reaches any of them. That is the point: nothing should
 * be able to erase an audit trail as a side effect of something else.
 *
 * Offboarding is still legitimate, so it gets an explicit opt-in rather than an
 * exception. `SET LOCAL rift.offboarding = 'on'` lasts exactly as long as the
 * surrounding transaction, so the permission cannot leak into a later query on
 * the same pooled connection.
 *
 * The same mechanism is what a retention or erasure job would use when one is
 * built. There is no such job today.
 */
export async function deleteOrganisation(
  prisma: PrismaClient,
  organisationId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL rift.offboarding = 'on'");
    await tx.organisation.delete({ where: { id: organisationId } });
  });
}
