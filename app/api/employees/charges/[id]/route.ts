import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

const UpdateChargeSchema = z.object({
  chargeType: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  description: z.string().optional(),
  reason: z.string().optional(),
  date: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(['pending', 'paid', 'partially_paid', 'waived', 'cancelled']).optional(),
  paidAmount: z.coerce.number().nonnegative().optional(),
  paymentDate: z.string().datetime().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * PUT /api/employees/charges/[id]
 * Update an employee charge
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
    const validated = UpdateChargeSchema.parse(body);

    // Check if charge exists
    const existing = await prisma.employeeCharge.findUnique({
      where: { id },
      include: { employmentData: true },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Charge not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const updated = await prisma.employeeCharge.update({
      where: { id },
      data: {
        ...(validated.chargeType && { chargeType: validated.chargeType }),
        ...(validated.amount && { amount: validated.amount }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.reason !== undefined && { reason: validated.reason }),
        ...(validated.date && { date: new Date(validated.date) }),
        ...(validated.dueDate !== undefined && { dueDate: validated.dueDate ? new Date(validated.dueDate) : null }),
        ...(validated.status && { status: validated.status }),
        ...(validated.paidAmount !== undefined && { paidAmount: validated.paidAmount }),
        ...(validated.paymentDate && { paymentDate: new Date(validated.paymentDate) }),
        ...(validated.paymentMethod !== undefined && { paymentMethod: validated.paymentMethod }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
    });

    // Update total charges in employment data
    const totalCharges = await prisma.employeeCharge.aggregate({
      where: {
        employmentDataId: existing.employmentDataId,
        status: { not: 'waived' },
      },
      _sum: { amount: true },
    });

    await prisma.employmentData.update({
      where: { id: existing.employmentDataId },
      data: { totalCharges: totalCharges._sum.amount || 0 },
    });

    return NextResponse.json(
      successResponse({ data: { charge: updated } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EmployeeCharge PUT]', error);
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
 * DELETE /api/employees/charges/[id]
 * Delete an employee charge
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

    const charge = await prisma.employeeCharge.findUnique({
      where: { id },
    });

    if (!charge) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Charge not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    await prisma.employeeCharge.delete({
      where: { id },
    });

    // Update total charges
    const totalCharges = await prisma.employeeCharge.aggregate({
      where: {
        employmentDataId: charge.employmentDataId,
        status: { not: 'waived' },
      },
      _sum: { amount: true },
    });

    await prisma.employmentData.update({
      where: { id: charge.employmentDataId },
      data: { totalCharges: totalCharges._sum.amount || 0 },
    });

    return NextResponse.json(
      successResponse({ data: { message: 'Charge deleted' } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EmployeeCharge DELETE]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
