/**
 * RBAC Service
 * 
 * Core permission checking and role management utilities.
 * Works with the unified Permission, Role, UserRole models.
 * 
 * Usage:
 *   const hasPermission = await checkPermission(ctx, 'orders.create', 'orders');
 *   const perms = await getUserPermissions(ctx);
 *   const roles = await getUserRoles(ctx);
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface PermissionContext {
  userId: string;
  userType: "admin" | "employee" | "other";
  departmentId?: string | null;
}

/**
 * Check if a user has a specific permission.
 * Checks both direct user permissions and role-based permissions.
 * 
 * @param ctx User context (id, type, optional department)
 * @param action Permission action (e.g., "orders.create")
 * @param subject Optional permission subject (e.g., "orders")
 * @returns true if permission is granted, false otherwise
 */
export async function checkPermission(
  ctx: PermissionContext,
  action: string,
  subject?: string | null
): Promise<boolean> {
  try {
    // Check 1: Direct user permissions (bypasses role)
    const userPermission = await prisma.userPermission.findFirst({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
        permission: {
          action,
          subject: subject || null,
        },
        // Match department scope
        departmentId: ctx.departmentId || null,
      },
    });

    if (userPermission) {
      return true;
    }

    // Check 2: Global user permissions (no department scope)
    if (ctx.departmentId) {
      const globalUserPermission = await prisma.userPermission.findFirst({
        where: {
          userId: ctx.userId,
          userType: ctx.userType,
          permission: {
            action,
            subject: subject || null,
          },
          departmentId: null,
        },
      });

      if (globalUserPermission) {
        return true;
      }
    }

    // Check 3: Role-based permissions (department-scoped)
    const rolePermission = await prisma.userRole.findFirst({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
        departmentId: ctx.departmentId || null,
        role: {
          rolePermissions: {
            some: {
              permission: {
                action,
                subject: subject || null,
              },
            },
          },
        },
      },
    });

    if (rolePermission) {
      return true;
    }

    // Check 4: Global role permissions (no department scope)
    if (ctx.departmentId) {
      const globalRolePermission = await prisma.userRole.findFirst({
        where: {
          userId: ctx.userId,
          userType: ctx.userType,
          departmentId: null,
          role: {
            rolePermissions: {
              some: {
                permission: {
                  action,
                  subject: subject || null,
                },
              },
            },
          },
        },
      });

      if (globalRolePermission) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Get all permissions for a user (direct + role-based).
 * Returns array of permission strings in format "action:subject".
 * 
 * @param ctx User context
 * @returns Array of permission strings
 */
export async function getUserPermissions(
  ctx: PermissionContext
): Promise<string[]> {
  try {
    const permissions = new Set<string>();

    // Fetch direct user permissions
    const userPerms = await prisma.userPermission.findMany({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
      },
      select: {
        permission: {
          select: { action: true, subject: true },
        },
      },
    });

    userPerms.forEach((up) => {
      const key = `${up.permission.action}:${up.permission.subject || ""}`;
      permissions.add(key);
    });

    // Fetch role-based permissions
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
      },
      select: {
        role: {
          select: {
            rolePermissions: {
              select: {
                permission: {
                  select: { action: true, subject: true },
                },
              },
            },
          },
        },
      },
    });

    userRoles.forEach((ur) => {
      ur.role.rolePermissions.forEach((rpm) => {
        const key = `${rpm.permission.action}:${rpm.permission.subject || ""}`;
        permissions.add(key);
      });
    });

    return Array.from(permissions);
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return [];
  }
}

/**
 * Get all roles assigned to a user.
 * 
 * @param ctx User context
 * @returns Array of role objects with metadata
 */
export async function getUserRoles(ctx: PermissionContext) {
  try {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
      },
      include: {
        role: true,
        department: true,
      },
    });

    return userRoles;
  } catch (error) {
    console.error("Error fetching user roles:", error);
    return [];
  }
}

