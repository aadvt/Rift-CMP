import { claimNextScan, markScanFailed, persistScanResult, prisma } from "database";
import { crawl, CRAWLER_VERSION, ScanFatalError, type CrawlEvent } from "./crawl";
import type { CrawlLimits, ScanMode } from "./types";

/**
 * The scan worker.
 *
 * ## Why this is a loop and not a queue
 *
 * A crawl takes minutes, so it cannot run inside an HTTP request — the API
 * queues a row and this process performs it. What it deliberately is *not* is a
 * distributed job system. There is no Redis, no BullMQ, no broker, because this
 * repository runs one Next.js process against one Postgres and adding a broker
 * would introduce a service to operate and a second source of truth about what
 * work exists, in exchange for throughput nobody is asking for yet.
 *
 * Claiming is a conditional `UPDATE ... WHERE status = 'queued'`, so two workers
 * racing for one row means one of them updates nothing and moves on. That is
 * correct for one process and stays correct for several.
 *
 * The boundary is what matters: everything below talks to the database through
 * `database/scans.ts` and to the crawler through `crawl()`. Replacing this file
 * with a real queue consumer later changes nothing else.
 */

export interface WorkerOptions {
  /** Stop after this many scans. Undefined means run until stopped. */
  maxScans?: number;
  /** Milliseconds to wait when the queue is empty. */
  idleDelayMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: CrawlEvent & { scan_id?: string }) => void;
}

/**
 * Structured logging.
 *
 * Fields are chosen so a scan can be diagnosed from logs alone, and the
 * omissions are as deliberate as the inclusions: no cookie names or values, no
 * headers, no query strings, no request bodies. A crawler that leaked what it
 * found into a log aggregator would have moved the privacy problem rather than
 * solved it. URLs are logged with query strings stripped for the same reason.
 */
function log(event: Record<string, unknown>): void {
  const safe = { ...event };
  if (typeof safe.url === "string") {
    try {
      const parsed = new URL(safe.url);
      safe.url = `${parsed.origin}${parsed.pathname}`;
    } catch {
      safe.url = "[unparseable]";
    }
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...safe }));
}

/** Runs one claimed scan to completion. Never throws. */
export async function runScan(scan: {
  id: string;
  siteId: string;
  organisationId: string;
  startUrl: string;
  mode: string;
  config: unknown;
}, options: { signal?: AbortSignal; onEvent?: WorkerOptions["onEvent"] } = {}): Promise<void> {
  const base = { scan_id: scan.id, site_id: scan.siteId, organisation_id: scan.organisationId };
  const startedAt = Date.now();

  log({ ...base, event: "scan_started", url: scan.startUrl, crawler_version: CRAWLER_VERSION });

  try {
    const overrides = (scan.config ?? {}) as Partial<CrawlLimits>;

    const result = await crawl({
      startUrl: scan.startUrl,
      mode: scan.mode as ScanMode,
      limits: overrides,
      signal: options.signal,
      onEvent: (event) => {
        log({ ...base, ...event });
        options.onEvent?.({ ...event, scan_id: scan.id });
      },
    });

    await persistScanResult(prisma, scan.id, result);

    log({
      ...base,
      event: "scan_completed",
      duration: Date.now() - startedAt,
      pages_scanned: result.summary.pagesScanned,
      pages_failed: result.summary.pagesFailed,
      technologies: result.summary.technologiesDetected,
      limit_reached: result.summary.limitReached,
    });
  } catch (error) {
    // Only genuinely scan-level failures reach here. Page-level failures are
    // recorded inside the crawl and never propagate, because losing ninety-nine
    // good pages to one timeout would be the wrong trade.
    const code = error instanceof ScanFatalError ? error.code : "crawl_failed";
    const message = (error as Error).message ?? "unknown error";

    await markScanFailed(prisma, scan.id, code, message).catch((persistError) => {
      log({ ...base, event: "scan_status_write_failed", error: String(persistError) });
    });

    log({ ...base, event: "scan_failed", status: "failed", error: code, duration: Date.now() - startedAt });
  }
}

/** Claims and runs scans until stopped or `maxScans` is reached. */
export async function runWorker(options: WorkerOptions = {}): Promise<number> {
  const idleDelayMs = options.idleDelayMs ?? 2_000;
  let completed = 0;

  while (!options.signal?.aborted) {
    if (options.maxScans !== undefined && completed >= options.maxScans) break;

    const scan = await claimNextScan(prisma);

    if (!scan) {
      if (options.maxScans !== undefined) break; // bounded run: nothing left to do
      await new Promise((resolve) => setTimeout(resolve, idleDelayMs));
      continue;
    }

    await runScan(scan, { signal: options.signal, onEvent: options.onEvent });
    completed += 1;
  }

  return completed;
}

/** `npm -w @rift-cmp/crawler run worker` */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
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
}
