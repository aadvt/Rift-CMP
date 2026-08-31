import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTestDatabaseUrl } from "./database-url";

const databaseDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../database",
);

const ATTEMPTS = 3;
const BACKOFF_MS = 5000;

/**
 * Brings the test schema up to date by replaying the full migration history.
 * This doubles as verification that migrations apply cleanly to a fresh database.
 *
 * Retried because a serverless Postgres endpoint can be cold or briefly
 * unreachable (Prisma reports P1002), and a transient connect timeout here fails
 * the entire run before a single test executes. A genuine migration error still
 * fails, just after a few attempts.
 */
export default function setup() {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      execSync("npx prisma migrate deploy", {
        cwd: databaseDir,
        stdio: "inherit",
        // `prisma.config.ts` loads .env.local without overriding, so this wins.
        env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
      });
      return;
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.warn(
        `[test setup] migrate deploy failed (attempt ${attempt}/${ATTEMPTS}); retrying...`,
      );
      // Synchronous sleep: this runs before the worker pool starts, so there is
      // no event loop to yield to.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BACKOFF_MS);
    }
  }
}
