import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

const UpdateSalaryPaymentSchema = z.object({
  paymentDate: z.string().datetime().optional(),
  grossSalary: z.coerce.number().positive().optional(),
  deductions: z.coerce.number().nonnegative().optional(),
  netSalary: z.coerce.number().positive().optional(),
  paymentMethod: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed']).optional(),
  notes: z.string().optional(),
});

/**
 * PUT /api/employees/salary-payments/[id]
 * Update a salary payment record
 */
export async function PUT(
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

    const { id } = await params;
    const body = await request.json();
    const validated = UpdateSalaryPaymentSchema.parse(body);

    // Check if payment exists
    const existing = await prisma.salaryPayment.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Salary payment not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const updated = await prisma.salaryPayment.update({
      where: { id },
      data: {
        ...(validated.paymentDate && { paymentDate: new Date(validated.paymentDate) }),
        ...(validated.grossSalary && { grossSalary: validated.grossSalary }),
        ...(validated.deductions !== undefined && { deductions: validated.deductions }),
        ...(validated.netSalary && { netSalary: validated.netSalary }),
        ...(validated.paymentMethod && { paymentMethod: validated.paymentMethod }),
        ...(validated.status && { status: validated.status }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
    });

    return NextResponse.json(
      successResponse({ data: { payment: updated } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SalaryPayment PUT]', error);
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

/**
 * DELETE /api/employees/salary-payments/[id]
 * Delete a salary payment record
 */
export async function DELETE(
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

    const { id } = await params;

    const deleted = await prisma.salaryPayment.delete({
      where: { id },
    });

    return NextResponse.json(
      successResponse({ data: { payment: deleted } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[SalaryPayment DELETE]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
