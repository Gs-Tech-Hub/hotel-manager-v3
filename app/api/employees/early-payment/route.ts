import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { PERMISSIONS } from '@/lib/permissions';
import { calculateEmployeeSalary, getOutstandingSalary } from '@/src/services/salary.service';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const EarlyPaymentSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.coerce.number().positive().optional(), // Optional: custom amount for early payout
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  upToDate: z.string().datetime().optional(), // For termination: pay up to termination date
});

/**
 * POST /api/employees/early-payment
 * Process early salary payment
 * Used for:
 * 1. Termination payout - pay outstanding salary up to termination date
 * 2. Management payout - pay salary early (next due date remains fixed)
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

    // Load user with roles for RBAC
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check salary.early_payment permission
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'accountant', 'hr_manager']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const hasEarlyPaymentPermission = await checkPermission(permCtx, PERMISSIONS.SALARY.EARLY_PAYMENT);
    if (!hasEarlyPaymentPermission) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to process early salary payments'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const validated = EarlyPaymentSchema.parse(body);

    // Get employment data
    const employmentData = await prisma.employmentData.findUnique({
      where: { userId: validated.employeeId },
    });

    if (!employmentData) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // CRITICAL: Early payout is ONLY allowed for termination
    // Regular employees cannot receive early payout - only on payment due date
    const isTermination =
      validated.upToDate ||
      employmentData.employmentStatus === 'terminated';

    if (!isTermination) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          'Early payout is not allowed. Salary is only payable on the scheduled payment date.'
        ),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    // Calculate salary to the specified date (termination payout only)
    const calculation = await calculateEmployeeSalary({
      employeeId: validated.employeeId,
      payEarly: true, // Only for termination
      upToDate: validated.upToDate ? new Date(validated.upToDate) : undefined,
    });

    // Get last payment to track payment history
    const lastPayment = await prisma.salaryPayment.findFirst({
      where: {
        userId: validated.employeeId,
        status: 'completed',
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Create payment record
    const paymentAmount = validated.amount 
      ? new Decimal(validated.amount)
      : calculation.netSalary;
    
    const payment = await prisma.salaryPayment.create({
      data: {
        userId: validated.employeeId,
        paymentDate: new Date(),
        grossSalary: paymentAmount,
        deductions: calculation.totalDeductions,
        netSalary: paymentAmount,
        paymentMethod: validated.paymentMethod || 'transfer',
        status: 'completed',
        notes: `${validated.notes ? validated.notes + ' - ' : ''}Termination settlement. Next due: ${calculation.salaryDueDate.toISOString().split('T')[0]}`,
        salaryDueDate: calculation.salaryDueDate,
      },
    });

    console.log(`[Early Payment] Termination payout created: userId=${validated.employeeId}, amount=${paymentAmount.toString()}`);

    // Prepare response
    const response: any = {
      payment,
      calculation,
      lastPaymentDate: lastPayment?.paymentDate,
      nextDueDate: calculation.salaryDueDate,
      paymentSummary: {
        baseAmount: calculation.grossSalary.toNumber(),
        deductions: calculation.totalDeductions.toNumber(),
        netAmount: calculation.netSalary.toNumber(),
        chargeDeductions: calculation.totalChargesDeductions.toNumber(),
        pendingCharges: calculation.chargeDetails.pendingCharges.toNumber(),
      },
    };

    // If this is a termination, include settlement info
    if (
      validated.upToDate ||
      employmentData.employmentStatus === 'terminated'
    ) {
      const termination = await prisma.employeeTermination.findUnique({
        where: { employmentDataId: employmentData.id },
      });

      if (termination) {
        response.termination ={
          terminationDate: termination.terminationDate,
          reason: termination.reason,
          finalSettlement: termination.finalSettlement,
          settlementStatus: termination.settlementStatus,
          settlementDate: termination.settlementDate,
          totalPaymentForTermination: calculation.netSalary.toNumber(),
        };
      }
    }

    return NextResponse.json(
      successResponse({ data: { earlyPayment: response } }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Early Payment]', error);
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
