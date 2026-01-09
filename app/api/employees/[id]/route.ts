import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/lib/user-context';
import { prisma } from '@/lib/auth/prisma';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Update employee info
    const updated = await prisma.pluginUsersPermissionsUser.update({
      where: { id },
      data: {
        username: username || employee.username,
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
      {
        success: true,
        data: {
          id: updated.id,
          email: updated.email,
          username: updated.username,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to update employee:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update employee' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees/[id]
 * Delete an employee
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Delete user roles first
    await prisma.userRole.deleteMany({
      where: {
        userId: id,
        userType: 'employee',
      },
    });

    // Delete employee
    await prisma.pluginUsersPermissionsUser.delete({
      where: { id },
    });

    console.log(`[API] Deleted employee: ${employee.email} (ID: ${id})`);

    return NextResponse.json(
      {
        success: true,
        message: 'Employee deleted successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to delete employee:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
