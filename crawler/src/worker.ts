import {
  claimNextScan,
  markScanFailed,
  persistScanResult,
  prisma,
  recordScanProgress,
} from "database";
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

/** How often a running scan publishes its page counters. */
const PROGRESS_INTERVAL_MS = 1_500;

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

  // Page counters, published as the crawl goes so a progress screen has
  // something true to show. Throttled: a crawl can visit several pages a second
  // and one write each would be a lot of traffic for a number nobody reads that
  // often. Every write is fire-and-forget and swallows its own errors — losing a
  // progress update is a cosmetic loss, and failing a scan over one would be
  // trading something that matters for something that does not.
  let pagesScanned = 0;
  let pagesFailed = 0;
  let lastProgressAt = 0;
  let progressInFlight = false;

  const publishProgress = (force = false) => {
    const now = Date.now();
    if (progressInFlight) return;
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return;

    lastProgressAt = now;
    progressInFlight = true;
    void recordScanProgress(prisma, scan.id, { pagesScanned, pagesFailed })
      .catch((error) => log({ ...base, event: "scan_progress_write_failed", error: String(error) }))
      .finally(() => {
        progressInFlight = false;
      });
  };

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

        if (event.event === "page_scanned") {
          pagesScanned += 1;
          publishProgress();
        } else if (event.event === "page_failed") {
          pagesFailed += 1;
          publishProgress();
        }
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

/**
 * Claims and runs scans until stopped or `maxScans` is reached.
 *
 * ## Why claiming is allowed to fail
 *
 * The one database call in this loop is `claimNextScan`, and a managed Postgres
 * closes idle connections, suspends compute and drops sockets as a matter of
 * routine. Letting that throw ended the process, and a worker that exits on a
 * transient reset leaves every queued scan stuck at "queued" — the failure looks
 * like a broken crawler to anyone watching a progress screen, and there is
 * nothing in the scan row to say otherwise.
 *
 * So a claim failure is logged and retried with a backoff rather than being
 * fatal. Only the claim: a failure *inside* a scan is already handled by
 * `runScan`, which records it against that scan and never throws.
 *
 * A bounded run (`maxScans`) still gives up after `MAX_CLAIM_FAILURES`, because
 * a test or a one-shot invocation retrying forever against a database that is
 * genuinely gone is worse than a clear failure.
 */
const CLAIM_BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const MAX_CLAIM_FAILURES = CLAIM_BACKOFF_MS.length;

export async function runWorker(options: WorkerOptions = {}): Promise<number> {
  const idleDelayMs = options.idleDelayMs ?? 2_000;
  let completed = 0;
  let consecutiveClaimFailures = 0;

  while (!options.signal?.aborted) {
    if (options.maxScans !== undefined && completed >= options.maxScans) break;

    let scan: Awaited<ReturnType<typeof claimNextScan>>;
    try {
      scan = await claimNextScan(prisma);
      consecutiveClaimFailures = 0;
    } catch (error) {
      consecutiveClaimFailures += 1;
      const delay =
        CLAIM_BACKOFF_MS[Math.min(consecutiveClaimFailures - 1, CLAIM_BACKOFF_MS.length - 1)]!;

      log({
        event: "scan_claim_failed",
        error: String(error),
        attempt: consecutiveClaimFailures,
        retry_in: delay,
      });

      if (consecutiveClaimFailures >= MAX_CLAIM_FAILURES && options.maxScans !== undefined) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

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
