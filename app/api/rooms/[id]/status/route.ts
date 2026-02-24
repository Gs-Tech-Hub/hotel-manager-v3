/**
 * POST /api/rooms/[id]/status
 * Update room status: AVAILABLE, OCCUPIED, CLEANING, MAINTENANCE, BLOCKED
 * This endpoint manages the room state for availability and booking logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, hasAnyRole, loadUserWithRoles } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/auth/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Check permission
    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      );
    }

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'rooms.manage', 'rooms');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    // Get current unit
    const unit = await prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Room not found'),
        { status: 404 }
      );
    }

    const body = await request.json();
    const { status, reason, notes } = body;

    // Validate status
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.BAD_REQUEST,
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        ),
        { status: 400 }
      );
    }

    // Prevent invalid transitions
    const currentStatus = unit.status;

    // Can't mark as occupied without an active reservation
    if (status === 'OCCUPIED') {
      const activeReservation = await prisma.reservation.findFirst({
        where: {
          unitId: id,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        },
      });

      if (!activeReservation) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.CONFLICT,
            'Cannot mark room as occupied without an active reservation'
          ),
          { status: 409 }
        );
      }
    }

    // Update unit status
    const updated = await prisma.unit.update({
      where: { id },
      data: {
        status,
        statusUpdatedAt: new Date(),
        ...(notes && { notes }),
      },
      include: {
        roomType: true,
        department: true,
      },
    });

    // Log status history
    await prisma.unitStatusHistory.create({
      data: {
        unitId: id,
        previousStatus: currentStatus,
        newStatus: status,
        reason: reason || `Status changed to ${status}`,
        changedBy: ctx.userId,
      },
    });

    // Audit log
    await logAudit({
      userId: ctx.userId,
      action: 'unit_status_updated',
      resourceType: 'unit',
      resourceId: id,
      changes: { status: `${currentStatus} → ${status}`, reason },
    });

    return NextResponse.json(
      successResponse({
        data: updated,
        message: `Room status updated to ${status}`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating room status:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update room status';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
