import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth/session";

/**
 * Middleware to protect dashboard routes and admin areas.
 * - Redirects unauthenticated users to `/login`.
 * - Redirects non-admins away from `/dashboard/admin/*` to `/dashboard`.
 */
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = req.nextUrl;

  // Diagnostic logging: record incoming dashboard requests and token presence
  try {
    const tokenPresent = !!req.cookies.get("auth_token")?.value;
    // Use console.error so it appears in dev server logs reliably
    console.error(`[middleware] incoming request: ${pathname} tokenPresent=${tokenPresent}`);
  } catch (err) {
    console.error('[middleware] logging failed', err);
  }

  // Only protect dashboard routes
  // If this is an auth page (login/register/forgot-password) and the user
  // already has a valid session, redirect them to the dashboard to avoid
  // client-side redirect loops.
  const authPages = ["/login", "/register", "/forgot-password"];
  if (authPages.includes(pathname)) {
    const token = req.cookies.get("auth_token")?.value;
    if (token) {
      try {
        const session = await verifyToken(token);
        if (session) {
          const url = req.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      } catch (err) {
        // ignore and allow visiting auth page
      }
    }
    return NextResponse.next();
  }

  // Only protect dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Read access token from cookie
  const token = req.cookies.get("auth_token")?.value;

  if (!token) {
    // Not authenticated — send to login
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  try {
    const session = await verifyToken(token);
    if (!session) {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Restrict admin-only paths
    if (pathname.startsWith("/dashboard/admin") && session.userType !== "admin") {
      // Redirect non-admin to dashboard home
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Allow
    return NextResponse.next();
  } catch (err) {
    console.error("[middleware] token verify error:", err);
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
