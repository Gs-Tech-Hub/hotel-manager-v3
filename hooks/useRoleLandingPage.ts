/**
 * useRoleLandingPage Hook
 *
 * Automatically redirects users to their role-specific landing page
 * on login or session refresh.
 */

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { getDefaultLandingPage } from "@/lib/auth/role-landing";

const AUTH_ROUTES = ["/login", "/register", "/"];
const PROTECTED_ROUTES = ["/dashboard", "/pos", "/rooms", "/bookings", "/employees", "/inventory", "/departments"];

/**
 * Hook to handle role-based landing page redirection
 * @param enabled - Whether to enable auto-redirect (default: true)
 */
export function useRoleLandingPage(enabled: boolean = true) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!enabled || isLoading) return;

    // Skip if on auth routes or if no user
    if (!user || AUTH_ROUTES.includes(pathname)) {
      return;
    }

    // Determine if current page is a valid protected route
    const isValidProtectedRoute = PROTECTED_ROUTES.some(route => 
      pathname === route || pathname.startsWith(route + "/")
    );

    // If user is on dashboard or similar top-level route, check if they should be redirected
    if (pathname === "/dashboard" || !isValidProtectedRoute) {
      const landingPage = getDefaultLandingPage(user.roles, user.departmentId);
      
      // Redirect if landing page is different from current page
      if (landingPage !== pathname && !pathname.startsWith(landingPage)) {
        router.push(landingPage);
      }
    }
  }, [user, isLoading, pathname, enabled, router]);
}

/**
 * Hook to get the landing page for current user
 */
export function useGetLandingPage() {
  const { user } = useAuth();

  return user ? getDefaultLandingPage(user.roles, user.departmentId) : "/dashboard";
}
