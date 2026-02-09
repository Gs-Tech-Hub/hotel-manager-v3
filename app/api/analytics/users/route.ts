/**
 * User Analytics API
 * Provides user management and activity analytics
 * 
 * GET /api/analytics/users?startDate=2024-01-01&endDate=2024-12-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/lib/date-filter';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canViewReports = await checkPermission(permCtx, 'reports.read', 'reports');
    if (!canViewReports) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch user data
    const [allUsers, newUsers, adminUsers] = await Promise.all([
      prisma.pluginUsersPermissionsUser.findMany({
        include: {
          employmentData: true,
        },
      }),
      prisma.pluginUsersPermissionsUser.findMany({
        where: {
          createdAt: dateFilter,
        },
      }),
      prisma.adminUser.findMany(),
    ]);

    // Calculate user statistics
    const byRole = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byDepartment = new Map<string, number>();

    allUsers.forEach((user: any) => {
      // By role
      user.roles?.forEach((role: any) => {
        const roleName = role.role?.name || 'No Role';
        byRole.set(roleName, (byRole.get(roleName) || 0) + 1);
      });

      // By status
      const status = user.isActive ? 'active' : 'inactive';
      const statusKey = user.blocked ? 'blocked' : status;
      byStatus.set(statusKey, (byStatus.get(statusKey) || 0) + 1);

      // By department
      if (user.employmentData) {
        const dept = (user.employmentData as any).department || 'unassigned';
        byDepartment.set(dept, (byDepartment.get(dept) || 0) + 1);
      }
    });

    const activeUsers = allUsers.filter((u: any) => u.isActive && !u.blocked).length;
    const blockedUsers = allUsers.filter((u: any) => u.blocked).length;
    const inactiveUsers = allUsers.filter((u: any) => !u.isActive).length;

    const report = {
      summary: {
        totalUsers: allUsers.length,
        activeUsers,
        blockedUsers,
        inactiveUsers,
        newUsersThisPeriod: newUsers.length,
        totalAdminUsers: adminUsers.length,
        activationRate: allUsers.length > 0 ? parseFloat(((activeUsers / allUsers.length) * 100).toFixed(2)) : 0,
      },
      byRole: Array.from(byRole.entries()).map(([role, count]) => ({ role, count })),
      byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      byDepartment: Array.from(byDepartment.entries()).map(([department, count]) => ({ department, count })),
      recentUsers: newUsers
        .slice(0, 20)
        .map((u: any) => ({
          id: u.id,
          name: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
          email: u.email,
          createdAt: u.createdAt,
        })),
      users: allUsers
        .map((u: any) => ({
          id: u.id,
          name: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
          email: u.email,
          username: u.username,
          isActive: u.isActive,
          blocked: u.blocked,
          roles: u.roles?.map((r: any) => r.role?.name || 'No Role') || [],
          department: (u.employmentData as any)?.department || 'unassigned',
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        }))
        .slice(0, 100),
    };

    return NextResponse.json(
      successResponse({ data: report }),
      { status: 200 }
    );

  } catch (error) {
    console.error('User report error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate user report'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
