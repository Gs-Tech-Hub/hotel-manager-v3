import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, getStatusCode } from '@/lib/api-response';
import { ErrorCodes } from '@/lib/api-response';
import { z } from 'zod';

const UpdateLeaveSchema = z.object({
  leaveType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  numberOfDays: z.coerce.number().positive().optional(),
  reason: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  approvedBy: z.string().optional(),
  approvalDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * PUT /api/employees/leaves/[id]
 * Update an employee leave request
 */
export async function PUT(
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

    const { id } = await params;
    const body = await request.json();
    const validated = UpdateLeaveSchema.parse(body);

    // Check if leave exists
    const existing = await prisma.employeeLeave.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Leave request not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const updated = await prisma.employeeLeave.update({
      where: { id },
      data: {
        ...(validated.leaveType && { leaveType: validated.leaveType }),
        ...(validated.startDate && { startDate: new Date(validated.startDate) }),
        ...(validated.endDate && { endDate: new Date(validated.endDate) }),
        ...(validated.numberOfDays && { numberOfDays: validated.numberOfDays }),
        ...(validated.reason !== undefined && { reason: validated.reason }),
        ...(validated.status && { status: validated.status }),
        ...(validated.approvedBy !== undefined && { approvedBy: validated.approvedBy }),
        ...(validated.approvalDate && { approvalDate: new Date(validated.approvalDate) }),
        ...(validated.notes !== undefined && { notes: validated.notes }),
      },
    });

    return NextResponse.json(
      successResponse({ data: { leave: updated } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EmployeeLeave PUT]', error);
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
 * DELETE /api/employees/leaves/[id]
 * Cancel/delete an employee leave request
 */
export async function DELETE(
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

    const { id } = await params;

    const deleted = await prisma.employeeLeave.delete({
      where: { id },
    });

    return NextResponse.json(
      successResponse({ data: { leave: deleted } }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[EmployeeLeave DELETE]', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error.message),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
