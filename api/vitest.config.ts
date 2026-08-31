import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "./tests/setup/database-url";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": here },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/setup/global-setup.ts"],
    // Every test file shares one database schema and truncates between tests, so
    // two files running at once would let one file's `resetDatabase()` delete the
    // rows another file is mid-way through asserting on. `fileParallelism: false`
    // alone still permits separate worker processes; `singleFork` puts every file
    // in one process, one at a time, which also means one Prisma connection pool
    // against Neon instead of one per worker.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { DATABASE_URL: resolveTestDatabaseUrl() },
  },
});