/**
 * Check if a user has a specific role.
 * 
 * @param ctx User context
 * @param roleCode Role code (e.g., "admin.super", "employee.default")
 * @param departmentId Optional department scope
 * @returns true if user has the role
 */
export async function hasRole(
  ctx: PermissionContext,
  roleCode: string,
  departmentId?: string | null
): Promise<boolean> {
  try {
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
        role: {
          code: roleCode,
        },
        departmentId: departmentId || null,
      },
    });

    return !!userRole;
  } catch (error) {
    console.error("Error checking role:", error);
    return false;
  }
}

/**
 * Grant a role to a user.
 * 
 * @param targetUserId User receiving the role
 * @param userType Target user type
 * @param roleId Role ID to grant
 * @param grantedBy Admin user granting the role
 * @param departmentId Optional department scope
 */
export async function grantRole(
  targetUserId: string,
  userType: "admin" | "employee" | "other",
  roleId: string,
  grantedBy: string,
  departmentId?: string | null
) {
  try {
    const userRole = await prisma.userRole.create({
      data: {
        userId: targetUserId,
        userType,
        roleId,
        departmentId: departmentId || null,
        grantedAt: new Date(),
        grantedBy,
      },
      include: {
        role: true,
      },
    });

    console.log(
      `[AUDIT] Role granted: ${grantedBy} → ${targetUserId} (${userRole.role.code})`
    );

    return userRole;
  } catch (error) {
    console.error("Error granting role:", error);
    throw error;
  }
}

/**
 * Revoke a role from a user.
 * 
 * @param targetUserId User losing the role
 * @param userType Target user type
 * @param roleId Role ID to revoke
 * @param revokedBy Admin user revoking the role
 * @param departmentId Optional department scope
 */
export async function revokeRole(
  targetUserId: string,
  userType: "admin" | "employee" | "other",
  roleId: string,
  revokedBy: string,
  departmentId?: string | null
) {
  try {
    const userRole = await prisma.userRole.updateMany({
      where: {
        userId: targetUserId,
        userType,
        roleId,
        departmentId: departmentId || null,
      },
      data: {
        revokedAt: new Date(),
        revokedBy,
      },
    });

    console.log(
      `[AUDIT] Role revoked: ${revokedBy} ← ${targetUserId} (roleId: ${roleId})`
    );

    return userRole;
  } catch (error) {
    console.error("Error revoking role:", error);
    throw error;
  }
}

/**
 * Grant a direct permission to a user (bypasses roles).
 * 
 * @param targetUserId User receiving the permission
 * @param userType Target user type
 * @param permissionId Permission ID to grant
 * @param grantedBy Admin user granting permission
 * @param departmentId Optional department scope
 */
export async function grantPermission(
  targetUserId: string,
  userType: "admin" | "employee" | "other",
  permissionId: string,
  grantedBy: string,
  departmentId?: string | null
) {
  try {
    const userPermission = await prisma.userPermission.create({
      data: {
        userId: targetUserId,
        userType,
        permissionId,
        departmentId: departmentId || null,
        grantedAt: new Date(),
        grantedBy,
      },
      include: {
        permission: true,
      },
    });

    console.log(
      `[AUDIT] Permission granted: ${grantedBy} → ${targetUserId} (${userPermission.permission.action})`
    );

    return userPermission;
  } catch (error) {
    console.error("Error granting permission:", error);
    throw error;
  }
}

/**
 * Get all available roles in the system.
 * 
 * @param type Optional filter by role type (admin, employee, etc.)
 * @returns Array of role objects
 */
export async function getAllRoles(type?: string) {
  try {
    const roles = await prisma.role.findMany({
      where: type ? { type } : undefined,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return roles;
  } catch (error) {
    console.error("Error fetching roles:", error);
    return [];
  }
}

/**
 * Get all available permissions in the system.
 * 
 * @param subject Optional filter by subject
 * @returns Array of permission objects
 */
export async function getAllPermissions(subject?: string) {
  try {
    const permissions = await prisma.permission.findMany({
      where: subject ? { subject } : undefined,
    });

    return permissions;
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return [];
  }
}
