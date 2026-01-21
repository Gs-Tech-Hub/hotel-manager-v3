import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { hashPassword } from '@/lib/auth/credentials';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees
 * List employees with their roles and employment data
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status'); // active, inactive, on_leave, terminated
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {};
    if (status) {
      where.employmentData = { employmentStatus: status };
    }
    if (department) {
      where.employmentData = { ...where.employmentData, department };
    }

    try {
      // Fetch employees
      const [employees, total] = await Promise.all([
        prisma.pluginUsersPermissionsUser.findMany({
          where: where.employmentData ? { employmentData: where.employmentData } : {},
          include: {
            employmentData: {
              include: {
                leaves: { where: { status: 'approved' } },
                charges: { where: { status: { in: ['pending', 'partially_paid'] } } },
              },
            },
            employeeSummary: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.pluginUsersPermissionsUser.count({
          where: where.employmentData ? { employmentData: where.employmentData } : {},
        }),
      ]);

      const employeesWithRoles = await Promise.all(
        (employees || []).map(async (emp) => {
          const userRoles = await prisma.userRole.findMany({
            where: {
              userId: emp.id,
              userType: 'employee',
            },
            include: {
              role: true,
              department: true,
            },
          });

          return {
            id: emp.id,
            email: emp.email,
            username: emp.username,
            firstname: emp.firstname,
            lastname: emp.lastname,
            blocked: emp.blocked,
            employmentData: emp.employmentData,
            summary: emp.employeeSummary,
            roles: userRoles.map((ur) => ({
              roleId: ur.role.id,
              roleName: ur.role.name,
              departmentId: ur.departmentId,
              departmentName: ur.department?.name,
            })),
            totalCharges: emp.employmentData?.charges.reduce((sum, c) => sum + Number(c.amount), 0) || 0,
            activeLeaves: emp.employmentData?.leaves.length || 0,
            createdAt: emp.createdAt,
          };
        })
      ) || [];

      return NextResponse.json(
        successResponse({
          data: {
            employees: Array.isArray(employeesWithRoles) ? employeesWithRoles : [],
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
          },
        }),
        { status: 200 }
      );
    } catch (dbError: any) {
      // Handle table-not-exists error gracefully
      if (dbError?.code === 'P2021') {
        console.warn('[API] Employment tables not created yet, returning empty list');
        return NextResponse.json(
          successResponse({
            data: {
              employees: [],
              pagination: { page, limit, total: 0, pages: 0 },
            },
          }),
          { status: 200 }
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error('[API] Failed to list employees:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list employees';
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', errorMessage),
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
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const body = await req.json();
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      roles = [],
      // Employment data fields
      employmentDate,
      position,
      department,
      salary,
      salaryType = 'monthly',
      salaryFrequency = 'monthly',
      contractType,
      reportsTo,
      employmentStatus = 'active',
    } = body;

    // Validate required fields
    if (!email || !username || !password) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', 'Missing required fields: email, username, password'),
        { status: 400 }
      );
    }

    // Check if employee already exists
    const existing = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'Employee with this email already exists'),
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create employee with employment data
    const employee = await prisma.pluginUsersPermissionsUser.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstname: firstName || null,
        lastname: lastName || null,
        blocked: false,
        employmentData: employmentDate || position || salary !== undefined
          ? {
              create: {
                employmentDate: employmentDate ? new Date(employmentDate) : new Date(),
                position: position || 'Staff',
                department: department || null,
                salary: salary !== undefined ? parseFloat(salary.toString()) : 0,
                salaryType,
                salaryFrequency,
                contractType: contractType || null,
                reportsTo: reportsTo || null,
                employmentStatus,
              },
            }
          : undefined,
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
      successResponse({
        data:   {
        id: employee.id,
        email: employee.email,
        username: employee.username,
        firstname: employee.firstname,
        lastname: employee.lastname,
      }}),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API] Failed to create employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to create employee'),
      { status: 500 }
    );
  }
}
