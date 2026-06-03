import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import {
  calculateEmployeeSalaryByDays,
  getOutstandingSalary,
  getEmployeeDaysWorked,
  getEmployeeAbsentDays,
  getEmployeeSalarySchedule,
} from '@/src/services/salary.service';

/**
 * GET /api/employees/[id]/consolidated
 * Get consolidated employee details including:
 * - Employment info
 * - Current salary calculation
 * - Charge summary and history
 * - Attendance summary
 * - Salary payment history
 * Requires: salary.view permission (financial data access)
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

    // Load full user with roles to get userType
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check permission to view salary/financial data
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: userWithRoles.isAdmin ? 'admin' : 'employee',
      departmentId: undefined,
    };
    const canRead = await checkPermission(permCtx, 'salary.view');
    if (!canRead) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view employee financial data'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
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

    const unpaidCharges = charges
      .filter((ch) => ch.status === 'pending' || ch.status === 'partially_paid')
      .map((ch) => {
        const outstanding = ch.amount.toNumber() - ch.paidAmount.toNumber();
        return {
          id: ch.id,
          chargeType: ch.chargeType,
          amount: ch.amount.toNumber(),
          paidAmount: ch.paidAmount.toNumber(),
          outstanding: outstanding,
          status: ch.status,
          date: ch.date.toISOString(),
          description: ch.description,
        };
      });

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    const currentMonthCharges = charges.filter(
      (ch) => ch.date >= monthStart && ch.date <= monthEnd
    );

    const currentMonthUnpaid = currentMonthCharges.filter(
      (ch) => ch.status === 'pending' || ch.status === 'partially_paid'
    );

    const carryoverCharges = charges.filter(
      (ch) => ch.date < monthStart && (ch.status === 'pending' || ch.status === 'partially_paid')
    );

    const carryoverUnpaid = carryoverCharges.map((ch) => ({
      id: ch.id,
      chargeType: ch.chargeType,
      amount: ch.amount.toNumber(),
      paidAmount: ch.paidAmount.toNumber(),
      outstanding: ch.amount.toNumber() - ch.paidAmount.toNumber(),
      status: ch.status,
      date: ch.date.toISOString(),
      description: ch.description,
    }));

    const chargesSummary = {
      total: charges.length,
      totalAmount: charges.reduce((sum, ch) => sum + ch.amount.toNumber(), 0),
      totalPaid: charges.reduce((sum, ch) => sum + ch.paidAmount.toNumber(), 0),
      totalPending: unpaidCharges.reduce((sum, ch) => sum + ch.outstanding, 0),
      currentMonth: {
        totalCharges: currentMonthCharges.length,
        totalAmount: currentMonthCharges.reduce((sum, ch) => sum + ch.amount.toNumber(), 0),
        outstanding: currentMonthUnpaid.reduce(
          (sum, ch) => sum + (ch.amount.toNumber() - ch.paidAmount.toNumber()),
          0
        ),
        paid: currentMonthCharges.reduce((sum, ch) => sum + ch.paidAmount.toNumber(), 0),
        charges: currentMonthCharges.map((ch) => ({
          id: ch.id,
          chargeType: ch.chargeType,
          amount: ch.amount.toNumber(),
          paidAmount: ch.paidAmount.toNumber(),
          outstanding: ch.amount.toNumber() - ch.paidAmount.toNumber(),
          status: ch.status,
          date: ch.date.toISOString(),
          description: ch.description,
        })),
      },
      carryover: {
        totalCharges: carryoverCharges.length,
        totalAmount: carryoverCharges.reduce((sum, ch) => sum + ch.amount.toNumber(), 0),
        outstanding: carryoverCharges.reduce(
          (sum, ch) => sum + (ch.amount.toNumber() - ch.paidAmount.toNumber()),
          0
        ),
        paid: carryoverCharges.reduce((sum, ch) => sum + ch.paidAmount.toNumber(), 0),
        charges: carryoverUnpaid,
      },
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
      unpaid: unpaidCharges,
    };

    // 4. Get salary information (DAYS-BASED CALCULATION)
    let salaryInfo: any = null;
    if (
      employmentData.employmentStatus !== 'inactive' &&
      employmentData.employmentStatus !== 'terminated'
    ) {
      try {
        // Get current month's days worked
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const daysWorked = await getEmployeeDaysWorked(employeeId, monthStart, monthEnd);
        const absentDays = await getEmployeeAbsentDays(employeeId, monthStart, monthEnd);
        const salaryCalc = await calculateEmployeeSalaryByDays(
          employeeId,
          daysWorked
        );
        
        // Format for SalaryModal: wrap in currentSalary property
        // Convert Decimal values to numbers (major units) then to minor units (cents) for consistent formatting
        
        const grossSalaryNum = salaryCalc.grossSalary.toNumber();
        const netSalaryNum = salaryCalc.netSalary.toNumber();
        const deductionsNum = salaryCalc.totalDeductions.toNumber();
        
        salaryInfo = {
          currentSalary: {
            grossSalary: Math.round(grossSalaryNum * 100),
            netSalary: Math.round(netSalaryNum * 100),
            deductions: Math.round(deductionsNum * 100),
            payEarly: salaryCalc.payEarly,
            salaryDueDate: salaryCalc.salaryDueDate,
            absentDays,
          },
          daysWorked,
          absentDays,
          chargeDetails: {
            pendingCharges: Math.round((salaryCalc.chargeDetails?.pendingCharges?.toNumber() || 0) * 100),
            paidCharges: Math.round((salaryCalc.chargeDetails?.paidCharges?.toNumber() || 0) * 100),
          },
        };
      } catch (err) {
        console.error('Error calculating salary:', err);
      }
    }

    // 5. Get salary payment history
    const toCents = (value: any) => {
      const amount = typeof value === 'object' && value?.toNumber ? value.toNumber() : Number(value || 0);
      return Math.round(amount * 100);
    };

    const salaryHistory = await prisma.salaryPayment.findMany({
      where: { userId: employeeId },
      orderBy: { paymentDate: 'desc' },
      take: 5, // Last 5 payments
    });
    const serializedSalaryHistory = salaryHistory.map((payment) => ({
      ...payment,
      grossSalary: toCents(payment.grossSalary),
      netSalary: toCents(payment.netSalary),
    }));

    // 6. Get the employee salary schedule from employment start
    let salaryPeriods: any[] = [];
    try {
      const schedule = await getEmployeeSalarySchedule(employeeId);
      salaryPeriods = schedule.map((period) => ({
        ...period,
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        salaryDueDate: period.salaryDueDate.toISOString(),
        grossSalary: toCents(period.grossSalary),
        deductions: toCents(period.deductions),
        netSalary: toCents(period.netSalary),
        paymentDate: period.paymentDate ? period.paymentDate.toISOString() : undefined,
      }));
    } catch (err) {
      console.error('Error building salary schedule:', err);
    }

    // 7. Get attendance summary (optional date range or last 30 days)
    const fromDate = request.nextUrl.searchParams.get('fromDate');
    const toDate = request.nextUrl.searchParams.get('toDate');

    let attendanceFrom: Date | undefined;
    let attendanceTo: Date | undefined;

    if (fromDate) {
      attendanceFrom = new Date(fromDate);
      attendanceFrom.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      attendanceTo = new Date(toDate);
      attendanceTo.setHours(23, 59, 59, 999);
    }

    if (!attendanceFrom && !attendanceTo) {
      attendanceFrom = new Date();
      attendanceFrom.setDate(attendanceFrom.getDate() - 30);
      attendanceFrom.setHours(0, 0, 0, 0);
      attendanceTo = new Date();
      attendanceTo.setHours(23, 59, 59, 999);
    }

    const attendanceQuery: any = {
      employeeSummary: {
        userId: employeeId,
      },
    };

    if (attendanceFrom || attendanceTo) {
      attendanceQuery.checkInTime = {};
      if (attendanceFrom) attendanceQuery.checkInTime.gte = attendanceFrom;
      if (attendanceTo) attendanceQuery.checkInTime.lte = attendanceTo;
    }

    const attendanceRecords = await prisma.checkIn.findMany({
      where: attendanceQuery,
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
      records: attendanceRecords.map((record) => {
        const checkInTime = new Date(record.checkInTime);
        const checkOutTime = record.checkOutTime ? new Date(record.checkOutTime) : null;
        const duration = checkOutTime
          ? Math.max(0, (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60))
          : 0;
        return {
          id: record.id,
          checkInTime: checkInTime.toISOString(),
          checkOutTime: checkOutTime ? checkOutTime.toISOString() : null,
          attendanceDate: checkInTime.toISOString().slice(0, 10),
          hoursWorked: parseFloat(duration.toFixed(2)),
          status: record.checkOutTime ? 'completed' : 'active',
          missedCheckout: record.checkOutTime ? false : true,
        };
      }),
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
    // Keep structure compatible with both EmployeeConsolidationView and SalaryModal
    const responseData = {
      // Core employee data
      employee,
      employment: employmentData,
      charges: chargesSummary,
      salaryHistory: serializedSalaryHistory,
      attendance: attendanceSummary,
      termination: terminationInfo,
      
      // Salary information (for both SalaryModal and console views)
      salary: salaryInfo,
      currentSalary: salaryInfo?.currentSalary || null,
      daysWorked: salaryInfo?.daysWorked || 0,
      absentDays: salaryInfo?.absentDays || 0,
      chargeDetails: salaryInfo?.chargeDetails || null,
      
      summary: {
        status: employmentData.employmentStatus,
        position: employmentData.position,
        baseSalary: employmentData.salary.toNumber(),
        totalChargesOutstanding: Math.round((chargesSummary?.totalPending || 0) * 100),
        nextSalaryDue: salaryInfo?.currentSalary?.salaryDueDate || null,
        attendancePercentage: attendanceRecords.length > 0 ? attendanceSummary.totalCheckOuts / attendanceRecords.length : 0,
      },
      salaryPeriods,
    };

    return NextResponse.json(
      successResponse({ data: responseData }),
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
