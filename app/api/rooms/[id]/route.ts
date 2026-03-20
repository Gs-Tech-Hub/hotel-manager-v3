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

    // Exclude accessing deleted (BLOCKED) rooms
    if (unit.status === 'BLOCKED') {
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

    // Proceed with soft deletion - set status to BLOCKED instead of hard delete
    // Get current status for history
    const unit = await prisma.unit.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!unit) {
      return sendError(ErrorCodes.NOT_FOUND, 'Room not found');
    }

    const previousStatus = unit.status || 'AVAILABLE';

    // Soft delete: set status to BLOCKED and clear room number
    const blockedUnit = await prisma.unit.update({
      where: { id },
      data: {
        status: 'BLOCKED',
        roomNumber: null,
        statusUpdatedAt: new Date(),
      },
    });

    // Log status change
    await prisma.unitStatusHistory.create({
      data: {
        unitId: id,
        previousStatus,
        newStatus: 'BLOCKED',
        reason: 'Room deleted by user (soft delete via BLOCKED status)',
        changedBy: ctx.userId,
      },
    });

    return sendSuccess({ id, status: 'BLOCKED' }, 'Room deleted successfully (set to BLOCKED status)');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

