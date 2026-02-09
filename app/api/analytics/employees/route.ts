/**
 * Employee Analytics API
 * Provides comprehensive employee and human resources analytics
 * 
 * GET /api/analytics/employees?startDate=2024-01-01&endDate=2024-12-31&department=kitchen
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
    const department = searchParams.get('department');

    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch employee data
    const employees = await prisma.pluginUsersPermissionsUser.findMany({
      include: {
        employmentData: true,

      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Apply department filter if provided
    const filteredEmployees = department
      ? employees.filter((e: any) => (e.employmentData as any)?.department === department)
      : employees;

    // Calculate employee statistics
    const byStatus = new Map<string, number>();
    const byDepartment = new Map<string, number>();
    const byRole = new Map<string, number>();
    const leaveBreakdown = new Map<string, number>();

    filteredEmployees.forEach((emp: any) => {
      const status = (emp.employmentData as any)?.employmentStatus || 'unknown';
      const dept = (emp.employmentData as any)?.department || 'unassigned';
      
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
      byDepartment.set(dept, (byDepartment.get(dept) || 0) + 1);
    });

    // Calculate salary and charge data
    const totalSalaryExpense = Math.round((filteredEmployees.reduce((sum: number, emp: any) => {
      if (emp.employmentData) {
        const salary = (emp.employmentData as any).salary || 0;
        return sum + (typeof salary === 'string' ? parseFloat(salary) : salary);
      }
      return sum;
    }, 0)) * 100);

    const totalCharges = 0;
    const outstandingCharges = 0;

    const report = {
      summary: {
        totalEmployees: filteredEmployees.length,
        activeEmployees: filteredEmployees.filter((e: any) => (e.employmentData as any)?.employmentStatus === 'active').length,
        onLeave: 0,
        terminated: filteredEmployees.filter((e: any) => (e.employmentData as any)?.employmentStatus === 'terminated').length,
        totalSalaryExpense,
        totalCharges,
        outstandingCharges,
        averageSalary: filteredEmployees.length > 0 ? Math.round(totalSalaryExpense / filteredEmployees.length) : 0,
      },
      byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      byDepartment: Array.from(byDepartment.entries()).map(([name, count]) => ({ department: name, count })),
      byRole: Array.from(byRole.entries()).map(([name, count]) => ({ role: name, count })),
      leaveBreakdown: Array.from(leaveBreakdown.entries()).map(([type, count]) => ({ type, count })),
      topEarners: filteredEmployees
        .filter((e: any) => e.employmentData)
        .sort((a: any, b: any) => {
          const salaryA = typeof (a.employmentData as any).salary === 'string' ? parseFloat((a.employmentData as any).salary) : (a.employmentData as any).salary;
          const salaryB = typeof (b.employmentData as any).salary === 'string' ? parseFloat((b.employmentData as any).salary) : (b.employmentData as any).salary;
          return salaryB - salaryA;
        })
        .slice(0, 10)
        .map((e: any) => ({
          id: e.id,
          name: `${e.firstname || ''} ${e.lastname || ''}`.trim(),
          salary: e.employmentData ? Math.round((typeof (e.employmentData as any).salary === 'string' ? parseFloat((e.employmentData as any).salary) : (e.employmentData as any).salary) * 100) : 0,
          salaryFrequency: (e.employmentData as any).salaryFrequency || 'monthly',
          department: (e.employmentData as any).department || 'unassigned',
          status: (e.employmentData as any).employmentStatus || 'unknown',
        })),
      employees: filteredEmployees
        .map((e: any) => ({
          id: e.id,
          name: `${e.firstname || ''} ${e.lastname || ''}`.trim(),
          email: e.email,
          salary: e.employmentData ? Math.round((typeof (e.employmentData as any).salary === 'string' ? parseFloat((e.employmentData as any).salary) : (e.employmentData as any).salary) * 100) : 0,
          department: (e.employmentData as any)?.department || 'unassigned',
          status: (e.employmentData as any)?.employmentStatus || 'unknown',
          role: 'No Role',
          charges: 0,
          outstandingCharges: 0,
          joinDate: e.createdAt,
        }))
        .slice(0, 100),
    };

    return NextResponse.json(
      successResponse({ data: report }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Employee report error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate employee report'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
