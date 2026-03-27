import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const SalaryPaymentSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().optional().default('bank_transfer'),
  notes: z.string().optional(),
});

/**
 * POST /api/employees/salary-payment
 * Process a regular monthly salary payment
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
    const validated = SalaryPaymentSchema.parse(body);

    // Get employee and employment data
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id: validated.employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const employmentData = await prisma.employmentData.findUnique({
      where: { userId: validated.employeeId },
    });

    if (!employmentData) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employment data not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Calculate next salary due date based on frequency
    const today = new Date();
    const nextDueDate = new Date(employmentData.employmentDate);
    
    switch(employmentData.salaryFrequency) {
      case 'weekly':
        nextDueDate.setDate(nextDueDate.getDate() + 7);
        while (nextDueDate <= today) {
          nextDueDate.setDate(nextDueDate.getDate() + 7);
        }
        break;
      case 'bi-weekly':
        nextDueDate.setDate(nextDueDate.getDate() + 14);
        while (nextDueDate <= today) {
          nextDueDate.setDate(nextDueDate.getDate() + 14);
        }
        break;
      case 'monthly':
      default:
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        while (nextDueDate <= today) {
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }
        break;
    }

    // Get latest payment to track history
    const lastPayment = await prisma.salaryPayment.findFirst({
      where: {
        userId: validated.employeeId,
        status: 'completed',
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Create payment record
    const payment = await prisma.salaryPayment.create({
      data: {
        userId: validated.employeeId,
        paymentDate: new Date(),
        grossSalary: new Decimal(validated.amount),
        deductions: new Decimal(0),
        netSalary: new Decimal(validated.amount),
        paymentMethod: validated.paymentMethod,
        status: 'completed',
        notes: validated.notes || null,
        salaryDueDate: nextDueDate,
      },
    });

    return NextResponse.json(
      successResponse({
        data: {
          payment,
          message: 'Salary payment processed successfully',
          paymentSummary: {
            amount: validated.amount,
            paymentDate: new Date().toISOString(),
            nextDueDate: nextDueDate.toISOString(),
            paymentMethod: validated.paymentMethod,
          },
        },
      }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[SalaryPayment POST]', error);
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
