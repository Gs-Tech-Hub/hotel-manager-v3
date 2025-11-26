/**
 * RBAC Middleware
 * 
 * Next.js middleware for enforcing role-based access control.
 * Use with API routes to protect endpoints.
 * 
 * Usage:
 *   export const POST = withPermission(
 *     handler,
 *     'orders.create',
 *     'orders'
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { checkPermission, type PermissionContext } from "./rbac";
import { verifyAuthHeader, extractUserFromHeaders } from "./session";

/**
 * Higher-order function to protect API routes with permission checks.
 * 
 * @param handler The API route handler
 * @param action Required permission action
 * @param subject Optional permission subject
 * @returns Protected handler function
 */
export function withPermission(
  handler: (
    req: NextRequest,
    context: PermissionContext
  ) => Promise<Response>,
  action: string,
  subject?: string
) {
  return async (req: NextRequest) => {
    try {
      // Try to verify JWT from Authorization header first
      const authHeader = req.headers.get("authorization");
      let session = null;

      if (authHeader) {
        session = await verifyAuthHeader(authHeader);
      }

      // If no valid JWT, extract from headers (set by auth middleware)
      const userId = session?.userId || req.headers.get("x-user-id");
      const userType = (session?.userType || req.headers.get("x-user-type")) as
        | "admin"
        | "employee"
        | "other";
      const departmentId = session?.departmentId || req.headers.get("x-department-id");

      // Validate required fields
      if (!userId || !userType) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            message: "User context missing from request headers",
          },
          { status: 401 }
        );
      }

      const ctx: PermissionContext = {
        userId,
        userType,
        departmentId: departmentId || undefined,
      };

      // Check permission
      const allowed = await checkPermission(ctx, action, subject);

      if (!allowed) {
        console.warn(
          `[AUTH] Forbidden: ${userId} (${userType}) tried ${action}:${subject}`
        );

        return NextResponse.json(
          {
            error: "Forbidden",
            message: `You do not have permission to perform this action: ${action}`,
          },
          { status: 403 }
        );
      }

      // Pass request to handler with context
      return handler(req, ctx);
    } catch (error) {
      console.error("[AUTH] Permission check error:", error);

      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: "An error occurred while checking permissions",
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Require multiple permissions (all must be granted).
 * 
 * @param handler The API route handler
 * @param permissions Array of [action, subject?] tuples
 * @returns Protected handler function
 */
export function withPermissions(
  handler: (
    req: NextRequest,
    context: PermissionContext
  ) => Promise<Response>,
  permissions: Array<[string, string?]>
) {
  return async (req: NextRequest) => {
    try {
      const userId = req.headers.get("x-user-id");
      const userType = req.headers.get("x-user-type") as
        | "admin"
        | "employee"
        | "other";
      const departmentId = req.headers.get("x-department-id");

      if (!userId || !userType) {
        return NextResponse.json(
          { error: "Unauthorized", message: "User context missing" },
          { status: 401 }
        );
      }

      const ctx: PermissionContext = {
        userId,
        userType,
        departmentId: departmentId || undefined,
      };

      // Check all permissions
      for (const [action, subject] of permissions) {
        const allowed = await checkPermission(ctx, action, subject);

        if (!allowed) {
          console.warn(
            `[AUTH] Forbidden: ${userId} lacks ${action}:${subject}`
          );

          return NextResponse.json(
            {
              error: "Forbidden",
              message: `Missing required permission: ${action}`,
            },
            { status: 403 }
          );
        }
      }

      return handler(req, ctx);
    } catch (error) {
      console.error("[AUTH] Multi-permission check error:", error);

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Require at least one of multiple permissions.
 * 
 * @param handler The API route handler
 * @param permissions Array of [action, subject?] tuples
 * @returns Protected handler function
 */
export function withAnyPermission(
  handler: (
    req: NextRequest,
    context: PermissionContext
  ) => Promise<Response>,
  permissions: Array<[string, string?]>
) {
  return async (req: NextRequest) => {
    try {
      const userId = req.headers.get("x-user-id");
      const userType = req.headers.get("x-user-type") as
        | "admin"
        | "employee"
        | "other";
      const departmentId = req.headers.get("x-department-id");

      if (!userId || !userType) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const ctx: PermissionContext = {
        userId,
        userType,
        departmentId: departmentId || undefined,
      };

      // Check any permission
      let hasAny = false;
      for (const [action, subject] of permissions) {
        const allowed = await checkPermission(ctx, action, subject);
        if (allowed) {
          hasAny = true;
          break;
        }
      }

      if (!hasAny) {
        console.warn(
          `[AUTH] Forbidden: ${userId} lacks all required permissions`
        );

        return NextResponse.json(
          { error: "Forbidden", message: "No valid permissions found" },
          { status: 403 }
        );
      }

      return handler(req, ctx);
    } catch (error) {
      console.error("[AUTH] Any-permission check error:", error);

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Validate user authentication (no specific permission required).
 * 
 * @param handler The API route handler
 * @returns Protected handler function
 */
export function withAuth(
  handler: (
    req: NextRequest,
    context: PermissionContext
  ) => Promise<Response>
) {
  return async (req: NextRequest) => {
    try {
      const userId = req.headers.get("x-user-id");
      const userType = req.headers.get("x-user-type") as
        | "admin"
        | "employee"
        | "other";

      if (!userId || !userType) {
        return NextResponse.json(
          { error: "Unauthorized", message: "User not authenticated" },
          { status: 401 }
        );
      }

      const departmentId = req.headers.get("x-department-id");

      const ctx: PermissionContext = {
        userId,
        userType,
        departmentId: departmentId || undefined,
      };

      return handler(req, ctx);
    } catch (error) {
      console.error("[AUTH] Authentication check error:", error);

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}
