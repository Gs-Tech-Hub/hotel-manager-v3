/**
 * Room/Unit Service
 * Handles all room/unit-related operations
 */

import { BaseService } from './base.service';
import { IRoom } from '@/types/entities';
import { prisma } from '@/lib/auth/prisma';
import { UnitStatus } from '@prisma/client';

export class RoomService extends BaseService<IRoom> {
  constructor() {
    super('room');
  }

  private mapUnit(u: any): IRoom {
    return {
      id: u.id,
      name: u.roomType?.name || 'N/A',
      description: u.roomType?.description ?? undefined,
      roomNumber: u.roomNumber,
      status: u.status,
      price: u.roomType?.basePriceCents ?? 0,
      capacity: u.roomType?.capacity ?? 1,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  /**
   * Get units by status
   */
  async getRoomsByStatus(status: UnitStatus): Promise<IRoom[]> {
    try {
      const rows = await prisma.unit.findMany({
        where: { status },
        include: { roomType: true },
      });

      return rows.map((r: any) => this.mapUnit(r));
    } catch (error) {
      console.error('Error fetching units by status:', error);
      return [];
    }
  }

  /**
   * Get available units
   */
  async getAvailableRooms(): Promise<IRoom[]> {
    return this.getRoomsByStatus('AVAILABLE');
  }

  /**
   * Check unit availability for a date range
   */
  async checkAvailability(unitId: string, startDate: Date, endDate: Date): Promise<boolean> {
    try {
      const reservations = await prisma.reservation.findMany({
        where: {
          unitId,
          AND: [
            { checkInDate: { lt: endDate } },
            { checkOutDate: { gt: startDate } },
          ],
          status: { not: 'CANCELLED' },
        },
      });
      return reservations.length === 0;
    } catch (error) {
      console.error('Error checking unit availability:', error);
      return false;
    }
  }

  /**
   * Get unit with roomType and recent reservations
   */
  async getRoomDetails(unitId: string): Promise<any | null> {
    try {
      return await prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          roomType: true,
          reservations: { take: 5, orderBy: { createdAt: 'desc' } },
          cleaningTasks: { take: 3, orderBy: { createdAt: 'desc' } },
        },
      });
    } catch (error) {
      console.error('Error fetching unit details:', error);
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
      const stats = await prisma.unit.groupBy({
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
