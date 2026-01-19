/**
 * Room Service
 * Handles all room-related operations
 */

import { BaseService } from './base.service';
import { IRoom } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';

export class RoomService extends BaseService<IRoom> {
  constructor() {
    super('room');
  }

  private mapRoom(r: any): IRoom {
    return {
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      roomNumber: r.roomNumber,
      status: r.status,
      price: r.price,
      capacity: r.capacity,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  /**
   * Get rooms by status
   */
  async getRoomsByStatus(status: string): Promise<IRoom[]> {
    try {
      const rows = await prisma.room.findMany({
        where: { status },
        include: { amenities: true, beds: true },
      });

      return rows.map((r: any) => this.mapRoom(r));
    } catch (error) {
      console.error('Error fetching rooms by status:', error);
      return [];
    }
  }

  /**
   * Get available rooms
   */
  async getAvailableRooms(): Promise<IRoom[]> {
    return this.getRoomsByStatus('available');
  }

  /**
   * Check room availability for a date range
   */
  async checkAvailability(roomId: string, startDate: Date, endDate: Date): Promise<boolean> {
    try {
      const bookings = await prisma.booking.findMany({
        where: {
          roomId,
          AND: [
            { checkin: { lt: endDate } },
            { checkout: { gt: startDate } },
          ],
          bookingStatus: { not: 'cancelled' },
        },
      });
      return bookings.length === 0;
    } catch (error) {
      console.error('Error checking room availability:', error);
      return false;
    }
  }

  /**
   * Get room with amenities and beds
   */
  async getRoomDetails(roomId: string): Promise<any | null> {
    try {
      return await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          amenities: true,
          beds: true,
          bookings: { take: 5, orderBy: { createdAt: 'desc' } },
        },
      });
    } catch (error) {
      console.error('Error fetching room details:', error);
      return null;
    }
  }

  /**
   * Get occupancy rate
   */
  async getOccupancyStats(): Promise<{
    available: number;
    occupied: number;
    maintenance: number;
    total: number;
  } | null> {
    try {
      const stats = await prisma.room.groupBy({
        by: ['status'],
        _count: true,
      });

      const summary: {
        available: number;
        occupied: number;
        maintenance: number;
        total: number;
      } = {
        available: 0,
        occupied: 0,
        maintenance: 0,
        total: 0,
      };

      stats.forEach((stat: any) => {
        summary[stat.status as keyof typeof summary] = stat._count;
      });

      summary.total = stats.reduce((sum: number, stat: any) => sum + stat._count, 0);
      return summary;
    } catch (error) {
      console.error('Error fetching occupancy stats:', error);
      return null;
    }
  }
}

export const roomService = new RoomService();
