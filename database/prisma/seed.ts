import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

async function main() {
  const siteId = "site_demo";
  const publicKey = "pk_demo_12345";

  const website = await prisma.website.upsert({
    where: { id: siteId },
    update: {
      name: "Demo Website",
      domain: "demo.example.com",
      publicKey,
      isActive: true,
    },
    create: {
      id: siteId,
      name: "Demo Website",
      domain: "demo.example.com",
      publicKey,
      isActive: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        site_id: website.id,
        public_key: website.publicKey,
        website_id: website.id,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
