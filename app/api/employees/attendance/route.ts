import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';
import { PERMISSIONS } from '@/lib/permissions';

const CheckInSchema = z.object({
  employeeId: z.string().min(1),
});

const CheckOutSchema = z.object({
  checkInId: z.string().min(1),
});

/**
 * GET /api/employees/attendance
 * Get attendance records - optionally filtered by employee
 * Returns records with calculated hours worked for completed check-in/check-out cycles
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const employeeId = request.nextUrl.searchParams.get('employeeId');
    const fromDate = request.nextUrl.searchParams.get('fromDate');
    const toDate = request.nextUrl.searchParams.get('toDate');

    console.log('[Attendance GET] Parameters:', { employeeId, fromDate, toDate });

    const whereFilter: any = {};

    // If employeeId is provided, resolve it to employeeSummaryId
    if (employeeId) {
      console.log('[Attendance GET] Looking up EmployeeSummary for userId:', employeeId);
      const employeeSummary = await prisma.employeeSummary.findUnique({
        where: { userId: employeeId },
        select: { id: true },
      });

      console.log('[Attendance GET] EmployeeSummary found:', employeeSummary);

      if (employeeSummary) {
        whereFilter.employeeSummaryId = employeeSummary.id;
      } else {
        // No employee summary found, return empty results
        console.log('[Attendance GET] No EmployeeSummary found, returning empty');
        return NextResponse.json(
          successResponse({ data: { checkIns: [] } }),
          { status: 200 }
        );
      }
    }

    if (fromDate || toDate) {
      whereFilter.checkInTime = {};
      if (fromDate) {
        whereFilter.checkInTime.gte = new Date(fromDate);
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        whereFilter.checkInTime.lte = endDate;
      }
    }

    console.log('[Attendance GET] Where filter:', whereFilter);

    const records = await prisma.checkIn.findMany({
      where: whereFilter,
      include: {
        employeeSummary: {
          include: {
            user: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    });

    console.log('[Attendance GET] Found records:', records.length);

    // Calculate hours worked for each record
    const enrichedRecords = records.map((record) => {
      let hoursWorked = 0;
      let daysCounted = 0;

      if (record.checkOutTime) {
        // Calculate hours between check-in and check-out
        const checkInTime = new Date(record.checkInTime).getTime();
        const checkOutTime = new Date(record.checkOutTime).getTime();
        const durationMs = checkOutTime - checkInTime;
        hoursWorked = durationMs / (1000 * 60 * 60); // Convert milliseconds to hours
        daysCounted = 1; // Each completed cycle = 1 day
      }

      return {
        ...record,
        hoursWorked: parseFloat(hoursWorked.toFixed(2)),
        daysCounted,
      };
    });

    return NextResponse.json(
      successResponse({ data: { checkIns: enrichedRecords } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Attendance GET]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/employees/attendance
 * Check-in employee
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

    // Check attendance.clock_in permission
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff', 'hr_manager']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const hasClockInPermission = await checkPermission(permCtx, PERMISSIONS.ATTENDANCE.CLOCK_IN);
    if (!hasClockInPermission) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to clock in employees'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const validated = CheckInSchema.parse(body);

    // Get or create EmployeeSummary for the employee
    let employeeSummary = await prisma.employeeSummary.findUnique({
      where: { userId: validated.employeeId },
    });

    if (!employeeSummary) {
      // Create if doesn't exist
      employeeSummary = await prisma.employeeSummary.create({
        data: {
          userId: validated.employeeId,
          salary: 0,
          debtShortage: 0,
          finesDebits: 0,
          orderDiscountTotal: 0,
          salaryAdvanced: 0,
        },
      });
    }

    // Check if there's an active check-in (not checked out)
    const activeCheckIn = await prisma.checkIn.findFirst({
      where: {
        employeeSummaryId: employeeSummary.id,
        checkOutTime: null,
      },
    });

    if (activeCheckIn) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          'Employee already has active check-in. Please check out first.'
        ),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    // CRITICAL: Prevent multiple check-ins on the same calendar date
    // Use UTC dates to ensure consistency with database
    const todayUTC = new Date();
    const utcYear = todayUTC.getUTCFullYear();
    const utcMonth = todayUTC.getUTCMonth();
    const utcDate = todayUTC.getUTCDate();
    
    // Create UTC date range: today 00:00:00 to today 23:59:59 UTC
    const todayStart = new Date(Date.UTC(utcYear, utcMonth, utcDate, 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(utcYear, utcMonth, utcDate, 23, 59, 59, 999));

    console.log(`[Attendance Check-in] Checking for existing check-ins for employee ${employeeSummary.id} on ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);

    // Check if employee already has a check-in TODAY (completed or active)
    const existingTodayCheckIn = await prisma.checkIn.findFirst({
      where: {
        employeeSummaryId: employeeSummary.id,
        checkInTime: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        id: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });

    if (existingTodayCheckIn) {
      console.log(`[Attendance Check-in] BLOCKED: Employee already has check-in at ${existingTodayCheckIn.checkInTime.toISOString()}`);
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          `Employee already has a check-in for today (${existingTodayCheckIn.checkInTime.toLocaleTimeString()}). Only one check-in per calendar day allowed.`
        ),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    console.log(`[Attendance Check-in] OK: No existing check-in found. Creating new check-in for employee ${employeeSummary.id}`);
    
    // Create check-in record
    const checkIn = await prisma.checkIn.create({
      data: {
        checkInTime: new Date(),
        employeeSummaryId: employeeSummary.id,
      },
      include: {
        employeeSummary: {
          include: {
            user: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      successResponse({ data: { checkIn } }),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Attendance POST]', error);
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
 * PUT /api/employees/attendance
 * Check-out employee
 */
export async function PUT(request: NextRequest) {
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

    // Check attendance.clock_out permission
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff', 'hr_manager']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const hasClockOutPermission = await checkPermission(permCtx, PERMISSIONS.ATTENDANCE.CLOCK_OUT);
    if (!hasClockOutPermission) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to clock out employees'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const validated = CheckOutSchema.parse(body);

    // Get check-in record
    const checkIn = await prisma.checkIn.findUnique({
      where: { id: validated.checkInId },
      include: {
        employeeSummary: {
          include: {
            user: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!checkIn) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Check-in record not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (checkIn.checkOutTime) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Employee already checked out'),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    // Update check-out time
    const updatedCheckIn = await prisma.checkIn.update({
      where: { id: validated.checkInId },
      data: {
        checkOutTime: new Date(),
      },
      include: {
        employeeSummary: {
          include: {
            user: {
              select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      successResponse({ data: { checkIn: updatedCheckIn } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Attendance PUT]', error);
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
