/**
 * RBAC Middleware
 * 
 * Next.js middleware for enforcing role-based access control.
 * Use with API routes to protect endpoints.
 * 
 * Features:
 * - Single permission check
 * - Multiple permissions (all required)
 * - Multiple permissions (any required)
 * - Auth-only (no specific permission required)
 * - Comprehensive logging and error handling
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
import { verifyAuthHeader, extractUserFromHeaders, getSession, validateSession } from "./session";

/**
 * Helper to extract and validate user context from request
 */
async function extractAndValidateContext(
  req: NextRequest
): Promise<{ context: PermissionContext | null; error: NextResponse | null }> {
  try {
    // Try to verify JWT from Authorization header first
    const authHeader = req.headers.get("authorization");
    let session = null;

    if (authHeader) {
      session = await verifyAuthHeader(authHeader);
    }

    // If no valid JWT, try to get from cookies
    if (!session) {
      session = await getSession();
    }

    // If still no session, extract from headers (fallback)
    if (!session) {
      const headerContext = extractUserFromHeaders(req.headers);
      if (headerContext.userId && headerContext.userType) {
        return {
          context: {
            userId: headerContext.userId,
            userType: headerContext.userType as "admin" | "employee",
            departmentId: headerContext.departmentId,
          },
          error: null,
        };
      }
    }

    if (!session) {
      return {
        context: null,
        error: NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required",
          },
          { status: 401 }
        ),
      };
    }

    // Validate session is still active
    const isValid = await validateSession(session);
    if (!isValid) {
      return {
        context: null,
        error: NextResponse.json(
          {
            error: "Unauthorized",
            message: "Session expired or user inactive",
          },
          { status: 401 }
        ),
      };
    }

    const ctx: PermissionContext = {
      userId: session.userId,
      userType: session.userType,
      departmentId: session.departmentId,
    };

    return { context: ctx, error: null };
  } catch (error) {
    console.error("[AUTH] Context extraction error:", error);
    return {
      context: null,
      error: NextResponse.json(
        {
          error: "Internal Server Error",
          message: "Failed to extract user context",
        },
        { status: 500 }
      ),
    };
  }
}

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
      const { context, error } = await extractAndValidateContext(req);

      if (error) {
        return error;
      }

      if (!context) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Invalid context" },
          { status: 401 }
        );
      }

      // Parse permission string if it contains a dot (e.g., "departments.create" -> action="departments", subject="create")
      let permAction = action;
      let permSubject = subject;
      
      if (action.includes('.') && !subject) {
        const [act, subj] = action.split('.');
        permAction = act;
        permSubject = subj;
      }

      // Check permission
      const allowed = await checkPermission(context, permAction, permSubject);

      if (!allowed) {
        console.warn(
          `[AUTH] Forbidden: ${context.userId} (${context.userType}) tried ${permAction}:${permSubject}`
        );

        return NextResponse.json(
          {
            error: "Forbidden",
            message: `You do not have permission to perform this action: ${action}`,
          },
          { status: 403 }
        );
      }

      console.log(
        `[AUTH] Allowed: ${context.userId} (${context.userType}) performed ${permAction}:${permSubject}`
      );

      // Pass request to handler with context
      return handler(req, context);
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
        // Parse permission string if it contains a dot (e.g., "departments.create" -> action="departments", subject="create")
        let permAction = action;
        let permSubject = subject;
        
        if (action.includes('.') && !subject) {
          const [act, subj] = action.split('.');
          permAction = act;
          permSubject = subj;
        }

        const allowed = await checkPermission(ctx, permAction, permSubject);

        if (!allowed) {
          console.warn(
            `[AUTH] Forbidden: ${userId} lacks ${permAction}:${permSubject}`
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
      const { context, error } = await extractAndValidateContext(req);

      if (error) {
        return error;
      }

      if (!context) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Invalid context" },
          { status: 401 }
        );
      }

      console.log(
        `[AUTH] Authenticated: ${context.userId} (${context.userType})`
      );

      return handler(req, context);
    } catch (error) {
      console.error("[AUTH] Authentication check error:", error);

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}
