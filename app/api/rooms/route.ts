/**
 * GET /api/rooms - List all rooms
 * POST /api/rooms - Create new room
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // Get all rooms for booking selection
    const rooms = await prisma.room.findMany({
      select: {
        id: true,
        roomNumber: true,
        name: true,
        description: true,
        status: true,
        price: true,
        capacity: true,
      },
      orderBy: { roomNumber: 'asc' },
    });

    console.log('Fetched rooms:', rooms);

    return NextResponse.json(
      successResponse({ data: rooms }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.roomNumber || !body.name) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Missing required fields: roomNumber, name'),
        { status: 400 }
      );
    }

    // Create room - price and capacity come from RoomType
    const room = await prisma.room.create({
      data: {
        roomNumber: body.roomNumber,
        name: body.name,
        description: body.description || null,
        status: body.status || 'available',
        price: body.price || 0,
        capacity: body.capacity || 1,
      },
    });

    return NextResponse.json(
      successResponse({ data: room, message: 'Room created successfully' }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating room:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}

