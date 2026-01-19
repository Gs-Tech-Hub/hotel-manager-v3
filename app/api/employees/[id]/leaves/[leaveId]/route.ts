import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * PUT /api/employees/[id]/leaves/[leaveId]
 * Approve, reject, or cancel a leave request
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; leaveId: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id, leaveId } = await params;
    const body = await req.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = ['approved', 'rejected', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        errorResponse('BAD_REQUEST', `Status must be one of: ${validStatuses.join(', ')}`),
        { status: 400 }
      );
    }

    // Get employment data
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    // Get and update leave
    const leave = await (prisma as any).employeeLeave.findUnique({
      where: { id: leaveId },
    });

    if (!leave || leave.employmentDataId !== employment.id) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Leave request not found'),
        { status: 404 }
      );
    }

    const updated = await (prisma as any).employeeLeave.update({
      where: { id: leaveId },
      data: {
        status,
        approvedBy: ctx.userId,
        approvalDate: new Date(),
        notes: notes || leave.notes,
      },
    });

    console.log(`[API] ${status} leave request ${leaveId} for employee: ${id}`);

    return NextResponse.json(successResponse(updated), { status: 200 });
  } catch (error: any) {
    console.error('[API] Failed to update leave:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to update leave'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees/[id]/leaves/[leaveId]
 * Cancel a leave request
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; leaveId: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'User not authenticated'), { status: 401 });
    }

    const { id, leaveId } = await params;

    // Get employment data
    const employment = await (prisma as any).employmentData.findUnique({
      where: { userId: id },
    });

    if (!employment) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Employment data not found'),
        { status: 404 }
      );
    }

    // Get and delete leave
    const leave = await (prisma as any).employeeLeave.findUnique({
      where: { id: leaveId },
    });

    if (!leave || leave.employmentDataId !== employment.id) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Leave request not found'),
        { status: 404 }
      );
    }

    await (prisma as any).employeeLeave.delete({
      where: { id: leaveId },
    });

    console.log(`[API] Deleted leave request ${leaveId} for employee: ${id}`);

    return NextResponse.json(
      successResponse({ message: 'Leave request deleted' }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API] Failed to delete leave:', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', error.message || 'Failed to delete leave'),
      { status: 500 }
    );
  }
}
