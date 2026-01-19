/**
 * Booking Service
 * Handles all booking-related operations
 */

import { BaseService } from './base.service';
import { IBooking } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';

// Helper mapper: convert Prisma results to IBooking domain type
function mapBooking(b: any): IBooking {
  if (!b) return b;
  return {
    id: b.id,
    bookingId: b.bookingId,
    customerId: b.customerId,
    roomId: b.roomId,
    checkin: b.checkin,
    checkout: b.checkout,
    timeIn: b.timeIn ?? undefined,
    timeOut: b.timeOut ?? undefined,
    nights: b.nights,
    guests: b.guests,
    isShortRest: Boolean(b.isShortRest),
    totalPrice: b.totalPrice,
    bookingStatus: b.bookingStatus,
    paymentId: b.paymentId ?? undefined,
    restaurantId: b.restaurantId ?? undefined,
    barAndClubId: b.barAndClubId ?? undefined,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function mapBookings(arr: any[] | null): IBooking[] {
  if (!arr) return [];
  return arr.map(mapBooking);
}

export class BookingService extends BaseService<IBooking> {
  constructor() {
    super('booking');
  }

  /**
   * Get booking with all details
   */
  async getBookingDetails(bookingId: string): Promise<any | null> {
    try {
      return await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          room: { include: { amenities: true, beds: true } },
          payment: true,
          restaurant: true,
          barAndClub: true,
          bookingItems: true,
          hotelServices: true,
        },
      });
    } catch (error) {
      console.error('Error fetching booking details:', error);
      return null;
    }
  }

  /**
   * Get bookings by customer
   */
  async getCustomerBookings(customerId: string): Promise<IBooking[]> {
    try {
      const rows = await prisma.booking.findMany({
        where: { customerId },
        include: { room: true, payment: true },
        orderBy: { createdAt: 'desc' },
      });
      return mapBookings(rows);
    } catch (error) {
      console.error('Error fetching customer bookings:', error);
      return [];
    }
  }

  /**
   * Get active bookings
   */
  async getActiveBookings(): Promise<IBooking[]> {
    try {
      const rows = await prisma.booking.findMany({
        where: {
          bookingStatus: { in: ['confirmed', 'in_progress'] },
        },
        include: { customer: true, room: true },
        orderBy: { checkin: 'asc' },
      });
      return mapBookings(rows);
    } catch (error) {
      console.error('Error fetching active bookings:', error);
      return [];
    }
  }

  /**
   * Create booking with items
   */
  async createBookingWithItems(
    bookingData: Record<string, any>,
    items: Array<Record<string, any>>
  ): Promise<any | null> {
    try {
      return await prisma.booking.create({
        data: {
          ...bookingData,
          bookingItems: {
            create: items as any,
          },
        } as any,
        include: { bookingItems: true, customer: true, room: true },
      });
    } catch (error) {
      console.error('Error creating booking with items:', error);
      return null;
    }
  }

  /**
   * Get booking revenue
   */
  async getBookingRevenue(startDate?: Date, endDate?: Date): Promise<number> {
    try {
      const where: Record<string, any> = {
        bookingStatus: 'completed',
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const result = await prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where,
      });

      return result._sum.totalPrice || 0;
    } catch (error) {
      console.error('Error calculating booking revenue:', error);
      return 0;
    }
  }

  /**
   * Get booking statistics
   */
  async getBookingStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  } | null> {
    try {
      const stats = await prisma.booking.groupBy({
        by: ['bookingStatus'],
        _count: true,
      });

      const summary: Record<string, number> = {
        total: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
      };

      stats.forEach((stat: any) => {
        summary[stat.bookingStatus] = stat._count;
        summary.total += stat._count;
      });

      return summary as any;
    } catch (error) {
      console.error('Error fetching booking stats:', error);
      return null;
    }
  }

  /**
   * Check in booking
   */
  async checkInBooking(bookingId: string): Promise<boolean> {
    try {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { bookingStatus: 'in_progress' },
      });
      return true;
    } catch (error) {
      console.error('Error checking in booking:', error);
      return false;
    }
  }

  /**
   * Check out booking
   */
  async checkOutBooking(bookingId: string): Promise<boolean> {
    try {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { bookingStatus: 'completed' },
      });
      return true;
    } catch (error) {
      console.error('Error checking out booking:', error);
      return false;
    }
  }
}

export const bookingService = new BookingService();
