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
import { bookingService } from '@/services/booking.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

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

    // Fetch with full relationships to include payment and other data
    const fullBooking = await bookingService.getBookingDetails(id);

    return sendSuccess(fullBooking, 'Booking updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update booking';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // For PATCH, only allow specific fields to be updated
    // This prevents unrelated fields from being overwritten
    const allowedFields = ['checkin', 'checkout', 'bookingStatus', 'timeIn', 'timeOut', 'notes'];
    const updateData: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    const booking = await bookingService.update(id, updateData);

    if (!booking) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Booking not found'
      );
    }

    // Fetch with full relationships to include payment and other data
    const fullBooking = await bookingService.getBookingDetails(id);

    return sendSuccess(fullBooking, 'Booking updated successfully');
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
