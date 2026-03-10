/**
 * GET /api/bookings
 * Get all bookings with pagination and date filtering
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - status: booking/guest status filter (comma-separated for multiple)
 *   - pending_payment: Payment not yet made
 *   - pending_checkin: Payment made, guest hasn't checked in yet
 *   - checkin_pending_checkout: Guest checked in, hasn't checked out yet (synonym: in_progress)
 *   - in_progress: Guest has checked in but not checked out
 *   - completed: Guest has checked out (timeOut is set)
 *   - confirmed, pending, cancelled: Filter by booking status
 *   - Example: "pending_payment,pending_checkin" (comma-separated for multiple)
 * - startDate: start date (YYYY-MM-DD)
 * - endDate: end date (YYYY-MM-DD)
 */

import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';
import { buildBookingCheckinFilter } from '@/lib/date-filter';
import type { FilterOptions } from '@/types/api';

export async function GET(req: NextRequest) {
  try {
    const { page, limit, status } = getQueryParams(req);
    const searchParams = req.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter based on booking checkin date
    const dateFilter = buildBookingCheckinFilter(startDate, endDate);

    const filters: FilterOptions[] = [];
    
    // Handle status filter with guest status translation
    // Support comma-separated statuses for multiple filter values
    let customWhere: any = dateFilter;

    if (status) {
      // Split comma-separated statuses
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      
      // Build OR conditions for each status
      const statusConditions = statuses.map((singleStatus) => {
        if (singleStatus === 'pending_payment') {
          return {
            OR: [
              { paymentId: null },
              { payment: { paymentStatus: { not: 'completed' } } }
            ]
          };
        } else if (singleStatus === 'pending_checkin') {
          return {
            paymentId: { not: null },
            timeIn: null,
          };
        } else if (singleStatus === 'checkin_pending_checkout') {
          return {
            timeIn: { not: null },
            timeOut: null,
          };
        } else if (singleStatus === 'in_progress') {
          return {
            timeIn: { not: null },
            timeOut: null,
          };
        } else if (singleStatus === 'completed') {
          return {
            timeOut: { not: null },
          };
        } else {
          // For booking status filters (pending, confirmed, cancelled)
          return { bookingStatus: singleStatus };
        }
      });

      // If multiple statuses, combine with OR; if single, apply directly
      if (statusConditions.length === 1) {
        customWhere = { ...customWhere, ...statusConditions[0] };
      } else if (statusConditions.length > 1) {
        customWhere = { ...customWhere, OR: statusConditions };
      }
    }

    const response = await bookingService.findAll({
      page,
      limit,
      filters: filters.length > 0 ? filters : [],
      where: customWhere,
    });

    if ('error' in response) {
      const err = response as any;
      return sendError(
        err.error?.code || ErrorCodes.INTERNAL_ERROR,
        err.error?.message || 'Failed to fetch bookings'
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
    if (!body.customerId || !body.unitId || !body.checkin || !body.checkout) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: customerId, unitId, checkin, checkout'
      );
    }

    // Check if room is available for booking
    const { prisma } = await import('@/lib/auth/prisma');
    const unit = await prisma.unit.findUnique({
      where: { id: body.unitId },
    });

    if (!unit) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Room not found'
      );
    }

    // Block booking if room is in CLEANING, MAINTENANCE, or BLOCKED status
    if (['CLEANING', 'MAINTENANCE', 'BLOCKED'].includes(unit.status)) {
      return sendError(
        ErrorCodes.CONFLICT,
        `Cannot book room - room is currently ${unit.status.toLowerCase()}`
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

