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
