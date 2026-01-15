import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { hashPassword } from '@/lib/auth/credentials';

/**
 * GET /api/employees
 * List employees with their roles
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch employees with their roles
    const employees = await prisma.pluginUsersPermissionsUser.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstname: true,
        lastname: true,
        blocked: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Load roles for each employee
    const employeesWithRoles = await Promise.all(
      employees.map(async (emp) => {
        const userRoles = await prisma.userRole.findMany({
          where: {
            userId: emp.id,
            userType: 'employee',
          },
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

        return {
          ...emp,
          roles: userRoles.map((ur) => ({
            roleId: ur.role.id,
            roleName: ur.role.name,
            departmentId: ur.departmentId,
          })),
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: employeesWithRoles,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Failed to list employees:', error);
    return NextResponse.json(
      { error: 'Failed to list employees' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees
 * Create a new employee with optional role assignment
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      roles = [],
    } = body;

    // Validate input
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, username, password' },
        { status: 400 }
      );
    }

    // Check if employee already exists
    const existing = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Employee with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create employee
    const employee = await prisma.pluginUsersPermissionsUser.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstname: firstName || null,
        lastname: lastName || null,
        blocked: false,
      },
    });

    // Assign roles if provided
    if (roles && Array.isArray(roles) && roles.length > 0) {
      await Promise.all(
        roles.map((role: { roleId: string; departmentId?: string }) =>
          prisma.userRole.create({
            data: {
              userId: employee.id,
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

    console.log(`[API] Created employee: ${email} (ID: ${employee.id})`);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: employee.id,
          email: employee.email,
          username: employee.username,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] Failed to create employee:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create employee' },
      { status: 500 }
    );
  }
}

