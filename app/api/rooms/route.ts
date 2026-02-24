/**
 * GET /api/rooms - List all units
 * POST /api/rooms - Create new unit
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { UnitStatus, UnitKind } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Get all units (rooms) for booking selection
    const units = await prisma.unit.findMany({
      select: {
        id: true,
        roomNumber: true,
        unitKind: true,
        status: true,
        notes: true,
        roomType: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            capacity: true,
            bedSize: true,
            basePriceCents: true,
            amenities: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { roomNumber: 'asc' },
    });

    console.log('Fetched units:', units);

    return NextResponse.json(
      successResponse({ data: units }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching units:', error);
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
    if (!body.roomNumber || !body.roomTypeId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: roomNumber, roomTypeId'),
        { status: 400 }
      );
    }

    // Validate roomTypeId exists
    const roomType = await prisma.roomType.findUnique({
      where: { id: body.roomTypeId },
    });

    if (!roomType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'RoomType not found'),
        { status: 404 }
      );
    }

    // Validate unitKind if provided
    const validUnitKinds = ['ROOM', 'SUITE', 'APARTMENT'];
    if (body.unitKind && !validUnitKinds.includes(body.unitKind)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, `Invalid unitKind. Must be one of: ${validUnitKinds.join(', ')}`),
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE', 'BLOCKED'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, `Invalid status. Must be one of: ${validStatuses.join(', ')}`),
        { status: 400 }
      );
    }

    // Create unit
    const unit = await prisma.unit.create({
      data: {
        roomNumber: body.roomNumber,
        roomTypeId: body.roomTypeId,
        unitKind: (body.unitKind || 'ROOM') as UnitKind,
        status: (body.status || 'AVAILABLE') as UnitStatus,
        notes: body.notes || null,
        departmentId: body.departmentId || null,
      },
      include: {
        roomType: true,
        department: true,
      },
    });

    return NextResponse.json(
      successResponse({ data: unit, message: 'Unit created successfully' }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating unit:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle unique constraint error
    if (errorMsg.includes('Unique constraint failed')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Room number already exists'),
        { status: 409 }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}

