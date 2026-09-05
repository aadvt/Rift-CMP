import { NextResponse, type NextRequest } from 'next/server';

/**
 * Keeps signed-out visitors off the dashboard.
 *
 * This checks only that a plausible session cookie is present — middleware runs
 * on the edge, without database access, so it cannot know whether a token is
 * valid, revoked or expired. That check happens where it belongs: the platform
 * resolves the token on every API call, and a rejected one surfaces as a 401 the
 * dashboard turns into a redirect back here.
 *
 * So this is a redirect for the common case, not a security boundary. Forging
 * the cookie gets somebody a dashboard shell whose every request fails.
 *
 * When no backend is configured the app runs on sample data and there is nothing
 * to sign in to, so the guard stands aside rather than locking people out of a
 * demo with a form that cannot succeed.
 */
export function middleware(request: NextRequest) {
  if (!process.env.RIFT_API_URL || process.env.RIFT_USE_FIXTURES === 'true') {
    return NextResponse.next();
  }

  // A static organisation key is a deployment-wide credential with no person
  // attached; where one is configured there is no sign-in to enforce.
  if (process.env.RIFT_API_TOKEN) return NextResponse.next();

  const token = request.cookies.get('rift_session')?.value;
  if (token?.startsWith('ds_')) return NextResponse.next();

  const signin = new URL('/signin', request.url);
  return NextResponse.redirect(signin);
}

export const config = {
  matcher: ['/dashboard/:path*', '/preview/:path*'],
};
