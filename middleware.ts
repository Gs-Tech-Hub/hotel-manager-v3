import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth/session";
import {
  getPageAccessRule,
  checkPageAccess,
} from "./lib/auth/page-access";

/**
 * Middleware to protect dashboard routes with RBAC.
 * - Redirects unauthenticated users to `/login`.
 * - Enforces page access rules based on user roles from JWT token.
 * - Redirects unauthorized users to `/dashboard` or `/login`.
 * 
 * NOTE: We intentionally avoid database queries in middleware.
 * Middleware runs in edge runtime where Prisma Accelerate would be required.
 * Instead, we use user data from JWT token and load full context in API routes.
 */
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const { pathname } = req.nextUrl;

  // Diagnostic logging: record incoming dashboard requests and token presence
  try {
    const tokenPresent = !!req.cookies.get("auth_token")?.value;
    console.error(
      `[middleware] incoming request: ${pathname} tokenPresent=${tokenPresent}`
    );
  } catch (err) {
    console.error("[middleware] logging failed", err);
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

  // Only protect dashboard routes — these correspond to the child folders under (dashboard)
  const dashboardPrefixes = [
    "/pos",
    "/pos-terminals",
    "/admin",
    "/bookings",
    "/customers",
    "/dashboard",
    "/departments",
    "/docs",
    "/documentation",
    "/implementation-guide",
    "/inventory",
    "/quick-reference",
    "/rooms",
    "/employees",
    "/discounts",
  ];

  const isDashboardPath = dashboardPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isDashboardPath) {
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
      // Token is invalid or expired
      console.error(`[middleware] Invalid/expired token for path: ${pathname}`);
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Extract user info from JWT token (no database query needed)
    const userRoles = session.roles || [];
    const userPermissions = session.permissions || [];
    const userType = session.userType || "employee";

    // Log admin access for debugging
    if (userType === "admin") {
      console.error(`[middleware] Admin user accessing: ${pathname} (userType: ${userType}, roles: ${userRoles.join(", ")})`);

    // Get page access rule for current pathname
    const pageRule = getPageAccessRule(pathname);

    // Check if user has access based on JWT token data
    const hasAccess = checkPageAccess(
      pageRule,
      userRoles,
      userPermissions,
      userType
    );

    if (!hasAccess) {
      // User doesn't have access to this page
      console.error(
        `[middleware] User ${session.userId} denied access to ${pathname}. Roles: ${userRoles.join(", ")}`
      );
      // Redirect to dashboard
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Set user context headers for downstream API routes
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-type", userType);
    requestHeaders.set("x-user-roles", userRoles.join(","));
    requestHeaders.set("x-user-permissions", userPermissions.join(","));
    if (session.departmentId) {
      requestHeaders.set("x-department-id", session.departmentId);
    }

    // Allow
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    console.error("[middleware] token verify error:", err);
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    "/pos/:path*",
    "/pos-terminals/:path*",
    "/admin/:path*",
    "/bookings/:path*",
    "/customers/:path*",
    "/dashboard/:path*",
    "/departments/:path*",
    "/docs/:path*",
    "/documentation/:path*",
    "/implementation-guide/:path*",
    "/inventory/:path*",
    "/quick-reference/:path*",
    "/rooms/:path*",
    "/employees/:path*",
    "/discounts/:path*",
  ],
};
