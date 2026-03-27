import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

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

    const whereFilter: any = employeeId
      ? { employeeSummaryId: employeeId }
      : {};

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
