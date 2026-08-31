import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma only reads `.env` on its own, but this project documents `.env.local`
// (the file `.gitignore` actually covers). Load it explicitly so the documented
// workflow — `npm run generate`, `npm run migrate`, `npm run seed` — just works.
// Prisma CLI commands are run from this `database/` directory (see its README).
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
