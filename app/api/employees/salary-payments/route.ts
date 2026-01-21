import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

const CreateSalaryPaymentSchema = z.object({
  userId: z.string().min(1),
  paymentDate: z.string().datetime(),
  grossSalary: z.coerce.number().positive(),
  deductions: z.coerce.number().nonnegative().optional().default(0),
  netSalary: z.coerce.number().positive(),
  paymentMethod: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']).default('completed'),
  notes: z.string().nullable().optional().default(null),
  salaryDueDate: z.string().datetime().optional(),
});

/**
 * Calculate next salary due date based on employment date and salary frequency
 */
function calculateNextSalaryDueDate(employmentDate: Date, salaryFrequency: string): Date {
  const today = new Date();
  const dueDate = new Date(employmentDate);
  
  switch(salaryFrequency) {
    case 'weekly':
      dueDate.setDate(dueDate.getDate() + 7);
      break;
    case 'bi-weekly':
      dueDate.setDate(dueDate.getDate() + 14);
      break;
    case 'monthly':
    default:
      dueDate.setMonth(dueDate.getMonth() + 1);
      break;
  }
  
  // If due date is in past, calculate next cycle
  while (dueDate < today) {
    switch(salaryFrequency) {
      case 'weekly':
        dueDate.setDate(dueDate.getDate() + 7);
        break;
      case 'bi-weekly':
        dueDate.setDate(dueDate.getDate() + 14);
        break;
      case 'monthly':
      default:
        dueDate.setMonth(dueDate.getMonth() + 1);
        break;
    }
  }
  
  return dueDate;
}

/**
 * GET /api/employees/salary-payments
 * List all salary payments, optionally filtered by userId
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

    const userId = request.nextUrl.searchParams.get('userId');
    const limit = request.nextUrl.searchParams.get('limit');
    const offset = request.nextUrl.searchParams.get('offset');

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const payments = await prisma.salaryPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0,
    });

    const total = await prisma.salaryPayment.count({ where });

    return NextResponse.json(
      successResponse({
        data: {
          payments,
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
    console.error('[SalaryPayments GET]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/salary-payments
 * Create a new salary payment record
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
    const validated = CreateSalaryPaymentSchema.parse(body);

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

    // Calculate salary due date if not provided
    let salaryDueDate = validated.salaryDueDate ? new Date(validated.salaryDueDate) : null;
    if (!salaryDueDate) {
      const empData = await prisma.employmentData.findUnique({
        where: { userId: validated.userId },
      });
      if (empData) {
        salaryDueDate = calculateNextSalaryDueDate(empData.employmentDate, empData.salaryFrequency);
      }
    }

    const payment = await prisma.salaryPayment.create({
      data: {
        userId: validated.userId,
        paymentDate: new Date(validated.paymentDate),
        grossSalary: validated.grossSalary,
        deductions: validated.deductions,
        netSalary: validated.netSalary,
        paymentMethod: validated.paymentMethod,
        status: validated.status,
        notes: validated.notes || null,
        ...(salaryDueDate && { salaryDueDate }),
      },
    });

    return NextResponse.json(
      successResponse({ data: { payment } }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[SalaryPayments POST]', error);
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
