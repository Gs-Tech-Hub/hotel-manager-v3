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

import { prisma } from "@/lib/auth/prisma";

// Cached schema detection to support both unified RBAC and legacy admin tables
let _schemaDetected = false;
let _hasUnifiedRoles = false; // 'roles' table
let _hasUserRoles = false; // 'user_roles' table
let _hasAdminRoles = false; // 'admin_roles' table

async function detectSchema() {
  if (_schemaDetected) return;
  try {
    const rolesRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'roles'
      ) as exists`;
    _hasUnifiedRoles = Array.isArray(rolesRow) && (rolesRow[0]?.exists || false);

    const userRolesRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_roles'
      ) as exists`;
    _hasUserRoles = Array.isArray(userRolesRow) && (userRolesRow[0]?.exists || false);

    const adminRolesRow: any[] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'admin_roles'
      ) as exists`;
    _hasAdminRoles = Array.isArray(adminRolesRow) && (adminRolesRow[0]?.exists || false);
   
     console.log('[RBAC] Schema detection: _hasUnifiedRoles=', _hasUnifiedRoles, ', _hasUserRoles=', _hasUserRoles, ', _hasAdminRoles=', _hasAdminRoles);
  } catch (err) {
    console.warn("[RBAC] Schema detection failed, defaulting to unified assumptions:", err);
  }

  _schemaDetected = true;
}

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
    await detectSchema();
    console.log(`[RBAC] checkPermission: userId=${ctx.userId}, userType=${ctx.userType}, action=${action}, subject=${subject}`);

    // If legacy admin roles are present and this is an admin user, check legacy admin tables
    // This runs even if unified roles exist, as admin users may only be in the legacy system
    if (_hasAdminRoles && ctx.userType === 'admin') {
      try {
        const admin = await prisma.adminUser.findUnique({
          where: { id: ctx.userId },
          include: { roles: { include: { permissions: true } } },
        });

        if (!admin) {
          // Admin not found in legacy system - might have unified roles
          console.log('[RBAC] Admin user not found in legacy AdminUser table');
        } else {
          console.log(`[RBAC] Found admin user with ${admin.roles?.length || 0} roles`);
          for (const r of admin.roles || []) {
            for (const p of r.permissions || []) {
              // Check for exact match
              if (p.action === action && (p.subject || null) === (subject || null)) {
                console.log(`[RBAC] ✓ Permission granted (admin legacy exact match): ${action}.${subject}`);
                return true;
              }
              // Check for wildcard permission (admin can do anything)
              // Wildcard can be: action='*' subject='*', or action='*' subject=null
              if (p.action === '*' && (p.subject === '*' || p.subject === null)) {
                console.log('[RBAC] ✓ Permission granted (admin wildcard)');
                return true;
              }
            }
          }

          // No permission match found in legacy admin roles
          // Still check unified roles if they exist
          if (!_hasUserRoles) {
            console.log('[RBAC] ✗ No permission match in admin roles and no unified roles table');
            return false;
          }
        }
      } catch (err) {
        console.error('[RBAC] Legacy admin permission check failed:', err);
        // Continue to unified role checks if they exist
        if (!_hasUserRoles) {
          return false;
        }
      }
    }

    // Normalize all possible permission variants for action/subject
    function getPermissionVariants(action: string, subject?: string | null) {
      const variants: { action: string; subject: string | null }[] = [];
      const sub = subject || null;
      // Add original action/subject pair
      variants.push({ action, subject: sub });
      // Add action with no subject
      variants.push({ action, subject: null });

      // If subject is present, add dot/colon variants
      if (sub) {
        // Remove any trailing .subject or :subject from action for base
        let base = action;
        if (action.endsWith('.' + sub)) base = action.slice(0, -1 * (sub.length + 1));
        if (action.endsWith(':' + sub)) base = action.slice(0, -1 * (sub.length + 1));

        // Dot and colon variants
        variants.push({ action: `${base}.${sub}`, subject: null });
        variants.push({ action: `${base}:${sub}`, subject: null });
        // Repeated subject (e.g., orders.read.orders)
        variants.push({ action: `${action}.${sub}`, subject: null });
        variants.push({ action: `${action}:${sub}`, subject: null });
        // Subject as separate
        variants.push({ action: base, subject: sub });
      }

      // If action contains dot/colon, split and add as action/subject
      if (action.includes('.')) {
        const [a, s] = action.split('.');
        if (s) {
          variants.push({ action: a, subject: s });
          variants.push({ action: `${a}.${s}`, subject: null });
          variants.push({ action: `${a}:${s}`, subject: null });
        }
      }
      if (action.includes(':')) {
        const [a, s] = action.split(':');
        if (s) {
          variants.push({ action: a, subject: s });
          variants.push({ action: `${a}:${s}`, subject: null });
          variants.push({ action: `${a}.${s}`, subject: null });
        }
      }

      // Remove duplicates
      const seen = new Set();
      return variants.filter(v => {
        const key = v.action + '|' + v.subject;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Check 1: Direct user permissions (bypasses role)
    const userVariants = getPermissionVariants(action, subject);
    console.log(`[RBAC] Checking ${userVariants.length} permission variants:`, userVariants.map(v => `${v.action}:${v.subject}`).join(', '));
    
    const userPermission = await prisma.userPermission.findFirst({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
        departmentId: ctx.departmentId || null,
        OR: userVariants.map(v => ({ permission: { action: v.action, subject: v.subject } })),
      },
      include: { permission: true },
    });
    if (userPermission) {
      console.log(`[RBAC] ✓ Permission granted (direct user permission): ${userPermission.permission.action}:${userPermission.permission.subject}`);
      return true;
    }

    // Check 2: Global user permissions (no department scope)
    if (ctx.departmentId) {
      const globalUserPermission = await prisma.userPermission.findFirst({
        where: {
          userId: ctx.userId,
          userType: ctx.userType,
          departmentId: null,
          OR: userVariants.map(v => ({ permission: { action: v.action, subject: v.subject } })),
        },
        include: { permission: true },
      });
      if (globalUserPermission) {
        console.log(`[RBAC] ✓ Permission granted (global user permission): ${globalUserPermission.permission.action}:${globalUserPermission.permission.subject}`);
        return true;
      }
    }

    // Check 3: Role-based permissions (department-scoped or global)
    if (ctx.departmentId) {
      const rolePermission = await prisma.userRole.findFirst({
        where: {
          userId: ctx.userId,
          userType: ctx.userType,
          departmentId: ctx.departmentId,
          revokedAt: null,
          role: {
            isActive: true,
            rolePermissions: {
              some: {
                OR: userVariants.map(v => ({ permission: { action: v.action, subject: v.subject } })),
              },
            },
          },
        },
      });
      if (rolePermission) {
        console.log(`[RBAC] ✓ Permission granted (department-scoped role permission)`);
        return true;
      }
    }

    // Check 4: Global role permissions (no department scope)
    console.log(`[RBAC] Checking global role permissions for userId=${ctx.userId}, userType=${ctx.userType}`);
    const globalRolePermission = await prisma.userRole.findFirst({
      where: {
        userId: ctx.userId,
        userType: ctx.userType,
        departmentId: null,
        revokedAt: null,
        role: {
          isActive: true,
          rolePermissions: {
            some: {
              OR: userVariants.map(v => ({ permission: { action: v.action, subject: v.subject } })),
            },
          },
        },
      },
      include: {
        role: true,
      },
    });
    if (globalRolePermission) {
      console.log(`[RBAC] ✓ Permission granted (global role permission) - role: ${globalRolePermission.role.code}`);
      return true;
    }
    
    console.log(`[RBAC] ✗ Permission denied: no matching permissions found for ${action}/${subject}`);

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
    await detectSchema();

    const permissions = new Set<string>();

    // Legacy admin roles: fetch AdminRole -> AdminPermission
    if (!_hasUserRoles && _hasAdminRoles && ctx.userType === 'admin') {
      try {
        const admin = await prisma.adminUser.findUnique({
          where: { id: ctx.userId },
          include: { roles: { include: { permissions: true } } },
        });

        if (!admin) return [];

        for (const role of admin.roles || []) {
          for (const perm of role.permissions || []) {
            const subject = perm.subject || '';
            // Build permission as 'action.subject' for matching UI checks (e.g., 'departments.create')
            if (subject) {
              permissions.add(`${perm.action}.${subject}`);
              permissions.add(`${perm.action}:${subject}`); // legacy format
            } else {
              permissions.add(`${perm.action}`);
            }
          }
        }

        return Array.from(permissions);
      } catch (err) {
        console.error('[RBAC] Failed to fetch legacy admin permissions:', err);
        return [];
      }
    }

    // Unified RBAC (or default)
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
      const subject = up.permission.subject || '';
      // Build permission as 'action.subject' for matching UI checks (e.g., 'inventory_items.create')
      if (subject) {
        permissions.add(`${up.permission.action}.${subject}`);
        permissions.add(`${up.permission.action}:${subject}`); // legacy format
      } else {
        permissions.add(`${up.permission.action}`);
      }
    });

    // Fetch role-based permissions (unified)
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
        const subject = rpm.permission.subject || '';
        // Build permission as 'action.subject' for matching UI checks (e.g., 'departments.create')
        if (subject) {
          permissions.add(`${rpm.permission.action}.${subject}`);
          permissions.add(`${rpm.permission.action}:${subject}`); // legacy format
        } else {
          permissions.add(`${rpm.permission.action}`);
        }
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
): Promise<any> {
  try {
    await detectSchema();

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
      `[AUDIT] Permission granted: ${grantedBy} → ${targetUserId} (${userPermission.permission?.action || permissionId})`
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
