import { prisma } from "@/lib/auth/prisma";

/**
 * Games access is department-scoped.
 *
 * Admin users always have access.
 */
export async function isGamesStaffForDepartment(userId: string, departmentId: string): Promise<boolean> {
  if (!userId || !departmentId) return false;

  try {
    // Admin bypass
    const admin = await prisma.adminUser.findUnique({ where: { id: userId }, select: { id: true } });
    if (admin) return true;

    const match = await prisma.userRole.findFirst({
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

    return Boolean(match);
  } catch (e) {
    console.error("[GamesAccess] isGamesStaffForDepartment failed:", e);
    return false;
  }
}

