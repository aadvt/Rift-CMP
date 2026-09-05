import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

/**
 * Command-line entry for the scan worker.
 *
 * It exists for one reason: `DATABASE_URL` has to be in the environment
 * *before* `database` is imported, and a static import cannot be preceded by
 * anything. `next dev` loads `.env.local` for the API; a worker started by hand
 * has nobody doing that for it, and the failure it produced instead — Prisma
 * reporting a missing environment variable from several frames inside
 * `claimNextScan` — reads like a database outage rather than an unloaded file.
 *
 * The env file is looked for where the rest of the repository keeps it. An
 * already-set `DATABASE_URL` always wins, so a deployment that injects the
 * variable properly is untouched by any of this.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  for (const candidate of [
    "../.env.local",
    "../../database/.env.local",
    "../../api/.env.local",
    "../../.env.local",
  ]) {
    loadEnv({ path: path.resolve(here, candidate), quiet: true });
    if (process.env.DATABASE_URL) break;
  }
}

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set and no .env.local was found. The worker needs the " +
      "same database the API uses — copy database/.env.example to " +
      "database/.env.local, or export DATABASE_URL before starting.",
  );
  process.exit(1);
}

const { runWorker, CRAWLER_VERSION } = await import("../src/worker.ts").then(async (m) => ({
  runWorker: m.runWorker,
  CRAWLER_VERSION: (await import("../src/crawl.ts")).CRAWLER_VERSION,
}));

const log = (event) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));

const controller = new AbortController();
process.on("SIGINT", () => {
  log({ event: "worker_stopping", reason: "SIGINT" });
  controller.abort();
});
process.on("SIGTERM", () => controller.abort());

log({ event: "worker_started", crawler_version: CRAWLER_VERSION });

runWorker({ signal: controller.signal })
  .then((count) => log({ event: "worker_stopped", scans_completed: count }))
  .catch((error) => {
    log({ event: "worker_crashed", error: String(error) });
    process.exit(1);
  });
