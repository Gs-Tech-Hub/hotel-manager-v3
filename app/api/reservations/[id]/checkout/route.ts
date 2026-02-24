/**
 * POST /api/reservations/[id]/checkout
 * Handle guest checkout: mark reservation as checked-out and create cleaning task
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
    const hasAccess = await checkPermission(permCtx, 'reservations.checkout', 'reservations');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    // Get reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        unit: {
          include: { roomType: true, department: true },
        },
        guest: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      );
    }

    // Verify reservation is checked in
    if (reservation.status !== 'CHECKED_IN') {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          `Cannot checkout a reservation with status ${reservation.status}. Must be CHECKED_IN.`
        ),
        { status: 409 }
      );
    }

    const body = await request.json();
    const {
      notes,
      cleaningRoutineId,
      cleaningPriority,
      assignCleanerTo,
      checkoutNotes,
    } = body;

    // Update reservation status
    const updatedReservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        checkOutTime: new Date(),
        ...(checkoutNotes && { notes: checkoutNotes }),
      },
      include: {
        unit: true,
        guest: true,
      },
    });

    // Get cleaning routine for this room type
    let cleaningRoutine = null;
    if (cleaningRoutineId) {
      cleaningRoutine = await prisma.cleaningRoutine.findUnique({
        where: { id: cleaningRoutineId },
      });
    } else {
      // Find default turnover routine for this room type
      cleaningRoutine = await prisma.cleaningRoutine.findFirst({
        where: {
          type: 'TURNOVER',
          isActive: true,
          frequency: 'EVERY_CHECKOUT',
          roomTypes: {
            some: { id: reservation.unit.roomTypeId },
          },
        },
      });
    }

    // Create cleaning task
    const cleaningTask = await prisma.cleaningTask.create({
      data: {
        unitId: reservation.unitId,
        routineId: cleaningRoutine?.id,
        taskType: 'turnover',
        priority: cleaningPriority || cleaningRoutine?.priority || 'NORMAL',
        assignedToId: assignCleanerTo,
        notes: notes || `Turnover cleaning after ${reservation.guest.firstName} ${reservation.guest.lastName} checkout`,
      },
      include: {
        unit: { include: { roomType: true } },
        routine: true,
      },
    });

    // Update room status to CLEANING
    const previousStatus = reservation.unit.status;
    await prisma.unit.update({
      where: { id: reservation.unitId },
      data: {
        status: 'CLEANING',
        statusUpdatedAt: new Date(),
      },
    });

    // Log status change
    await prisma.unitStatusHistory.create({
      data: {
        unitId: reservation.unitId,
        previousStatus: previousStatus,
        newStatus: 'CLEANING',
        reason: `Guest checkout - turnover cleaning initiated`,
        changedBy: ctx.userId,
      },
    });

    // Audit log
    await logAudit({
      userId: ctx.userId,
      action: 'reservation_checked_out',
      resourceType: 'reservation',
      resourceId: id,
      changes: {
        reservationStatus: `CHECKED_IN → CHECKED_OUT`,
        roomStatus: `${previousStatus} → CLEANING`,
        cleaningTaskCreated: cleaningTask.id,
      },
    });

    return NextResponse.json(
      successResponse({
        data: {
          reservation: updatedReservation,
          cleaningTask,
          message: 'Guest checked out successfully, cleaning task created',
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking out reservation:', error);
    const msg = error instanceof Error ? error.message : 'Failed to checkout reservation';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
