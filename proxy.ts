import { NextResponse, type NextRequest } from "next/server";

// Must match unitprep-api's SESSION_COOKIE_NAME (src/auth/session_cookie.rs)
// exactly -- there's no shared type between the Rust backend and this
// frontend, so this is a plain duplicated constant, the same way API_URL
// and the error-response shape are already coupled by convention rather
// than by a generated type.
const SESSION_COOKIE_NAME = "unitprep_session";

// Reachable with no session at all -- everything else redirects to
// /login without one. /invites/[token] doubles as the (also
// unauthenticated) account-recovery re-enrolment page, so its whole
// subtree is public the same way.
const PUBLIC_PATHS = ["/login", "/invites"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * Coarse gate only: redirects a request with no session cookie at all
 * away from every page that needs one, so a signed-out visitor never
 * even sees a flash of protected UI before its own data fetches 401.
 *
 * Deliberately does NOT verify the cookie is a real, unexpired,
 * unrevoked session -- that would mean an edge-runtime call to the
 * separate backend origin on every navigation, for a check every
 * protected page's own whoAmI() call and every API request's own
 * AuthenticatedUser extractor already make correctly. A stale or forged
 * cookie value gets through this gate and is rejected exactly where
 * authorization actually lives: server-side, per request.
 *
 * The mandatory-TOTP-enrolment redirect (see app/(app)/layout.tsx) is
 * NOT duplicated here -- it depends on `totp_enrolled` from a real
 * whoAmI() call, which is exactly the round trip this gate exists to
 * avoid making on every navigation. The client-side guard is a fine
 * place for it: the cost is one render of a loading state, not a
 * flash of the wrong protected page.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Runs on everything except Next's own static/image assets -- those
  // have no auth-relevant content and gating them would just add
  // latency to every page's own script/image requests for no benefit.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
