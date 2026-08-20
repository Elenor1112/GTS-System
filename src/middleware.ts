import { NextResponse, type NextRequest } from 'next/server';

/**
 * GTS — edge middleware.
 *
 * This is a CONVENIENCE, not the security boundary. It only checks
 * whether a session cookie is present, so an unauthenticated visitor is
 * bounced to sign-in instead of watching a page render and then fail.
 *
 * It deliberately does NOT validate the session or read permissions:
 * middleware runs on the edge without database access, and a check that
 * cannot consult the database can only ever be a guess. The real
 * enforcement is `requireActor()` / `requirePermission()` inside every
 * page and action, which do query the database. A forged cookie gets
 * past this file and straight into a refusal one layer down.
 */

const SESSION_COOKIE = 'gts_session';

/** Routes reachable without a session. */
const PUBLIC_PATHS = ['/sign-in'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  if (!isPublic && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    // Remember where they were going, so signing in resumes it.
    url.searchParams.set('from', pathname);
    url.searchParams.set('reason', 'expired');
    return NextResponse.redirect(url);
  }

  /*
   * Note what is deliberately NOT here: a bounce off /sign-in for anyone
   * holding a cookie.
   *
   * Cookie presence is not proof of a session, and this layer cannot tell
   * the difference. A stale cookie — one left over from a reseed, a
   * revoked session, or an expired row — would be redirected to
   * /dashboard, which throws UNAUTHENTICATED, which redirects back to
   * /sign-in, which redirects to /dashboard: a loop with no exit and no
   * way for the user to reach the form that would fix it.
   *
   * The sign-in page makes that same decision correctly, because it can
   * query the database: it calls getActor() and forwards only a real
   * actor. Sending an already-signed-in user one extra render of a page
   * that immediately redirects is a far cheaper mistake than locking a
   * signed-out user out of the only route that can let them back in.
   */

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets, the favicon and the API
     * routes — those authenticate themselves and must return 401 JSON
     * rather than a redirect to an HTML page.
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};
