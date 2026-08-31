import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/client";
import { createOrganisation } from "../tenancy";
import { createNotice, createPolicy, createPurpose } from "../consent";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const prisma = new PrismaClient();

/**
 * Local development fixtures.
 *
 * Site IDs and public keys are fixed so the SDK demo page keeps working across
 * re-seeds. Public keys are safe to commit — they ship in browser code by
 * design. Organisation *secret* keys are generated randomly and printed once;
 * re-running the seed leaves an existing organisation's secret untouched.
 */
const ORGANISATIONS = [
  {
    id: "org_acme",
    slug: "acme",
    name: "Acme Analytics",
    sites: [
      {
        label: "Site A1",
        id: "site_demo",
        name: "Demo Website",
        domain: "demo.example.com",
        publicKey: "pk_demo_12345",
        isActive: true,
      },
      {
        label: "Site A2",
        id: "site_acme_blog",
        name: "Acme Blog",
        domain: "blog.acme.example",
        publicKey: "pk_acme_blog_67890",
        isActive: true,
      },
      {
        label: "fixture",
        id: "site_inactive",
        name: "Inactive Test Site",
        domain: "inactive.example.com",
        publicKey: "pk_inactive_999",
        isActive: false,
      },
    ],
  },
  {
    id: "org_globex",
    slug: "globex",
    name: "Globex Media",
    sites: [
      {
        label: "Site B1",
        id: "site_globex_shop",
        name: "Globex Shop",
        domain: "shop.globex.example",
        publicKey: "pk_globex_shop_24680",
        isActive: true,
      },
    ],
  },
] as const;

async function main() {
  const mintedSecrets: Array<{ slug: string; secretKey: string }> = [];

  for (const org of ORGANISATIONS) {
    const existing = await prisma.organisation.findUnique({ where: { slug: org.slug } });

    if (!existing) {
      const created = await createOrganisation(prisma, {
        id: org.id,
        name: org.name,
        slug: org.slug,
      });
      mintedSecrets.push({ slug: org.slug, secretKey: created.secret_key });
    }

    for (const site of org.sites) {
      await prisma.website.upsert({
        where: { id: site.id },
        update: {
          organisationId: org.id,
          name: site.name,
          domain: site.domain,
          publicKey: site.publicKey,
          isActive: site.isActive,
        },
        create: {
          id: site.id,
          organisationId: org.id,
          name: site.name,
          domain: site.domain,
          publicKey: site.publicKey,
          isActive: site.isActive,
        },
      });
    }

    await seedConsentReferenceData(org.id);
  }

  // The tenancy migration parked pre-existing sites in a placeholder
  // organisation. Once they have been adopted above, drop it if it is empty.
  const legacy = await prisma.organisation.findUnique({
    where: { id: "org_legacy" },
    include: { _count: { select: { websites: true } } },
  });
  if (legacy && legacy._count.websites === 0) {
    await prisma.organisation.delete({ where: { id: "org_legacy" } });
  }

  await printOwnershipTree();

  if (mintedSecrets.length > 0) {
    console.log("\nOrganisation secret keys (shown once, store them now):");
    for (const { slug, secretKey } of mintedSecrets) {
      console.log(`  ${slug.padEnd(8)} ${secretKey}`);
    }
    console.log("\nUse them as: Authorization: Bearer <secret_key> against /api/v1/sites");
  } else {
    console.log("\nOrganisations already existed; their secret keys were left unchanged.");
  }
}

/**
 * Purposes, a versioned policy, and a notice disclosing those purposes.
 *
 * Enough for a developer to record GRANTED / DENIED / WITHDRAWN against a real
 * purpose immediately after seeding. Idempotent: existing rows are left alone so
 * re-seeding never duplicates reference data or invalidates recorded consent.
 */
async function seedConsentReferenceData(organisationId: string) {
  const purposes = [
    {
      code: "analytics",
      name: "Product analytics",
      description: "Understand how visitors use the site.",
    },
    {
      code: "marketing",
      name: "Marketing communication",
      description: "Personalised marketing and remarketing.",
    },
  ];

  for (const purpose of purposes) {
    const existing = await prisma.purpose.findFirst({
      where: { organisationId, code: purpose.code },
    });
    if (!existing) {
      await createPurpose(prisma, { organisationId, ...purpose });
    }
  }

  let policy = await prisma.policy.findFirst({
    where: { organisationId, code: "privacy-policy" },
    include: { versions: { orderBy: { publishedAt: "asc" } } },
  });

  if (!policy) {
    const created = await createPolicy(prisma, {
      organisationId,
      code: "privacy-policy",
      name: "Privacy Policy",
      version: "1.0.0",
      documentUrl: "https://example.com/privacy/1.0.0",
    });
    policy = await prisma.policy.findFirstOrThrow({
      where: { id: created.policy_id },
      include: { versions: { orderBy: { publishedAt: "asc" } } },
    });
  }

  const existingNotice = await prisma.notice.findFirst({
    where: { organisationId, version: "notice-1", locale: "en" },
  });
  if (!existingNotice) {
    const result = await createNotice(prisma, {
      organisationId,
      policyVersionId: policy.versions[0].id,
      version: "notice-1",
      purposeCodes: purposes.map((purpose) => purpose.code),
    });
    if (!result.ok) {
      throw new Error(`Could not seed notice: ${result.message}`);
    }
  }
}

async function printOwnershipTree() {
  const organisations = await prisma.organisation.findMany({
    orderBy: { slug: "asc" },
    include: { websites: { orderBy: { createdAt: "asc" } } },
  });

  console.log("Ownership model\n");
  for (const org of organisations) {
    console.log(`Organisation ${org.name} (${org.slug})`);
    org.websites.forEach((site, index) => {
      const branch = index === org.websites.length - 1 ? " └──" : " ├──";
      const state = site.isActive ? "active" : "INACTIVE";
      console.log(`${branch} ${site.id.padEnd(18)} ${site.publicKey.padEnd(22)} ${state}`);
    });

    const purposes = await prisma.purpose.findMany({
      where: { organisationId: org.id },
      orderBy: { code: "asc" },
    });
    const notice = await prisma.notice.findFirst({
      where: { organisationId: org.id },
      include: { policyVersion: { include: { policy: true } } },
    });

    console.log(`     purposes: ${purposes.map((p) => p.code).join(", ") || "(none)"}`);
    if (notice) {
      console.log(
        `     notice  : ${notice.version} -> ${notice.policyVersion.policy.code}@${notice.policyVersion.version} (${notice.id})`,
      );
    }
    console.log("");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
