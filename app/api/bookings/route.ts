/**
 * GET /api/bookings
 * Get all bookings with pagination
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - status: booking status filter
 */

import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, status } = getQueryParams(req);

    const response = await bookingService.findAll({
      page,
      limit,
      ...(status && {
        filters: [{ field: 'bookingStatus', operator: 'eq', value: status }],
      }),
    });

    if ('error' in response) {
      return sendError(
        response.error.code,
        response.error.message
      );
    }

    return sendSuccess(response, 'Bookings fetched successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch bookings';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * POST /api/bookings
 * Create a new booking
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.customerId || !body.roomId || !body.checkin || !body.checkout) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: customerId, roomId, checkin, checkout'
      );
    }

    // Create booking with default values
    const bookingData = {
      ...body,
      bookingId: `BK-${Date.now()}`,
      bookingStatus: 'pending',
      nights: body.nights || 1,
      guests: body.guests || 1,
      totalPrice: body.totalPrice || 0,
    };

    const booking = await bookingService.create(bookingData);

    if (!booking) {
      return sendError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create booking'
      );
    }

    return sendSuccess(booking, 'Booking created successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create booking';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
