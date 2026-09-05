import type { NextRequest } from 'next/server';
import { USE_FIXTURES } from '@/lib/api/client';
import { getScan } from '@/lib/api/endpoints';
import { scanAtStage } from '@/lib/api/fixtures';
import type { Scan } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

/**
 * Server-sent events for scan progress.
 *
 * The stepper wants a push, not a poll, and this route is the seam that gives
 * it one. The platform has no event stream of its own — a crawl writes its
 * progress to the database as it goes and the scan endpoint reports it — so the
 * polling happens here, on the server, and each frame that goes out is a
 * complete `Scan` in the product's own shape.
 *
 * That is a better place for the loop than the browser. One request per client
 * becomes one long-lived connection, the platform sees a steady interval it can
 * plan for instead of a tab's worth of timers, and the access token stays where
 * it belongs. The client hook still falls back to interval polling on its own if
 * this connection drops, so nothing depends on the stream surviving.
 *
 * Frames are only sent when something actually changed, so an idle scan costs a
 * heartbeat comment rather than a repeated payload.
 */

/** How often the platform is asked. Slow enough to be polite, fast enough to feel live. */
const INTERVAL_MS = 2_000;
/** A crawl is minutes, not hours. Past this the client's own polling takes over. */
const MAX_DURATION_MS = 15 * 60 * 1000;

export async function GET(req: NextRequest, ctx: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await ctx.params;
  const encoder = new TextEncoder();

  if (USE_FIXTURES) {
    return sse(
      new ReadableStream({
        start(controller) {
          let stage = 1;
          const send = () => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(scanAtStage(stage, scanId))}\n\n`),
            );
            if (stage > 9) {
              clearInterval(timer);
              controller.close();
              return;
            }
            stage += 1;
          };
          send();
          const timer = setInterval(send, 1400);
          req.signal.addEventListener('abort', () => {
            clearInterval(timer);
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          });
        },
      }),
    );
  }

  const startedAt = Date.now();

  return sse(
    new ReadableStream({
      async start(controller) {
        let last = '';
        let closed = false;

        const close = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* the client went away first */
          }
        };

        req.signal.addEventListener('abort', close);

        while (!closed && !req.signal.aborted) {
          let scan: Scan;
          try {
            scan = await getScan(scanId);
          } catch {
            // The platform being briefly unreachable is not a reason to tear
            // down a progress view. Closing the stream hands the client to its
            // own polling, which retries on the same cadence anyway.
            close();
            return;
          }

          const frame = JSON.stringify(scan);
          if (frame !== last) {
            last = frame;
            try {
              controller.enqueue(encoder.encode(`data: ${frame}\n\n`));
            } catch {
              close();
              return;
            }
          } else {
            // A comment keeps proxies from closing an idle connection without
            // the client having to parse a duplicate frame.
            try {
              controller.enqueue(encoder.encode(': still running\n\n'));
            } catch {
              close();
              return;
            }
          }

          if (scan.status !== 'queued' && scan.status !== 'running') {
            close();
            return;
          }

          if (Date.now() - startedAt > MAX_DURATION_MS) {
            close();
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
        }
      },
    }),
  );
}

function sse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx and friends buffer by default, which turns a stream into one
      // large response that arrives when it is already over.
      'X-Accel-Buffering': 'no',
    },
  });
}
