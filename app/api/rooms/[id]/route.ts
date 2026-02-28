/**
 * GET /api/rooms/[id]
 * Get room details
 * 
 * PUT /api/rooms/[id]
 * Update a room
 * 
 * DELETE /api/rooms/[id]
 * Delete a room
 */

import { NextRequest } from 'next/server';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: {
        roomType: true,
        department: true,
      },
    });

    if (!unit) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Room not found'
      );
    }

    return sendSuccess(unit, 'Room details retrieved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return sendError(ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const { id } = await params;
    const body = await req.json();

    // Extract only allowed fields for update
    const allowedFields = ['roomNumber', 'unitKind', 'status', 'departmentId', 'notes'];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    const unit = await prisma.unit.update({
      where: { id },
      data: updateData,
      include: {
        roomType: true,
        department: true,
      },
    });

    return sendSuccess(unit, 'Room updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return sendError(ErrorCodes.UNAUTHORIZED, 'Unauthorized');
    }

    const { id } = await params;

    // Check for active bookings
    const activeBookings = await prisma.booking.findMany({
      where: {
        unitId: id,
        bookingStatus: { not: 'cancelled' },
      },
    });

    if (activeBookings.length > 0) {
      return sendError(
        ErrorCodes.CONFLICT,
        `Cannot delete room with active bookings (${activeBookings.length} found). Please cancel or complete all bookings first.`
      );
    }

    // Check for active reservations
    const activeReservations = await prisma.reservation.findMany({
      where: {
        unitId: id,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
    });

    if (activeReservations.length > 0) {
      return sendError(
        ErrorCodes.CONFLICT,
        `Cannot delete room with active reservations (${activeReservations.length} found). Please cancel or complete all reservations first.`
      );
    }

    // Check for active cleaning tasks
    const activeCleaningTasks = await prisma.cleaningTask.findMany({
      where: {
        unitId: id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    if (activeCleaningTasks.length > 0) {
      return sendError(
        ErrorCodes.CONFLICT,
        `Cannot delete room with active cleaning tasks (${activeCleaningTasks.length} found). Please complete all tasks first.`
      );
    }

    // Check for active maintenance requests
    const activeMaintenanceRequests = await prisma.maintenanceRequest.findMany({
      where: {
        unitId: id,
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
    });

    if (activeMaintenanceRequests.length > 0) {
      return sendError(
        ErrorCodes.CONFLICT,
        `Cannot delete room with active maintenance requests (${activeMaintenanceRequests.length} found). Please complete all requests first.`
      );
    }

    // Proceed with deletion - delete related records first
    // Delete status history
    await prisma.unitStatusHistory.deleteMany({
      where: { unitId: id },
    });

    // Delete cancelled bookings and completed cleaning/maintenance
    await prisma.booking.deleteMany({
      where: {
        unitId: id,
        bookingStatus: 'cancelled',
      },
    });

    await prisma.cleaningTask.deleteMany({
      where: {
        unitId: id,
        status: { in: ['COMPLETED', 'INSPECTED', 'REJECTED', 'CANCELLED'] },
      },
    });

    await prisma.maintenanceRequest.deleteMany({
      where: {
        unitId: id,
        status: { in: ['COMPLETED', 'VERIFIED', 'CANCELLED'] },
      },
    });

    // Finally, delete the unit
    await prisma.unit.delete({
      where: { id },
    });

    return sendSuccess(null, 'Room deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
