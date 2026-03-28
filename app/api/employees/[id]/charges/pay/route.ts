/**
 * POST /api/employees/[id]/charges/pay
 * Pay outstanding employee charges
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { z } from 'zod';

const PayChargesSchema = z.object({
  chargeIds: z.array(z.string().min(1)),
  totalAmount: z.coerce.number().positive(),
  paymentMethod: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const ctx = await extractUserContext(request);

    // Verify authentication
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load full user with roles for RBAC checks
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Build permission context
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: userWithRoles.isAdmin ? 'admin' : 'employee',
    };

    // Check permission to update employees
    const canUpdateEmployees = await checkPermission(
      permCtx,
      'employees.update',
      'employees'
    );
    if (!canUpdateEmployees) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = PayChargesSchema.parse(body);

    // Verify employee exists
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id: employeeId },
      include: { employmentData: true },
    });

    if (!employee || !employee.employmentData) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Fetch the charges to verify they exist and belong to this employee
    const charges = await prisma.employeeCharge.findMany({
      where: {
        id: { in: validated.chargeIds },
        employmentDataId: employee.employmentData.id,
      },
    });

    if (charges.length === 0) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.NOT_FOUND,
          'No charges found for this employee'
        ),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (charges.length !== validated.chargeIds.length) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.BAD_REQUEST,
          'Some charges were not found or do not belong to this employee'
        ),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    // Calculate the total amount of charges and update them
    let totalPaid = 0;
    const updatedCharges = [];

    // Convert to numbers for calculations
    const chargesWithNumbers = charges.map((c) => ({
      ...c,
      amountNum: Number(c.amount),
      paidAmountNum: Number(c.paidAmount),
    }));

    const totalOutstanding = chargesWithNumbers.reduce(
      (sum, c) => sum + (c.amountNum - c.paidAmountNum),
      0
    );

    for (const charge of chargesWithNumbers) {
      const amountOwed = charge.amountNum - charge.paidAmountNum;
      const proportion = amountOwed / totalOutstanding;
      const paymentForThisCharge = validated.totalAmount * proportion;
      const newPaidAmount = charge.paidAmountNum + paymentForThisCharge;

      const updatedCharge = await prisma.employeeCharge.update({
        where: { id: charge.id },
        data: {
          paidAmount: newPaidAmount,
          status:
            newPaidAmount >= charge.amountNum
              ? 'paid'
              : newPaidAmount > 0
                ? 'partially_paid'
                : 'pending',
          paymentDate: new Date(),
          paymentMethod: validated.paymentMethod,
          notes: validated.notes,
        },
      });

      updatedCharges.push(updatedCharge);
      totalPaid += paymentForThisCharge;
    }

    // Update employment data total charges (remove paid amounts)
    const allChargesUpdate = await prisma.employeeCharge.findMany({
      where: {
        employmentDataId: employee.employmentData.id,
      },
    });

    const totalOutstandingAmount = allChargesUpdate.reduce((sum, c) => {
      const amountNum = Number(c.amount);
      const paidNum = Number(c.paidAmount);
      const status = c.status;
      
      if (status === 'pending' || status === 'partially_paid') {
        return sum + (amountNum - paidNum);
      }
      return sum;
    }, 0);

    await prisma.employmentData.update({
      where: { id: employee.employmentData.id },
      data: {
        totalCharges: totalOutstandingAmount,
      },
    });

    return NextResponse.json(
      successResponse({
        data: {
          chargesUpdated: updatedCharges.length,
          totalPaid,
          charges: updatedCharges,
        },
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Employee Charges Payment POST]', error);
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
