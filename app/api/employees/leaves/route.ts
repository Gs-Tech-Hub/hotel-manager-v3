import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

const CreateLeaveSchema = z.object({
  userId: z.string().min(1),
  leaveType: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  numberOfDays: z.coerce.number().positive(),
  reason: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending'),
  notes: z.string().optional(),
});

/**
 * GET /api/employees/leaves
 * List all employee leaves, optionally filtered by employmentDataId or status
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const employmentDataId = request.nextUrl.searchParams.get('employmentDataId');
    const status = request.nextUrl.searchParams.get('status');
    const limit = request.nextUrl.searchParams.get('limit');
    const offset = request.nextUrl.searchParams.get('offset');

    const where: any = {};
    if (employmentDataId) {
      where.employmentDataId = employmentDataId;
    }
    if (status) {
      where.status = status;
    }

    const leaves = await prisma.employeeLeave.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0,
    });

    const total = await prisma.employeeLeave.count({ where });

    return NextResponse.json(
      successResponse({
        data: {
          leaves,
          pagination: {
            total,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0,
          },
        },
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EmployeeLeaves GET]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/leaves
 * Create a new employee leave request
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const body = await request.json();
    const validated = CreateLeaveSchema.parse(body);

    // Verify the employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id: validated.userId },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Get employment data for this user
    const employmentData = await prisma.employmentData.findUnique({
      where: { userId: validated.userId },
    });

    if (!employmentData) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employment data not found for this employee'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const leave = await prisma.employeeLeave.create({
      data: {
        employmentDataId: employmentData.id,
        leaveType: validated.leaveType,
        startDate: new Date(validated.startDate),
        endDate: new Date(validated.endDate),
        numberOfDays: validated.numberOfDays,
        reason: validated.reason,
        status: validated.status,
        notes: validated.notes,
      },
    });

    return NextResponse.json(
      successResponse({ data: { leave } }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[EmployeeLeaves POST]', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, error.errors[0].message),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
