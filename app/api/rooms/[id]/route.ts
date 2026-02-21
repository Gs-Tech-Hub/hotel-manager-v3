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

    const unit = await prisma.unit.update({
      where: { id },
      data: body,
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

    await prisma.unit.delete({
      where: { id },
    });

    return sendSuccess(null, 'Room deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
