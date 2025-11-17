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

import { NextRequest, NextResponse } from 'next/server';
import { roomService } from '@/services/room.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const room = await roomService.getRoomDetails(id);

    if (!room) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Room not found'
      );
    }

    return sendSuccess(room, 'Room details retrieved');
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
    const { id } = await params;
    const body = await req.json();

    const room = await roomService.update(id, body);

    if (!room) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Room not found'
      );
    }

    return sendSuccess(room, 'Room updated successfully');
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
    const { id } = await params;
    const success = await roomService.delete(id);

    if (!success) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Room not found'
      );
    }

    return sendSuccess(null, 'Room deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
