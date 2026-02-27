/**
 * GET /api/room-types - List all room types
 * POST /api/room-types - Create new room type
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const roomTypes = await prisma.roomType.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      successResponse({ data: roomTypes }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching room types:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, description, imageUrl, capacity, bedSize, roomSizeM2, basePriceCents, amenities } = body;

    if (!name || !code) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Name and code are required'),
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.roomType.findFirst({
      where: { code: code.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Room type code already exists'),
        { status: 409 }
      );
    }

    const roomType = await prisma.roomType.create({
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
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating room type:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}
