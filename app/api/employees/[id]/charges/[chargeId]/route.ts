import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees/[id]/charges/[chargeId]
 * Get a specific charge
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id, chargeId } = await params;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    const charge = await (prisma as any).employeeCharge.findUnique({
      where: { id: chargeId },
    });

    if (!charge || charge.employmentDataId !== employment.id) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Charge not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(successResponse(charge), { status: 200 });
  } catch (error) {
    console.error('[API] Failed to get charge:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to get charge'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees/[id]/charges/[chargeId]
 * Update a charge (payment, status, etc)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id, chargeId } = await params;
    const body = await req.json();
    const {
      paidAmount,
      status,
      paymentDate,
      paymentMethod,
      notes,
    } = body;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    const charge = await (prisma as any).employeeCharge.findUnique({
      where: { id: chargeId },
    });

    if (!charge || charge.employmentDataId !== employment.id) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Charge not found'),
        { status: 404 }
      );
    }

    // Validate paid amount if provided
    const newPaidAmount = paidAmount !== undefined ? parseFloat(paidAmount.toString()) : charge.paidAmount;
    if (newPaidAmount < 0 || newPaidAmount > Number(charge.amount)) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', `Paid amount must be between 0 and ${charge.amount}`),
        { status: 400 }
      );
    }

    // Determine new status if not provided
    let finalStatus = status;
    if (!finalStatus && paidAmount !== undefined) {
      if (newPaidAmount === 0) {
        finalStatus = 'pending';
      } else if (newPaidAmount < Number(charge.amount)) {
        finalStatus = 'partially_paid';
      } else {
        finalStatus = 'paid';
      }
    }

    const updated = await (prisma as any).employeeCharge.update({
      where: { id: chargeId },
      data: {
        paidAmount: newPaidAmount,
        status: finalStatus || charge.status,
        paymentDate: paymentDate ? new Date(paymentDate) : charge.paymentDate,
        paymentMethod: paymentMethod !== undefined ? paymentMethod : charge.paymentMethod,
        notes: notes !== undefined ? notes : charge.notes,
      },
    });

    console.log(`[API] Updated charge ${chargeId} for employee: ${id}`);

    return NextResponse.json(successResponse(updated), { status: 200 });
  } catch (error: any) {
    console.error('[API] Failed to update charge:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to update charge'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees/[id]/charges/[chargeId]
 * Delete a charge
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; chargeId: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id, chargeId } = await params;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    const charge = await (prisma as any).employeeCharge.findUnique({
      where: { id: chargeId },
    });

    if (!charge || charge.employmentDataId !== employment.id) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Charge not found'),
        { status: 404 }
      );
    }

    // Update total charges
    await (prisma as any).employmentData.update({
      where: { userId: id },
      data: {
        totalCharges: {
          decrement: Number(charge.amount),
        },
      },
    });

    await (prisma as any).employeeCharge.delete({
      where: { id: chargeId },
    });

    console.log(`[API] Deleted charge ${chargeId} for employee: ${id}`);

    return NextResponse.json(
      successResponse({ message: 'Charge deleted' }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to delete charge:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to delete charge'),
      { status: 500 }
    );
  }
}
