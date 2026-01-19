import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees/[id]/leaves
 * Get all leaves for an employee
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const year = searchParams.get('year');

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

    // Build filter
    const where: any = { employmentDataId: employment.id };
    if (status) {
      where.status = status;
    }
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      where.startDate = { gte: startDate, lte: endDate };
    }

    const leaves = await (prisma as any).employeeLeave.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    // Calculate statistics
    const stats = {
      total: leaves.length,
      pending: leaves.filter((l: any) => l.status === 'pending').length,
      approved: leaves.filter((l: any) => l.status === 'approved').length,
      rejected: leaves.filter((l: any) => l.status === 'rejected').length,
      totalDays: leaves
        .filter((l: any) => l.status === 'approved')
        .reduce((sum: number, l: any) => sum + l.numberOfDays, 0),
    };

    return NextResponse.json(
      successResponse({ data: { leaves, statistics: stats } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] Failed to get leaves:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to get leaves'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees/[id]/leaves
 * Create a new leave request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      leaveType,
      startDate,
      endDate,
      numberOfDays,
      reason,
    } = body;

    // Validate required fields
    if (!leaveType || !startDate || !endDate || !numberOfDays) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', 'Missing required fields'),
        { status: 400 }
      );
    }

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

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', 'Start date must be before end date'),
        { status: 400 }
      );
    }

    // Create leave
    const leave = await (prisma as any).employeeLeave.create({
      data: {
        employmentDataId: employment.id,
        leaveType,
        startDate: start,
        endDate: end,
        numberOfDays,
        reason: reason || null,
        status: 'pending',
      },
    });

    console.log(`[API] Created leave request for employee: ${id}`);

    return NextResponse.json(successResponse(leave), { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to create leave:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to create leave'),
      { status: 500 }
    );
  }
}
