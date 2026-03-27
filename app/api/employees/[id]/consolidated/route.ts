import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import {
  calculateEmployeeSalary,
  getEmployeeSalaryHistory,
  getOutstandingSalary,
} from '@/src/services/salary.service';

/**
 * GET /api/employees/[id]/consolidated
 * Get consolidated employee details including:
 * - Employment info
 * - Current salary calculation
 * - Charge summary and history
 * - Attendance summary
 * - Salary payment history
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

    // 1. Get basic employee info
    const employee = await prisma.pluginUsersPermissionsUser.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        username: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employee not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // 2. Get employment data
    const employmentData = await prisma.employmentData.findUnique({
      where: { userId: employeeId },
    });

    if (!employmentData) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Employment details not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // 3. Get charges summary
    const charges = await prisma.employeeCharge.findMany({
      where: { employmentDataId: employmentData.id },
      orderBy: { date: 'desc' },
    });

    const chargesSummary = {
      total: charges.length,
      totalAmount: charges.reduce((sum, ch) => sum + ch.amount.toNumber(), 0),
      totalPaid: charges.reduce((sum, ch) => sum + ch.paidAmount.toNumber(), 0),
      totalPending: charges.reduce((sum, ch) => {
        if (ch.status === 'pending' || ch.status === 'partially_paid') {
          return sum + (ch.amount.toNumber() - ch.paidAmount.toNumber());
        }
        return sum;
      }, 0),
      byStatus: {
        pending: charges.filter((ch) => ch.status === 'pending').length,
        paid: charges.filter((ch) => ch.status === 'paid').length,
        partially_paid: charges.filter((ch) => ch.status === 'partially_paid').length,
        waived: charges.filter((ch) => ch.status === 'waived').length,
        cancelled: charges.filter((ch) => ch.status === 'cancelled').length,
      },
      byType: charges.reduce(
        (acc, ch) => {
          acc[ch.chargeType] = (acc[ch.chargeType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      recent: charges.slice(0, 5), // Last 5 charges
    };

    // 4. Get salary information
    let salaryInfo: any = null;
    if (
      employmentData.employmentStatus !== 'inactive' &&
      employmentData.employmentStatus !== 'terminated'
    ) {
      try {
        const salaryCalc = await calculateEmployeeSalary({
          employeeId,
        });
        salaryInfo = salaryCalc;
      } catch (err) {
        console.error('Error calculating salary:', err);
      }
    }

    // 5. Get salary payment history
    const salaryHistory = await prisma.salaryPayment.findMany({
      where: { userId: employeeId },
      orderBy: { paymentDate: 'desc' },
      take: 5, // Last 5 payments
    });

    // 6. Get attendance summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceRecords = await prisma.checkIn.findMany({
      where: {
        employeeSummary: {
          userId: employeeId,
        },
        checkInTime: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { checkInTime: 'desc' },
    });

    const attendanceSummary = {
      totalDays: new Set(
        attendanceRecords.map((record) => {
          const date = new Date(record.checkInTime);
          return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        })
      ).size,
      totalCheckIns: attendanceRecords.length,
      totalCheckOuts: attendanceRecords.filter((r) => r.checkOutTime).length,
      totalHours: attendanceRecords.reduce((sum, record) => {
        if (record.checkOutTime) {
          const hours = (
            (record.checkOutTime.getTime() - record.checkInTime.getTime()) /
            (1000 * 60 * 60)
          ).toFixed(2);
          return sum + parseFloat(hours);
        }
        return sum;
      }, 0),
      recent: attendanceRecords.slice(0, 10),
    };

    // 7. Get termination info if applicable
    let terminationInfo = null;
    if (employmentData.employmentStatus === 'terminated') {
      const termination = await prisma.employeeTermination.findUnique({
        where: { employmentDataId: employmentData.id },
      });
      terminationInfo = termination;

      // Get outstanding salary for termination
      if (termination) {
        try {
          const outstanding = await getOutstandingSalary(
            employeeId,
            termination.terminationDate
          );
          salaryInfo = {
            ...salaryInfo,
            outstanding: outstanding,
          };
        } catch (err) {
          console.error('Error calculating outstanding salary:', err);
        }
      }
    }

    // 8. Compile consolidated response
    const consolidated = {
      employee,
      employment: employmentData,
      charges: chargesSummary,
      salary: salaryInfo,
      salaryHistory,
      attendance: attendanceSummary,
      termination: terminationInfo,
      summary: {
        status: employmentData.employmentStatus,
        position: employmentData.position,
        baseSalary: employmentData.salary.toNumber(),
        totalChargesOutstanding: chargesSummary.totalPending,
        nextSalaryDue: salaryInfo?.salaryDueDate || null,
        attendancePercentage: attendanceRecords.length > 0 ? attendanceSummary.totalCheckOuts / attendanceRecords.length : 0,
      },
    };

    return NextResponse.json(
      successResponse({ data: { employee: consolidated } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Consolidated Employee]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
