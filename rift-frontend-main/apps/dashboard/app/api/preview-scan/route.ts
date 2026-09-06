import { NextResponse, type NextRequest } from 'next/server';
import { API_URL, USE_FIXTURES } from '@/lib/api/client';

/**
 * The landing page's route to the preview scanner.
 *
 * It exists instead of the generic `/api/rift/*` proxy for two reasons, both
 * about the fact that the caller is signed out and the work is slow.
 *
 *  - **Time.** `riftFetch` aborts at fifteen seconds, which is the right budget
 *    for a dashboard read and the wrong one for a crawl that is allowed thirty.
 *    Routed through the proxy, a perfectly good scan would be reported as a
 *    timeout for any site slower than half its budget.
 *  - **Surface.** The generic proxy forwards whatever path it is given. Naming
 *    the one unauthenticated call in its own route means the signed-out page can
 *    reach exactly this and nothing else, and a reader can see that at a glance.
 *
 * No credential is attached. The upstream endpoint is public by design, and
 * sending the deployment's `RIFT_API_TOKEN` would quietly turn an anonymous
 * preview into an authenticated call made on somebody else's behalf.
 *
 * The visitor's address is forwarded so the upstream rate limit counts people
 * rather than counting this process. Without it every preview in the world
 * shares one three-a-minute window and the feature stops working the moment two
 * strangers try it at once.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** The crawl gets thirty seconds; this must outlast it or it truncates the answer. */
export const maxDuration = 60;

const UPSTREAM_TIMEOUT_MS = 45_000;

export async function POST(request: NextRequest): Promise<Response> {
  if (USE_FIXTURES) {
    return NextResponse.json(
      {
        code: 'fixtures_only',
        message: 'Scanning is unavailable on this deployment — no Rift API is configured.',
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json({ code: 'invalid_json', message: 'Send a website address.' }, { status: 400 });
  }

  const forwarded =
    request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/api/v1/preview-scan`, {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(forwarded ? { 'x-forwarded-for': forwarded } : {}),
      },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => null);
    if (payload === null) {
      return NextResponse.json(
        { code: 'upstream_error', message: `The scanner responded ${res.status}.` },
        { status: 502 },
      );
    }
    return NextResponse.json(payload, { status: res.status });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          code: 'timeout',
          message: 'That site took longer than a preview allows. It can still be scanned properly from an account.',
        },
        { status: 504 },
      );
    }
    return NextResponse.json({ code: 'network_error', message: 'Could not reach the scanner.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
