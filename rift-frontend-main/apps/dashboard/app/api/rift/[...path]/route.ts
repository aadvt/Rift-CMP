import { NextResponse, type NextRequest } from 'next/server';
import { riftFetch, USE_FIXTURES } from '@/lib/api/client';

/**
 * BFF proxy for the handful of calls that must originate in the browser.
 *
 * The access token stays on the server; the browser only ever talks to this
 * origin. Add an allowlist here if you want to constrain which upstream paths
 * a client component can reach.
 */
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const upstream = `/${path.join('/')}${req.nextUrl.search}`;

  if (USE_FIXTURES) {
    return NextResponse.json({ code: 'fixtures_only', message: 'No backend configured. Set RIFT_API_URL.' }, { status: 503 });
  }

  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.json().catch(() => undefined);
    const data = await riftFetch<unknown>(upstream, { method: req.method, body, revalidate: false });
    return NextResponse.json(data);
  } catch (err) {
    const e = err as Error & { riftCode?: string; status?: number };
    return NextResponse.json({ code: e.riftCode ?? 'upstream_error', message: e.message }, { status: e.status ?? 502 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
