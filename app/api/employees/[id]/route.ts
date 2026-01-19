import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees/[id]
 * Get detailed employee information including employment, leaves, charges
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;

    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id },
      include: {
        employmentData: {
          include: {
            leaves: { orderBy: { startDate: 'desc' } },
            charges: { orderBy: { date: 'desc' } },
            termination: true,
          },
        },
        employeeSummary: true,
        employeeRecords: { orderBy: { date: 'desc' }, take: 10 },
      },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employee not found'),
        { status: 404 }
      );
    }

    // Get roles
    const userRoles = await prisma.userRole.findMany({
      where: { userId: id, userType: 'employee' },
      include: { role: true, department: true },
    });

    // Calculate totals
    const totalDebt = employee.employmentData?.charges
      .filter((c) => c.status !== 'waived' && c.status !== 'cancelled')
      .reduce((sum, c) => sum + (Number(c.amount) - Number(c.paidAmount)), 0) || 0;

    const totalCharges = employee.employmentData?.charges.length || 0;

    return NextResponse.json(
      successResponse({
        data:  {
        id: employee.id,
        email: employee.email,
        username: employee.username,
        firstname: employee.firstname,
        lastname: employee.lastname,
        blocked: employee.blocked,
        employment: employee.employmentData,
        summary: employee.employeeSummary,
        records: employee.employeeRecords,
        roles: userRoles.map((ur) => ({
          roleId: ur.role.id,
          roleName: ur.role.name,
          departmentId: ur.departmentId,
          departmentName: ur.department?.name,
        })),
        statistics: {
          totalDebt,
          totalCharges,
          approvedLeaves: employee.employmentData?.leaves.filter((l) => l.status === 'approved').length || 0,
          totalLeaves: employee.employmentData?.leaves.length || 0,
        },
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
      }}),
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Failed to get employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to get employee'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees/[id]
 * Update employee and their roles
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      email,
      username,
      firstName,
      lastName,
      roles = [],
    } = body;

    // Verify employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employee not found'),
        { status: 404 }
      );
    }

    // Check email uniqueness if being changed
    if (email && email !== employee.email) {
      const existing = await prisma.pluginUsersPermissionsUser.findFirst({
        where: { email, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          errorResponse('CONFLICT', 'Email already in use'),
          { status: 409 }
        );
      }
    }

    // Update employee info
    const updated = await prisma.pluginUsersPermissionsUser.update({
      where: { id },
      data: {
        username: username || employee.username,
        email: email || employee.email,
        firstname: firstName !== undefined ? firstName : employee.firstname,
        lastname: lastName !== undefined ? lastName : employee.lastname,
      },
    });

    // Update roles: remove old, add new
    if (Array.isArray(roles)) {
      // Remove existing roles
      await prisma.userRole.deleteMany({
        where: {
          userId: id,
          userType: 'employee',
        },
      });

      // Add new roles
      if (roles.length > 0) {
        await Promise.all(
          roles.map((role: { roleId: string; departmentId?: string }) =>
            prisma.userRole.create({
              data: {
                userId: id,
                userType: 'employee',
                roleId: role.roleId,
                departmentId: role.departmentId || null,
                grantedAt: new Date(),
                grantedBy: ctx.userId,
              },
            })
          )
        );
      }
    }

    console.log(`[API] Updated employee: ${updated.email} (ID: ${id})`);

    return NextResponse.json(
      successResponse({
        data:   {
        id: updated.id,
        email: updated.email,
        username: updated.username,
        firstname: updated.firstname,
        lastname: updated.lastname,
      }}),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to update employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to update employee'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees/[id]
 * Soft delete (block) an employee
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;

    // Verify employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employee not found'),
        { status: 404 }
      );
    }

    // Soft delete: just block the employee
    const blocked = await prisma.pluginUsersPermissionsUser.update({
      where: { id },
      data: { blocked: true },
    });

    console.log(`[API] Deactivated employee: ${employee.email} (ID: ${id})`);

    return NextResponse.json(
      successResponse({ message: 'Employee deactivated successfully' }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to delete employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to delete employee'),
      { status: 500 }
    );
  }
}
