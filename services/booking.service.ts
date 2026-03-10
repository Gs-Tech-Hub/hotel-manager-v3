/**
 * 
 * Booking Service
 * Handles all booking-related operations
 */

import { BaseService } from './base.service';
import { IBooking } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';
import type { PaginatedResponse, QueryParams } from '@/types/api';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

// Helper mapper: convert Prisma results to IBooking domain type
function mapBooking(b: any): IBooking {
  if (!b) return b;
  return {
    id: b.id,
    bookingId: b.bookingId,
    customerId: b.customerId,
    unitId: b.unitId,
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
   * Override findAll to include relationships needed for list views
   */
  async findAll(
    params: QueryParams = {}
  ): Promise<PaginatedResponse<any> | ReturnType<typeof errorResponse>> {
    try {
      const { page = 1, limit = 10, skip = 0, filters = [], where: dateWhere = {} } = params;
      const pageNum = Math.max(1, page);
      const pageSize = Math.min(100, Math.max(1, limit));
      const skipNum = skip || (pageNum - 1) * pageSize;

      // Build where clause from filters and date range
      const where: Record<string, any> = dateWhere; // Start with date filter
      
      for (const filter of filters) {
        const { field, operator, value } = filter;
        switch (operator) {
          case 'eq':
            where[field] = value;
            break;
          case 'ne':
            where[field] = { not: value };
            break;
          case 'gt':
            where[field] = { gt: value };
            break;
          case 'gte':
            where[field] = { gte: value };
            break;
          case 'lt':
            where[field] = { lt: value };
            break;
          case 'lte':
            where[field] = { lte: value };
            break;
          case 'in':
            where[field] = { in: Array.isArray(value) ? value : [value] };
            break;
          case 'contains':
            where[field] = { contains: value, mode: 'insensitive' };
            break;
        }
      }

      // Execute queries with relationships included
      const [items, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: {
            customer: true,
            unit: {
              include: {
                roomType: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: skipNum,
          take: pageSize,
        }),
        prisma.booking.count({ where }),
      ]);

      // Enrich items with calculated charges
      const enrichedItems = items.map((item) => this.enrichBookingWithCharges(item));

      return {
        items: enrichedItems as any[],
        meta: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      };
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to fetch bookings'
      );
    }
  }
  /**
   * Get booking details with calculated charges
   */
  async getBookingDetails(bookingId: string): Promise<any | null> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          unit: true,
          payment: true,
          restaurant: true,
          barAndClub: true,
          bookingItems: true,
          hotelServices: true,
        },
      });

      if (!booking) {
        return null;
      }

      // Calculate charges dynamically
      return this.enrichBookingWithCharges(booking);
    } catch (error) {
      console.error('Error fetching booking details:', error);
      return null;
    }
  }

  /**
   * Get bookings by customer
   */
  async getCustomerBookings(customerId: string): Promise<any[]> {
    try {
      const rows = await prisma.booking.findMany({
        where: { customerId },
        include: { payment: true },
        orderBy: { createdAt: 'desc' },
      });
      // Enrich with calculated charges
      return rows.map((row) => this.enrichBookingWithCharges(row));
    } catch (error) {
      console.error('Error fetching customer bookings:', error);
      return [];
    }
  }

  /**
   * Get active bookings
   */
  async getActiveBookings(): Promise<any[]> {
    try {
      const rows = await prisma.booking.findMany({
        where: {
          bookingStatus: { in: ['confirmed', 'in_progress'] },
        },
        include: { customer: true },
        orderBy: { checkin: 'asc' },
      });
      // Enrich with calculated charges
      return rows.map((row) => this.enrichBookingWithCharges(row));
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
        include: { bookingItems: true, customer: true },
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
   * Sets check-in time (guest status)
   * Does NOT change payment status (bookingStatus)
   * Preserves all other fields including payment
   * 
   * VALIDATION: Prevents check-in before scheduled check-in date
   * @throws Error if check-in is before scheduled date
   */
  async checkInBooking(bookingId: string): Promise<{
    success: boolean;
    message?: string;
    nextAvailableCheckIn?: Date;
  }> {
    try {
      // Get existing booking to preserve all other fields
      const existingBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      
      if (!existingBooking) {
        return { success: false, message: 'Booking not found' };
      }

      // Validate: Cannot check in before scheduled check-in date
      const now = new Date();
      const scheduledCheckIn = new Date(existingBooking.checkin);
      
      // Reset to start of day for comparison
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const scheduledStart = new Date(scheduledCheckIn);
      scheduledStart.setHours(0, 0, 0, 0);

      if (todayStart < scheduledStart) {
        return {
          success: false,
          message: `Check-in not available before ${scheduledCheckIn.toLocaleDateString()}`,
          nextAvailableCheckIn: scheduledStart,
        };
      }

      // Update: only set timeIn (guest check-in)
      // Do NOT change bookingStatus (payment status stays as-is)
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          timeIn: new Date().toISOString(),
        },
      });
      return { success: true, message: 'Guest checked in successfully' };
    } catch (error) {
      console.error('Error checking in booking:', error);
      return { success: false, message: 'Failed to check in guest' };
    }
  }

  /**
   * Check out booking
   * Sets check-out time (guest status)
   * Does NOT change payment status (bookingStatus)
   * Preserves all other fields including payment
   */
  async checkOutBooking(bookingId: string): Promise<boolean> {
    try {
      // Get existing booking to preserve all other fields
      const existingBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      
      if (!existingBooking) {
        return false;
      }

      // Update: only set timeOut (guest check-out)
      // Do NOT change bookingStatus (payment status stays as-is)
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          timeOut: new Date().toISOString(),
        },
      });
      return true;
    } catch (error) {
      console.error('Error checking out booking:', error);
      return false;
    }
  }

  /**
   * Enrich booking with dynamically calculated charges
   * Calculates early check-in days and demurrage charges on the fly
   */
  private enrichBookingWithCharges(booking: any): any {
    try {
      const pricePerNight = Math.ceil(booking.totalPrice / booking.nights);

      // Calculate early check-in
      const prematureCheckIn = this.calculatePrematureCheckIn(
        booking.checkin,
        booking.timeIn
      );

      // Calculate demurrage (late checkout)
      const demurrage = this.calculateDemurrage(
        booking.checkout,
        booking.timeOut,
        pricePerNight
      );

      // Calculate total charges
      const totalAdditionalCharges =
        (prematureCheckIn.prematureCheckInFee || 0) + demurrage.demurrageCharge;
      const totalChargesWithExtra = booking.totalPrice + totalAdditionalCharges;

      return {
        ...booking,
        prematureCheckInDays: prematureCheckIn.prematureCheckInDays,
        prematureCheckInFee: prematureCheckIn.prematureCheckInFee,
        extraNightsDays: demurrage.extraNightsDays,
        demurrageChargePerDay: demurrage.demurrageChargePerDay,
        demurrageCharge: demurrage.demurrageCharge,
        totalAdditionalCharges,
        totalChargesWithExtra,
      };
    } catch (error) {
      console.error('Error enriching booking with charges:', error);
      return booking;
    }
  }

  /**
   * Calculate premature check-in details
   */
  private calculatePrematureCheckIn(
    scheduledCheckIn: Date,
    actualCheckInTime: string | null | undefined
  ): {
    prematureCheckInDays: number | null;
    prematureCheckInFee: number;
  } {
    if (!actualCheckInTime) {
      return { prematureCheckInDays: null, prematureCheckInFee: 0 };
    }

    const scheduled = new Date(scheduledCheckIn);
    const actual = new Date(actualCheckInTime);

    // Reset times to start of day for accurate day comparison
    scheduled.setHours(0, 0, 0, 0);
    actual.setHours(0, 0, 0, 0);

    const timeDiff = scheduled.getTime() - actual.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysDiff > 0) {
      return { prematureCheckInDays: daysDiff, prematureCheckInFee: 0 };
    }

    return { prematureCheckInDays: null, prematureCheckInFee: 0 };
  }

  /**
   * Calculate demurrage (extra stay/late checkout) details
   */
  private calculateDemurrage(
    scheduledCheckOut: Date,
    actualCheckOutTime: string | null | undefined,
    pricePerNight: number
  ): {
    extraNightsDays: number | null;
    demurrageChargePerDay: number;
    demurrageCharge: number;
  } {
    if (!actualCheckOutTime) {
      return {
        extraNightsDays: null,
        demurrageChargePerDay: pricePerNight,
        demurrageCharge: 0,
      };
    }

    const scheduled = new Date(scheduledCheckOut);
    const actual = new Date(actualCheckOutTime);

    // Reset times to start of day for accurate day comparison
    scheduled.setHours(0, 0, 0, 0);
    actual.setHours(0, 0, 0, 0);

    const timeDiff = actual.getTime() - scheduled.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysDiff > 0) {
      const demurrageCharge = daysDiff * pricePerNight;
      return {
        extraNightsDays: daysDiff,
        demurrageChargePerDay: pricePerNight,
        demurrageCharge,
      };
    }

    return {
      extraNightsDays: null,
      demurrageChargePerDay: pricePerNight,
      demurrageCharge: 0,
    };
  }
}

export const bookingService = new BookingService();
