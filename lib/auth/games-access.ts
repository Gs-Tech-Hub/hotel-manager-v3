import { prisma } from "@/lib/auth/prisma";
import { checkPermission } from "./rbac";

/**
 * Games access is department-scoped but flexible.
 * 
 * Access is granted if user has:
 * 1. Admin user status (always has access)
 * 2. Department-scoped games_staff role for that specific department
 * 3. Generic games_staff role (any department or no department scope)
 * 4. games.manage or games.read permission via unified RBAC
 */
export async function isGamesStaffForDepartment(userId: string, departmentId: string): Promise<boolean> {
  if (!userId || !departmentId) return false;

  try {
    // 1. Admin bypass
    const admin = await prisma.adminUser.findUnique({ where: { id: userId }, select: { id: true } });
    if (admin) return true;

    // 2. Check for department-scoped games_staff role
    const departmentScopedRole = await prisma.userRole.findFirst({
      where: {
        userId,
        userType: "employee",
        departmentId,
        revokedAt: null,
        role: {
          code: "games_staff",
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (departmentScopedRole) return true;

    // 3. Check for generic games_staff role (without department scoping)
    const genericRole = await prisma.userRole.findFirst({
      where: {
        userId,
        userType: "employee",
        departmentId: null, // No department scope
        revokedAt: null,
        role: {
          code: "games_staff",
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (genericRole) return true;

    // 4. Check for games-specific permissions via unified RBAC
    const hasPermission = await checkPermission(
      {
        userId,
        userType: "employee",
        departmentId,
      },
      "games.manage"
    );
    
    if (hasPermission) return true;

    // Also check for games.read as fallback
    const hasReadPermission = await checkPermission(
      {
        userId,
        userType: "employee",
        departmentId,
      },
      "games.read"
    );

    return hasReadPermission;
  } catch (e) {
    console.error("[GamesAccess] isGamesStaffForDepartment failed:", e);
    return false;
  }
}

/**
 * Generic department access check.
 * Can be reused for other departments (restaurant, bar, housekeeping, reception, service).
 */
export async function isDepartmentStaff(
  userId: string,
  departmentId: string,
  requiredRoleCode: string,
  requiredAction?: string
): Promise<boolean> {
  if (!userId || !departmentId || !requiredRoleCode) return false;

  try {
    // Admin bypass
    const admin = await prisma.adminUser.findUnique({ where: { id: userId }, select: { id: true } });
    if (admin) return true;

    // Check for department-scoped role
    const departmentScopedRole = await prisma.userRole.findFirst({
      where: {
        userId,
        userType: "employee",
        departmentId,
        revokedAt: null,
        role: {
          code: requiredRoleCode,
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (departmentScopedRole) return true;

    // Check for generic role (without department scoping)
    const genericRole = await prisma.userRole.findFirst({
      where: {
        userId,
        userType: "employee",
        departmentId: null,
        revokedAt: null,
        role: {
          code: requiredRoleCode,
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (genericRole) return true;

    // If requiredAction provided, also check permissions
    if (requiredAction) {
      const hasPermission = await checkPermission(
        {
          userId,
          userType: "employee",
          departmentId,
        },
        requiredAction
      );
      if (hasPermission) return true;
    }

    return false;
  } catch (e) {
    console.error(`[DepartmentAccess] isDepartmentStaff(${requiredRoleCode}) failed:`, e);
    return false;
  }
}

// ==================== Department-Specific Helpers ====================

/**
 * Check if user has access to Restaurant department
 */
export async function isRestaurantStaff(userId: string, departmentId: string): Promise<boolean> {
  return isDepartmentStaff(userId, departmentId, "kitchen_staff", "restaurant.manage");
}

/**
 * Check if user has access to Bar department
 */
export async function isBarStaff(userId: string, departmentId: string): Promise<boolean> {
  return isDepartmentStaff(userId, departmentId, "bar_staff", "bar.manage");
}

/**
 * Check if user has access to Housekeeping department
 */
export async function isHousekeepingStaff(userId: string, departmentId: string): Promise<boolean> {
  return isDepartmentStaff(userId, departmentId, "housekeeping_staff", "housekeeping.manage");
}

/**
 * Check if user has access to Reception department
 */
export async function isReceptionStaff(userId: string, departmentId: string): Promise<boolean> {
  return isDepartmentStaff(userId, departmentId, "front_desk", "reception.manage");
}

/**
 * Check if user has access to Service department
 */
export async function isServiceStaff(userId: string, departmentId: string): Promise<boolean> {
  return isDepartmentStaff(userId, departmentId, "customer_service", "service.manage");
}

