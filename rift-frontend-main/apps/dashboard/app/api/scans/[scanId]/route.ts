import { NextResponse, type NextRequest } from 'next/server';
import { getScan } from '@/lib/api/endpoints';

export const dynamic = 'force-dynamic';

/**
 * One scan, for the polling fallback in `useScanProgress`.
 *
 * The generic `/api/rift/*` proxy passes platform responses through untouched,
 * which is right for it and wrong here: the stepper reads a `Scan` in the
 * product's shape, and the platform's shape is a status plus a set of counts.
 * This route returns what the stream returns, so the two transports are
 * interchangeable and swapping between them cannot change what a screen shows.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await ctx.params;

  try {
    return NextResponse.json(await getScan(scanId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const e = err as Error & { riftCode?: string; status?: number };
    return NextResponse.json(
      { code: e.riftCode ?? 'upstream_error', message: e.message },
      { status: e.status ?? 502 },
    );
  }
}
