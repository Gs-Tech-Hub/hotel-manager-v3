/**
 * GET /api/rooms
 * Get all rooms with pagination
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - status: 'available' | 'occupied' | 'maintenance'
 * - sort: field:asc|desc
 */

import { NextRequest } from 'next/server';
import { roomService } from '@/services/room.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, status } = getQueryParams(req);

    let response;

    if (status) {
      const rooms = await roomService.getRoomsByStatus(status);
      response = {
        items: rooms,
        meta: {
          total: rooms.length,
          pages: 1,
        },
      };
    } else {
      response = await roomService.findAll({
        page,
        limit,
      });
    }

    if ('error' in response) {
      return sendError(
        response.error.code,
        response.error.message
      );
    }

    return sendSuccess(response, 'Rooms fetched successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch rooms';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * POST /api/rooms
 * Create a new room
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.roomNumber) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: name, roomNumber'
      );
    }

    const room = await roomService.create(body);

    if (!room) {
      return sendError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create room'
      );
    }

    return sendSuccess(room, 'Room created successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
