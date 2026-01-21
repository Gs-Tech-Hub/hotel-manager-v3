import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

const CreateChargeSchema = z.object({
  userId: z.string().min(1),
  chargeType: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  reason: z.string().optional(),
  date: z.string().datetime(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['pending', 'paid', 'partially_paid', 'waived', 'cancelled']).default('pending'),
  notes: z.string().optional(),
});

/**
 * GET /api/employees/charges
 * List all employee charges, optionally filtered by employmentDataId
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

    const charges = await prisma.employeeCharge.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0,
    });

    const total = await prisma.employeeCharge.count({ where });

    return NextResponse.json(
      successResponse({
        data: {
          charges,
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
    console.error('[EmployeeCharges GET]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/charges
 * Create a new employee charge
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
    const validated = CreateChargeSchema.parse(body);

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

    const charge = await prisma.employeeCharge.create({
      data: {
        employmentDataId: employmentData.id,
        chargeType: validated.chargeType,
        amount: validated.amount,
        description: validated.description,
        reason: validated.reason,
        date: new Date(validated.date),
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        status: validated.status,
        notes: validated.notes,
      },
    });

    // Update total charges in employment data
    const totalCharges = await prisma.employeeCharge.aggregate({
      where: {
        employmentDataId: employmentData.id,
        status: { not: 'waived' },
      },
      _sum: { amount: true },
    });

    await prisma.employmentData.update({
      where: { id: employmentData.id },
      data: { totalCharges: totalCharges._sum.amount || 0 },
    });

    return NextResponse.json(
      successResponse({ data: { charge } }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[EmployeeCharges POST]', error);
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
