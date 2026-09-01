import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, "../..");

/**
 * Tests run against a dedicated schema in the same database, so they never touch
 * development data.
 *
 * Two things are forced here, both because of Neon's connection pooler:
 *
 * 1. **The schema is pinned explicitly.** The pooler can otherwise carry a
 *    `search_path` over from an unrelated session and point raw SQL at the
 *    wrong schema.
 *
 * 2. **The pooled endpoint is swapped for the direct one.** Through the pooler,
 *    a write committed in a `$transaction` is intermittently not visible to the
 *    very next read on a new connection. That surfaced as fixtures appearing to
 *    succeed and then their rows being absent - "No purpose found with code:
 *    analytics", or an organisation that had just been created failing to
 *    authenticate with 401. It is intermittent, load-dependent and had been
 *    misdiagnosed twice as a test-isolation problem. The direct endpoint has no
 *    pooler in the path and does not exhibit it.
 *
 * The application itself still uses the pooled endpoint, which is correct for
 * serverless request handling; this applies only to the test harness.
 */
export const TEST_SCHEMA = "rift_cmp_test";

/** Neon names its pooled endpoint `<endpoint>-pooler`; the direct one omits it. */
function toDirectEndpoint(url: string): string {
  return url.replace("-pooler.", ".");
}

function readFromEnvFile(file: string): string | undefined {
  const full = path.resolve(apiDir, file);
  if (!fs.existsSync(full)) return undefined;
  return /^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m.exec(fs.readFileSync(full, "utf8"))?.[1];
}

export function resolveTestDatabaseUrl(): string {
  const base = [
    process.env.TEST_DATABASE_URL,
    readFromEnvFile(".env.local"),
    readFromEnvFile(".env"),
    readFromEnvFile("../database/.env.local"),
    readFromEnvFile("../database/.env"),
  ].find((value): value is string => Boolean(value));

  if (!base) {
    throw new Error(
      "No DATABASE_URL found for tests. Set TEST_DATABASE_URL, or create api/.env.local (see README).",
    );
  }

  const stripped = toDirectEndpoint(base)
    .replace(/([?&])schema=[^&]*/g, "$1")
    .replace(/[?&]+$/, "");
  return `${stripped}${stripped.includes("?") ? "&" : "?"}schema=${TEST_SCHEMA}`;
}
