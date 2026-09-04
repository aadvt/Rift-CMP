import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { resolveTestDatabaseUrl } from "./tests/setup/database-url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tests that touch no database.
 *
 * Kept as a separate project so pure logic and component rendering can be run
 * and iterated on in milliseconds, without a Postgres connection. Before this
 * split, a database outage failed even the formatting tests, which was both
 * slow and misleading.
 */
const UNIT_TESTS = [
  "tests/keys.test.ts",
  "tests/secure-transfer-crypto.test.ts",
  "tests/dashboard-components.test.tsx",
  "tests/discovery-classification.test.ts",
  "tests/rate-limit.test.ts",
  "tests/origin-validation.test.ts",
  "tests/sdk-limits.test.ts",
  "tests/policy-rules.test.ts",
  "tests/policy-engine.test.ts",
  "tests/policy-boundary.test.ts",
  "tests/jurisdiction-resolution.test.ts",
  "tests/crawler-ssrf.test.ts",
  "tests/crawler-url.test.ts",
  "tests/crawler-detectors.test.ts",
  "tests/crawler-diff.test.ts",
  "tests/consent-experience.test.ts",
];

/**
 * Tests that drive a real browser.
 *
 * Separate from `unit` because they need a Chromium binary that `npm install`
 * does not fetch (`npx playwright install chromium`). Putting them in the fast
 * loop would make a fresh clone fail with a missing-executable error - the same
 * misleading failure the unit/integration split exists to prevent.
 */
const BROWSER_TESTS = ["tests/crawler-browser.test.ts"];

export default defineConfig({
  resolve: {
    alias: { "@": here },
  },
  test: {
    // Applies to every project: no two test files run concurrently.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias: { "@": here } },
        test: {
          name: "unit",
          include: UNIT_TESTS,
          // Component tests need a DOM; the others are happy in either. The DOM
          // environment is selected per file with a `@vitest-environment` docblock.
          environment: "node",
        },
      },
      {
        resolve: { alias: { "@": here } },
        test: {
          name: "browser",
          include: BROWSER_TESTS,
          environment: "node",
          // A real Chromium launch plus four crawls of a fixture site.
          testTimeout: 180_000,
          hookTimeout: 240_000,
        },
      },
      {
        resolve: { alias: { "@": here } },
        test: {
          name: "integration",
          include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
          exclude: ["node_modules/**", ...UNIT_TESTS, ...BROWSER_TESTS],
          globalSetup: ["./tests/setup/global-setup.ts"],
          // Every test file shares one database schema and truncates between
          // tests, so two files running at once would let one file's
          // `resetDatabase()` delete rows another is asserting on. `singleFork`
          // puts every file in one process, one at a time, which also means one
          // Prisma connection pool against Neon instead of one per worker.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 60_000,
          hookTimeout: 120_000,
          env: { DATABASE_URL: resolveTestDatabaseUrl() },
        },
      },
    ],
  },
});
