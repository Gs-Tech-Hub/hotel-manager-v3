import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { calculateEmployeeSalary } from '@/src/services/salary.service';
import { prisma } from '@/lib/auth/prisma';

/**
 * GET /api/employees/[id]/early-payment-preview
 * Preview early payment amount before processing
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
    const upToDate = request.nextUrl.searchParams.get('upToDate');

    // Get employment data
    const employmentData = await prisma.employmentData.findUnique({
      where: { userId: employeeId },
    });

    if (!employmentData) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Calculate early payment amount
    const calculation = await calculateEmployeeSalary({
      employeeId,
      payEarly: true,
      upToDate: upToDate ? new Date(upToDate) : undefined,
    });

    // Get last payment
    const lastPayment = await prisma.salaryPayment.findFirst({
      where: {
        userId: employeeId,
        status: 'completed',
      },
      orderBy: { paymentDate: 'desc' },
    });

    const preview = {
      employeeId,
      currentDate: new Date(),
      calculatedUpTo: upToDate || calculation.salaryDueDate,
      grossSalary: calculation.grossSalary.toNumber(),
      deductions: calculation.totalDeductions.toNumber(),
      netAmount: calculation.netSalary.toNumber(),
      chargeBreakdown: {
        pending: calculation.chargeDetails.pendingCharges.toNumber(),
        paid: calculation.chargeDetails.paidCharges.toNumber(),
        total: calculation.chargeDetails.totalCharges.toNumber(),
      },
      nextDueDate: calculation.salaryDueDate,
      lastPaymentDate: lastPayment?.paymentDate,
      daysUntilDue: Math.ceil(
        (calculation.salaryDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ),
    };

    // If terminated, include settlement info
    if (employmentData.employmentStatus === 'terminated') {
      const termination = await prisma.employeeTermination.findUnique({
        where: { employmentDataId: employmentData.id },
      });
      if (termination) {
        (preview as any).terminationInfo = {
          terminationDate: termination.terminationDate,
          reason: termination.reason,
          finalSettlement: termination.finalSettlement.toNumber(),
        };
      }
    }

    return NextResponse.json(
      successResponse({ data: { earlyPaymentPreview: preview } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Early Payment Preview]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
