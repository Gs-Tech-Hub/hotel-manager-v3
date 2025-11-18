/**
 * GET /api/bookings/[id]
 * Get booking details
 * 
 * PUT /api/bookings/[id]
 * Update booking
 * 
 * DELETE /api/bookings/[id]
 * Cancel booking
 */

import { NextRequest } from 'next/server';
import { bookingService } from '../../../../src/services/booking.service';
import { sendSuccess, sendError } from '../../../../src/lib/api-handler';
import { ErrorCodes } from '../../../../src/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await bookingService.getBookingDetails(id);

    if (!booking) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Booking not found'
      );
    }

    return sendSuccess(booking, 'Booking details retrieved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch booking';
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

    const booking = await bookingService.update(id, body);

    if (!booking) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Booking not found'
      );
    }

    return sendSuccess(booking, 'Booking updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update booking';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const booking = await bookingService.update(id, {
      bookingStatus: 'cancelled',
    });

    if (!booking) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Booking not found'
      );
    }

    return sendSuccess(booking, 'Booking cancelled successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel booking';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
