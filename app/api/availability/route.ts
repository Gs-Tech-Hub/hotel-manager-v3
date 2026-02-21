/**
 * GET /api/availability
 * Search for available rooms/units
 */

import { NextRequest, NextResponse } from 'next/server';
import { reservationService } from '@/src/services/ReservationService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const checkInDateStr = searchParams.get('checkInDate');
    const checkOutDateStr = searchParams.get('checkOutDate');
    const unitKind = searchParams.get('unitKind');
    const capacity = searchParams.get('capacity');
    const roomTypeId = searchParams.get('roomTypeId');

    // Validate required params
    if (!checkInDateStr || !checkOutDateStr) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'checkInDate and checkOutDate are required'),
        { status: 400 }
      );
    }

    const checkInDate = new Date(checkInDateStr);
    const checkOutDate = new Date(checkOutDateStr);

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'checkOutDate must be after checkInDate'),
        { status: 400 }
      );
    }

    // Search availability
    const availability = await reservationService.searchAvailability(
      checkInDate,
      checkOutDate,
      {
        unitKind: unitKind || undefined,
        capacity: capacity ? parseInt(capacity) : undefined,
        roomTypeId: roomTypeId || undefined,
      }
    );

    return NextResponse.json(
      successResponse({
        data: {
          availability,
          searchParams: {
            checkInDate: checkInDate.toISOString(),
            checkOutDate: checkOutDate.toISOString(),
            unitKind: unitKind || null,
            capacity: capacity ? parseInt(capacity) : null,
          },
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error searching availability:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}
