/**
 * GET /api/rooms - List all units
 * Query params: ?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD (to mark unavailable units)
 * POST /api/rooms - Create new unit
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { UnitStatus, UnitKind } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const checkin = request.nextUrl.searchParams.get('checkin');
    const checkout = request.nextUrl.searchParams.get('checkout');

    // Get all rooms (excluding deleted ones marked as BLOCKED)
    const units = await prisma.unit.findMany({
      where: {
        status: { not: 'BLOCKED' }
      },
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

    // If dates provided, mark which units are unavailable
    if (checkin && checkout) {
      try {
        const checkInDate = new Date(checkin);
        const checkOutDate = new Date(checkout);

        // Validate dates
        if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
          return NextResponse.json(
            errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid date format'),
            { status: 400 }
          );
        }

        if (checkInDate >= checkOutDate) {
          return NextResponse.json(
            errorResponse(ErrorCodes.BAD_REQUEST, 'Check-in must be before check-out'),
            { status: 400 }
          );
        }

        // For each unit, check if it's available for the dates
        const unitsWithAvailability = await Promise.all(
          units.map(async (unit) => {
            let isAvailable = true;
            let unavailableReason = '';

            // Check room status - CLEANING and MAINTENANCE block all bookings
            if (unit.status === 'CLEANING') {
              isAvailable = false;
              unavailableReason = 'Room is currently being cleaned - cannot book until completed';
            } else if (unit.status === 'MAINTENANCE') {
              isAvailable = false;
              unavailableReason = 'Room is under maintenance - cannot book until completed';
            } else if (unit.status !== UnitStatus.AVAILABLE) {
              isAvailable = false;
              unavailableReason = `Room is ${unit.status} - cannot book at this time`;
            }

            // If status is OK, check for booking conflicts
            if (isAvailable) {
              const bookingConflict = await prisma.booking.findFirst({
                where: {
                  unitId: unit.id,
                  paymentId: { not: null }, // Payment must be made
                  bookingStatus: { in: ['confirmed', 'in_progress', 'completed'] },
                  AND: [
                    { checkin: { lt: checkOutDate } },
                    { checkout: { gt: checkInDate } },
                  ],
                },
              });

              if (bookingConflict) {
                isAvailable = false;
                unavailableReason = 'Already booked for these dates';
              }
            }

            // Check for reservation conflicts (CONFIRMED, CHECKED_IN, and CHECKED_OUT statuses block booking)
            if (isAvailable) {
              const reservationConflict = await prisma.reservation.findFirst({
                where: {
                  unitId: unit.id,
                  status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
                  AND: [
                    { checkInDate: { lt: checkOutDate } },
                    { checkOutDate: { gt: checkInDate } },
                  ],
                },
              });

              if (reservationConflict) {
                if (reservationConflict.status === 'CHECKED_OUT') {
                  unavailableReason = 'Room checking out - cleaning in progress';
                } else {
                  unavailableReason = 'Already reserved for these dates';
                }
                isAvailable = false;
              }
            }

            return {
              ...unit,
              isAvailable,
              unavailableReason,
            };
          })
        );

        return NextResponse.json(
          successResponse({ data: unitsWithAvailability }),
          { status: 200 }
        );
      } catch (err) {
        console.error('Error filtering units:', err);
        // Fall back to returning all units without availability info
        return NextResponse.json(
          successResponse({ data: units }),
          { status: 200 }
        );
      }
    }

    // No dates provided - return all units
    const unitsWithDefault = units.map((u) => ({
      ...u,
      isAvailable: u.status === UnitStatus.AVAILABLE,
      unavailableReason: u.status !== UnitStatus.AVAILABLE ? `Room is ${u.status}` : '',
    }));

    return NextResponse.json(
      successResponse({ data: unitsWithDefault }),
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

