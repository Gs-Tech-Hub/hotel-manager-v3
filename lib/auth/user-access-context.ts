/**
 * User Context Utilities for RBAC
 *
 * Utilities to extract user context from requests and determine
 * user roles and permissions for access control checks.
 */

import { prisma } from "@/lib/prisma";
import { verifyToken } from "./session";
import type { NextRequest } from "next/server";

export interface UserAccessContext {
  userId: string;
  userType: "admin" | "employee" | "other";
  roles: string[];
  permissions: string[];
  departmentId?: string;
}

/**
 * Extract user context from a request (middleware/API route context).
 *
 * Attempts to get user from:
 * 1. Custom headers (x-user-id, x-user-role, etc.) if set by middleware
 * 2. JWT token in cookies or Authorization header
 */
export async function getUserAccessContext(
  request: NextRequest
): Promise<UserAccessContext | null> {
  try {
    // Try custom headers first (set by middleware)
    const userId = request.headers.get("x-user-id");
    const userType =
      (request.headers.get("x-user-type") as "admin" | "employee" | "other") ||
      "employee";

    if (userId) {
      const deptId = request.headers.get("x-department-id");
      return {
        userId,
        userType,
        roles: [],
        permissions: [],
        departmentId: deptId ? deptId : undefined,
      };
    }

    // Try JWT token
    const token =
      request.cookies.get("auth_token")?.value ||
      request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return null;
    }

    const session = await verifyToken(token);
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      userType: session.userType || "employee",
      roles: [],
      permissions: [],
      departmentId: session.departmentId,
    };
  } catch (err) {
    console.error("[getUserAccessContext] Error:", err);
    return null;
  }
}

/**
 * Load full user with roles and permissions from database.
 *
 * @param userId User ID
 * @param userType User type ("admin" | "employee")
 * @returns User access context with populated roles and permissions
 */
export async function loadUserAccessContext(
  userId: string,
  userType: "admin" | "employee" | "other"
): Promise<UserAccessContext | null> {
  try {
    if (userType === "admin") {
      // Load admin user roles and permissions
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!adminUser) {
        return null;
      }

      const roles = adminUser.roles.map((r) => r.code);
      const permissionsArray = adminUser.roles.flatMap((r) =>
        r.permissions.map((p) => p.action)
      );
      const permissions = Array.from(new Set(permissionsArray)); // Deduplicate

      return {
        userId,
        userType: "admin",
        roles,
        permissions,
      };
    } else {
      // Load employee user roles and permissions via unified RBAC
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      if (!userRoles.length) {
        return null;
      }

      const roles = userRoles.map((ur) => ur.role.code);
      const permissionsArray = userRoles.flatMap((ur) =>
        ur.role.rolePermissions.map((rp) => rp.permission.action)
      );
      const permissions = Array.from(new Set(permissionsArray)); // Deduplicate

      // Get department from first role assignment
      const departmentId = userRoles[0]?.departmentId;

      return {
        userId,
        userType: "employee",
        roles,
        permissions,
        departmentId: userRoles[0]?.departmentId || undefined,
      };
    }
  } catch (err) {
    console.error("[loadUserAccessContext] Error:", err);
    return null;
  }
}

/**
 * Check if user has a specific role.
 */
export function userHasRole(
  context: UserAccessContext,
  roleCode: string
): boolean {
  return context.roles.includes(roleCode);
}

/**
 * Check if user has any of the provided roles.
 */
export function userHasAnyRole(
  context: UserAccessContext,
  roleCodes: string[]
): boolean {
  return roleCodes.some((code) => context.roles.includes(code));
}

/**
 * Check if user has a specific permission.
 */
export function userHasPermission(
  context: UserAccessContext,
  permission: string
): boolean {
  return context.permissions.includes(permission);
}

/**
 * Check if user has any of the provided permissions.
 */
export function userHasAnyPermission(
  context: UserAccessContext,
  permissions: string[]
): boolean {
  return permissions.some((perm) => context.permissions.includes(perm));
}

/**
 * Check if user has all of the provided permissions.
 */
export function userHasAllPermissions(
  context: UserAccessContext,
  permissions: string[]
): boolean {
  return permissions.every((perm) => context.permissions.includes(perm));
}
