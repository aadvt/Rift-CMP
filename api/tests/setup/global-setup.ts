import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTestDatabaseUrl } from "./database-url";

const databaseDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../database",
);

/**
 * Brings the test schema up to date by replaying the full migration history.
 * This doubles as verification that migrations apply cleanly to a fresh database.
 */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: databaseDir,
    stdio: "inherit",
    // `prisma.config.ts` loads .env.local without overriding, so this wins.
    env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
  });
}
