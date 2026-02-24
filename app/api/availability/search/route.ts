/**
 * GET /api/availability/search
 * Search for available units with pricing calculation for each night stayed
 * 
 * Query parameters:
 * - checkInDate: ISO date string (required)
 * - checkOutDate: ISO date string (required)
 * - unitKind: optional ('ROOM', 'SUITE', 'APARTMENT')
 * - capacity: optional (minimum guest capacity)
 * - roomTypeId: optional (filter by specific room type)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { RoomService } from '@/src/services/RoomService';
import { ReservationService } from '@/src/services/ReservationService';

const roomService = new RoomService();
const reservationService = new ReservationService();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get required parameters
    const checkInDateStr = searchParams.get('checkInDate');
    const checkOutDateStr = searchParams.get('checkOutDate');

    if (!checkInDateStr || !checkOutDateStr) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required parameters: checkInDate, checkOutDate'),
        { status: 400 }
      );
    }

    // Parse dates
    const checkInDate = new Date(checkInDateStr);
    const checkOutDate = new Date(checkOutDateStr);

    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid date format. Use ISO date strings (YYYY-MM-DD)'),
        { status: 400 }
      );
    }

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Check-in date must be before check-out date'),
        { status: 400 }
      );
    }

    // Normalize dates to start-of-day UTC
    checkInDate.setUTCHours(0, 0, 0, 0);
    checkOutDate.setUTCHours(0, 0, 0, 0);

    // Get optional filters
    const unitKind = searchParams.get('unitKind') || undefined;
    const capacityStr = searchParams.get('capacity');
    const capacity = capacityStr ? parseInt(capacityStr, 10) : undefined;
    const roomTypeId = searchParams.get('roomTypeId') || undefined;

    // Build availability search results with detailed pricing
    const results = await reservationService.searchAvailability(
      checkInDate,
      checkOutDate,
      { unitKind: unitKind as any, capacity, roomTypeId }
    );

    console.log('Availability search results:', results);

    return NextResponse.json(
      successResponse({
        data: {
          units: results,
          checkinDate: checkInDate.toISOString(),
          checkoutDate: checkOutDate.toISOString(),
          count: results.length,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error searching availability:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, message),
      { status: 500 }
    );
  }
}
