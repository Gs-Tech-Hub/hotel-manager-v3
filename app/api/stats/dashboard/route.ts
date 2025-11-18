/**
 * GET /api/stats/dashboard
 * Get dashboard statistics
 */

import { NextRequest } from 'next/server';
import { roomService } from '@/services/room.service';
import { customerService } from '@/services/customer.service';
import { bookingService } from '@/services/booking.service';
import { orderService } from '@/services/order.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(_req: NextRequest) {
  try {
    const [roomStats, customerStats, bookingStats, orderStats] = await Promise.all([
      roomService.getOccupancyStats(),
      customerService.getCustomerStats(),
      bookingService.getBookingStats(),
      orderService.getOrderStats(),
    ]);

    const dashboard = {
      rooms: roomStats,
      customers: customerStats,
      bookings: bookingStats,
      orders: orderStats,
      timestamp: new Date().toISOString(),
    };

    return sendSuccess(dashboard, 'Dashboard stats retrieved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard stats';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
