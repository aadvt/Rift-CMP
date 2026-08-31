import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, "../..");

/**
 * Tests run against a dedicated schema in the same database, so they never touch
 * development data.
 *
 * The schema is pinned explicitly in the connection string: Neon's connection
 * pooler can otherwise carry a `search_path` over from a previous session and
 * silently point queries at the wrong schema.
 */
export const TEST_SCHEMA = "rift_cmp_test";

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

  const stripped = base.replace(/([?&])schema=[^&]*/g, "$1").replace(/[?&]+$/, "");
  return `${stripped}${stripped.includes("?") ? "&" : "?"}schema=${TEST_SCHEMA}`;
}
