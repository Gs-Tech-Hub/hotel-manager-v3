/**
 * GET /api/bookings/stats
 * Get booking statistics with optional date filtering
 * 
 * Query Parameters:
 * - startDate: start date (YYYY-MM-DD)
 * - endDate: end date (YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildBookingCheckinFilter } from '@/lib/date-filter';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter based on booking checkin date
    const dateFilter = buildBookingCheckinFilter(startDate, endDate);

    // Fetch all bookings for the date range
    const bookings = await prisma.booking.findMany({
      where: dateFilter,
      include: {
        payment: true,
      },
    });

    // Calculate statistics
    const totalBookings = bookings.length;
    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalCheckedIn = 0;
    let totalCheckedOut = 0;
    let totalIncome = 0;
    let pendingBookings = 0;
    let confirmedBookings = 0;

    for (const booking of bookings) {
      // Calculate payment amounts
      if (booking.payment && booking.payment.paymentStatus === 'completed') {
        totalPaid += booking.payment.totalPrice || 0;
        totalIncome += booking.payment.totalPrice || 0;
      } else if (booking.payment) {
        totalUnpaid += booking.payment.totalPrice || 0;
      } else {
        totalUnpaid += booking.totalPrice || 0;
      }

      // Count check-in/out status based on timeIn/timeOut, not bookingStatus
      // bookingStatus reflects payment status, not guest status
      if (booking.timeOut !== null && booking.timeOut !== undefined) {
        totalCheckedOut += 1;
      } else if (booking.timeIn !== null && booking.timeIn !== undefined) {
        totalCheckedIn += 1;
      } else if (booking.bookingStatus === 'pending') {
        pendingBookings += 1;
      } else if (booking.bookingStatus === 'confirmed') {
        confirmedBookings += 1;
      }
    }

    const stats = {
      totalBookings,
      totalPaid,
      totalUnpaid,
      totalCheckedIn,
      totalCheckedOut,
      totalIncome,
      pendingBookings,
      confirmedBookings,
    };

    return NextResponse.json(
      successResponse({ data: stats }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch booking statistics'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
