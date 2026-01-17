import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/src/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/employees/[id]/termination
 * Get termination data for an employee
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

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    if (!employment.termination) {
      return NextResponse.json(
        successResponse({ message: 'Employee is currently active' }),
        { status: 200 }
      );
    }

    return NextResponse.json(successResponse(employment.termination), { status: 200 });
  } catch (error) {
    console.error('[API] Failed to get termination data:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to get termination data'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees/[id]/termination
 * Terminate an employee
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
      terminationDate,
      reason,
      details,
      finalSettlement,
    } = body;

    // Validate required fields
    if (!terminationDate || !reason) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', 'Missing required fields: terminationDate, reason'),
        { status: 400 }
      );
    }

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    // Check if already terminated
    if (employment.termination) {
      return NextResponse.json(
        errorResponse('CONFLICT', 'Employee has already been terminated'),
        { status: 409 }
      );
    }

    // Create termination record
    const termination = await (prisma as any).employeeTermination.create({
      data: {
        employmentDataId: employment.id,
        terminationDate: new Date(terminationDate),
        reason,
        details: details || null,
        finalSettlement: finalSettlement ? parseFloat(finalSettlement.toString()) : 0,
        settlementStatus: 'pending',
      },
    });

    // Update employment status
    await (prisma as any).employmentData.update({
      where: { userId: id },
      data: {
        employmentStatus: 'terminated',
        terminationDate: new Date(terminationDate),
        terminationReason: reason,
        terminationNotes: details || null,
      },
    });

    console.log(`[API] Terminated employee: ${id}`);

    return NextResponse.json(successResponse(termination), { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to terminate employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to terminate employee'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees/[id]/termination
 * Update termination settlement
 */
export async function PUT(
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
      settlementStatus,
      settlementDate,
      notes,
    } = body;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment || !employment.termination) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Termination record not found'),
        { status: 404 }
      );
    }

    const termination = await (prisma as any).employeeTermination.update({
      where: { id: employment.termination.id },
      data: {
        settlementStatus: settlementStatus || employment.termination.settlementStatus,
        settlementDate: settlementDate ? new Date(settlementDate) : employment.termination.settlementDate,
        notes: notes !== undefined ? notes : employment.termination.notes,
      },
    });

    console.log(`[API] Updated termination for employee: ${id}`);

    return NextResponse.json(successResponse(termination), { status: 200 });
  } catch (error: any) {
    console.error('[API] Failed to update termination:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to update termination'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees/[id]/termination
 * Restore a terminated employee (soft restore)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id } = await params;

    // Check if employment data exists
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
      include: { termination: true },
    });

    if (!employment || !employment.termination) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Termination record not found'),
        { status: 404 }
      );
    }

    // Delete termination record
    await (prisma as any).employeeTermination.delete({
      where: { id: employment.termination.id },
    });

    // Restore employment status
    await (prisma as any).employmentData.update({
      where: { userId: id },
      data: {
        employmentStatus: 'active',
        terminationDate: null,
        terminationReason: null,
        terminationNotes: null,
      },
    });

    console.log(`[API] Restored employee: ${id}`);

    return NextResponse.json(
      successResponse({ message: 'Employee restored' }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to restore employee:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to restore employee'),
      { status: 500 }
    );
  }
}
