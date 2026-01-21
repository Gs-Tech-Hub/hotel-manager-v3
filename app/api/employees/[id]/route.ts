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
 * Update employee and their roles including employment data
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
      // Employment data fields
      position,
      department,
      salary,
      salaryType,
      salaryFrequency,
      contractType,
      reportsTo,
      employmentStatus,
      terminationDate,
      terminationReason,
      terminationNotes,
    } = body;

    // Verify employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id },
      include: { employmentData: true },
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

    try {
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

      // Update employment data if provided
      if (
        position !== undefined ||
        department !== undefined ||
        salary !== undefined ||
        salaryType !== undefined ||
        salaryFrequency !== undefined ||
        contractType !== undefined ||
        reportsTo !== undefined ||
        employmentStatus !== undefined ||
        terminationDate !== undefined ||
        terminationReason !== undefined ||
        terminationNotes !== undefined
      ) {
        if (employee.employmentData) {
          // Update existing employment data
          await prisma.employmentData.update({
            where: { id: employee.employmentData.id },
            data: {
              ...(position !== undefined && { position }),
              ...(department !== undefined && { department }),
              ...(salary !== undefined && { salary: parseFloat(salary.toString()) }),
              ...(salaryType !== undefined && { salaryType }),
              ...(salaryFrequency !== undefined && { salaryFrequency }),
              ...(contractType !== undefined && { contractType }),
              ...(reportsTo !== undefined && { reportsTo }),
              ...(employmentStatus !== undefined && { employmentStatus }),
              ...(terminationDate !== undefined && { terminationDate: terminationDate ? new Date(terminationDate) : null }),
              ...(terminationReason !== undefined && { terminationReason }),
              ...(terminationNotes !== undefined && { terminationNotes }),
            },
          });
        } else {
          // Create employment data if it doesn't exist
          await prisma.employmentData.create({
            data: {
              userId: id,
              employmentDate: new Date(),
              position: position || 'Staff',
              department: department || null,
              salary: salary !== undefined ? parseFloat(salary.toString()) : 0,
              salaryType: salaryType || 'monthly',
              salaryFrequency: salaryFrequency || 'monthly',
              contractType: contractType || null,
              reportsTo: reportsTo || null,
              employmentStatus: employmentStatus || 'active',
            },
          });
        }
      }

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

      // Fetch updated employee with employment data
      const updatedWithEmployment = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { id },
        include: { employmentData: true },
      });

      return NextResponse.json(
        successResponse({
          data: {
            id: updated.id,
            email: updated.email,
            username: updated.username,
            firstname: updated.firstname,
            lastname: updated.lastname,
            employmentData: updatedWithEmployment?.employmentData,
          },
        }),
        { status: 200 }
      );
    } catch (dbError: any) {
      // Handle table-not-exists error gracefully
      if (dbError?.code === 'P2021') {
        console.warn('[API] Employment tables not created yet');
        return NextResponse.json(
          errorResponse('INTERNAL_ERROR', 'Employment tables not initialized. Please contact administrator.'),
          { status: 500 }
        );
      }
      throw dbError;
    }
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
 * Soft delete (deactivate) an employee
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
      include: { employmentData: true },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employee not found'),
        { status: 404 }
      );
    }

    try {
      // Block user account
      await prisma.pluginUsersPermissionsUser.update({
        where: { id },
        data: { blocked: true },
      });

      // Update employment status to inactive
      if (employee.employmentData) {
        await prisma.employmentData.update({
          where: { id: employee.employmentData.id },
          data: {
            employmentStatus: 'inactive',
            terminationDate: new Date(),
          },
        });
      }

      console.log(`[API] Deactivated employee: ${employee.email} (ID: ${id})`);

      return NextResponse.json(
        successResponse({ data: { message: 'Employee deactivated successfully' } }),
        { status: 200 }
      );
    } catch (dbError: any) {
      if (dbError?.code === 'P2021') {
        console.warn('[API] Employment tables not created yet');
        // Still block the user even if employment tables don't exist
        await prisma.pluginUsersPermissionsUser.update({
          where: { id },
          data: { blocked: true },
        });
        return NextResponse.json(
          successResponse({ data: { message: 'Employee account deactivated' } }),
          { status: 200 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('[API] Failed to delete employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to delete employee'),
      { status: 500 }
    );
  }
}
