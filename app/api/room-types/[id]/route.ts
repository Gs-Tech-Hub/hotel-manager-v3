/**
 * GET /api/room-types/[id] - Get a specific room type
 * PUT /api/room-types/[id] - Update room type
 * DELETE /api/room-types/[id] - Delete room type
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const roomType = await prisma.roomType.findUnique({
      where: { id },
    });

    if (!roomType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Room type not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({ data: roomType }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching room type:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, code, description, imageUrl, capacity, bedSize, roomSizeM2, basePriceCents, amenities } = body;

    if (!name || !code) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Name and code are required'),
        { status: 400 }
      );
    }

    // Check if code already exists (excluding current room type)
    const existing = await prisma.roomType.findFirst({
      where: {
        code: code.toLowerCase(),
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Room type code already exists'),
        { status: 409 }
      );
    }

    const roomType = await prisma.roomType.update({
      where: { id },
      data: {
        name,
        code: code.toLowerCase(),
        description: description || null,
        imageUrl: imageUrl || null,
        capacity: capacity || 1,
        bedSize: bedSize || null,
        roomSizeM2: roomSizeM2 ? parseInt(roomSizeM2, 10) : null,
        basePriceCents: basePriceCents || 0,
        amenities: amenities || {},
      },
    });

    return NextResponse.json(
      successResponse({ data: roomType }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating room type:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const roomType = await prisma.roomType.findUnique({
      where: { id },
      include: { units: true },
    });

    if (!roomType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Room type not found'),
        { status: 404 }
      );
    }

    if (roomType.units.length > 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Cannot delete room type with existing units'),
        { status: 409 }
      );
    }

    await prisma.roomType.delete({
      where: { id },
    });

    return NextResponse.json(
      successResponse({ message: 'Room type deleted' }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting room type:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}
