import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import {
  calculateEmployeeSalary,
  calculateEmployeeSalaryByDays,
  getEmployeeSalaryHistory,
  getOutstandingSalary,
  getEmployeeDaysWorked,
} from '@/src/services/salary.service';
import { z } from 'zod';

const CalculateSalarySchema = z.object({
  employeeId: z.string().min(1),
  payEarly: z.boolean().optional().default(false),
  upToDate: z.string().datetime().optional(), // For early termination, calculate up to date
});

const ProcessSalaryPaymentSchema = z.object({
  employeeId: z.string().min(1),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  payEarly: z.boolean().optional().default(false),
});

/**
 * GET /api/employees/[id]/salary/calculate
 * Calculate salary for an employee based on days worked
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const { id: employeeId } = await params;
    const payEarly = request.nextUrl.searchParams.get('payEarly') === 'true';
    const upToDate = request.nextUrl.searchParams.get('upToDate');
    const action = request.nextUrl.searchParams.get('action');

    // Route to different actions based on query param
    if (action === 'history') {
      return getHistoryAction(request, employeeId);
    }
    if (action === 'outstanding') {
      return getOutstandingAction(request, employeeId);
    }

    // Default: calculate salary based on days worked
    try {
      // Get current month's days worked
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const daysWorked = await getEmployeeDaysWorked(employeeId, monthStart, monthEnd);

      const calculation = await calculateEmployeeSalaryByDays(
        employeeId,
        daysWorked,
        upToDate ? new Date(upToDate) : undefined
      );

      return NextResponse.json(
        successResponse({ data: { salary: calculation, daysWorked } }),
        { status: 200 }
      );
    } catch (error: any) {
      // Fallback to fixed salary calculation if days-based fails
      const calculation = await calculateEmployeeSalary({
        employeeId,
        payEarly,
        upToDate: upToDate ? new Date(upToDate) : undefined,
      });

      return NextResponse.json(
        successResponse({ data: { salary: calculation } }),
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('[Salary Calculate]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

async function getHistoryAction(request: NextRequest, employeeId: string) {
  try {
    const fromDate = request.nextUrl.searchParams.get('fromDate');
    const toDate = request.nextUrl.searchParams.get('toDate');

    const history = await getEmployeeSalaryHistory(
      employeeId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined
    );

    return NextResponse.json(
      successResponse({ data: { salaryHistory: history } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Salary History]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

async function getOutstandingAction(request: NextRequest, employeeId: string) {
  try {
    const upToDate = request.nextUrl.searchParams.get('upToDate');

    const outstanding = await getOutstandingSalary(
      employeeId,
      upToDate ? new Date(upToDate) : undefined
    );

    return NextResponse.json(
      successResponse({ data: { outstandingSalary: outstanding } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Salary Outstanding]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/[id]/salary
 * Process salary payment for an employee
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const { id: employeeId } = await params;
    const body = await request.json();
    const validated = ProcessSalaryPaymentSchema.parse(body);

    // Calculate salary
    const calculation = await calculateEmployeeSalary({
      employeeId,
      payEarly: validated.payEarly,
    });

    // Create payment record
    const payment = await prisma.salaryPayment.create({
      data: {
        userId: employeeId,
        paymentDate: new Date(),
        grossSalary: calculation.grossSalary,
        deductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
        paymentMethod: validated.paymentMethod || 'transfer',
        status: 'completed',
        notes: validated.notes || null,
        salaryDueDate: calculation.salaryDueDate,
      },
    });

    return NextResponse.json(
      successResponse({ data: { payment, calculation } }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Salary Pay]', error);
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
