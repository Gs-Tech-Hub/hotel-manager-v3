/**
 * RoomService: Manage room types, units, pricing, and availability
 */

import { prisma } from '@/lib/auth/prisma';
import { Unit, UnitKind, UnitStatus, RoomType, PricingOverride } from '@prisma/client';
import { PermissionContext } from './types';
import { checkPermission } from '@/lib/auth/rbac';

export interface CreateUnitInput {
  roomNumber: string;
  unitKind: UnitKind;
  roomTypeId: string;
  departmentId?: string | null;
  notes?: string;
}

export interface UpdateUnitInput {
  status?: UnitStatus;
  departmentId?: string;
  notes?: string;
}

export interface CreateRoomTypeInput {
  code: string;
  name: string;
  description?: string;
  capacity: number;
  amenities?: Record<string, boolean>;
  basePriceCents: number;
}

export class RoomService {
  /**
   * Find available units for booking
   */
  async findAvailableUnits(
    checkInDate: Date,
    checkOutDate: Date,
    filters?: {
      unitKind?: UnitKind;
      capacity?: number;
      roomTypeId?: string;
    }
  ): Promise<(Unit & { roomType: RoomType })[]> {
    // Normalize dates to start-of-day UTC
    const checkin = new Date(checkInDate);
    checkin.setUTCHours(0, 0, 0, 0);

    const checkout = new Date(checkOutDate);
    checkout.setUTCHours(0, 0, 0, 0);

    // Find all units matching filters
    const units = await prisma.unit.findMany({
      where: {
        status: UnitStatus.AVAILABLE,
        unitKind: filters?.unitKind,
        roomType: {
          id: filters?.roomTypeId,
          capacity: filters?.capacity ? { gte: filters.capacity } : undefined,
        },
      },
      include: {
        roomType: true,
      },
    });

    // Filter out units with conflicting reservations
    const available: (Unit & { roomType: RoomType })[] = [];

    for (const unit of units) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          unitId: unit.id,
          status: {
            in: ['CONFIRMED', 'CHECKED_IN'],
          },
          AND: [
            { checkInDate: { lt: checkout } },
            { checkOutDate: { gt: checkin } },
          ],
        },
      });

      if (!conflict) {
        available.push(unit);
      }
    }

    return available;
  }

  /**
   * Get unit with all related data
   */
  async getUnitDetail(unitId: string) {
    return prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        roomType: true,
        department: true,
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        cleaningTasks: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        maintenanceReqs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Create new unit
   */
  async createUnit(data: CreateUnitInput, ctx: PermissionContext): Promise<Unit> {
    // Check permission
    const hasAccess = await checkPermission(ctx, 'rooms.manage', 'rooms');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to manage rooms');
    }

    // Verify room type exists
    const roomType = await prisma.roomType.findUnique({
      where: { id: data.roomTypeId },
    });
    if (!roomType) {
      throw new Error('Room type not found');
    }

    return prisma.unit.create({
      data: {
        roomNumber: data.roomNumber,
        unitKind: data.unitKind,
        roomTypeId: data.roomTypeId,
        departmentId: data.departmentId || undefined,
        notes: data.notes,
        status: UnitStatus.AVAILABLE,
      },
    });
  }

  /**
   * Update unit
   */
  async updateUnit(unitId: string, data: UpdateUnitInput, ctx: PermissionContext): Promise<Unit> {
    const hasAccess = await checkPermission(ctx, 'rooms.manage', 'rooms');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to manage rooms');
    }

    return prisma.unit.update({
      where: { id: unitId },
      data,
    });
  }

  /**
   * Calculate price for unit over date range (applies PricingOverrides)
   */
  async calculatePrice(unitId: string, checkInDate: Date, checkOutDate: Date): Promise<number> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { roomType: true },
    });

    if (!unit) {
      throw new Error('Unit not found');
    }

    // Normalize dates
    const checkin = new Date(checkInDate);
    checkin.setUTCHours(0, 0, 0, 0);

    const checkout = new Date(checkOutDate);
    checkout.setUTCHours(0, 0, 0, 0);

    // Calculate number of nights
    const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

    // Get pricing overrides for the date range
    const overrides = await prisma.pricingOverride.findMany({
      where: {
        roomTypeId: unit.roomTypeId,
        startDate: { lt: checkout },
        endDate: { gt: checkin },
      },
    });

    // Simple calculation: use override if available, otherwise base price
    let totalCents = 0;

    if (overrides.length > 0) {
      // Use average of overrides (simplified; real impl would be more sophisticated)
      const avgPrice = Math.round(
        overrides.reduce((sum, o) => sum + o.pricePerNightCents, 0) / overrides.length
      );
      totalCents = avgPrice * nights;
    } else {
      totalCents = unit.roomType.basePriceCents * nights;
    }

    return totalCents;
  }

  /**
   * Update unit status (derive from reservations, cleaning, maintenance)
   */
  async updateUnitStatus(unitId: string): Promise<UnitStatus> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
    });

    if (!unit) {
      throw new Error('Unit not found');
    }

    // Check for active reservation (checked-in)
    const activeReservation = await prisma.reservation.findFirst({
      where: {
        unitId,
        status: 'CHECKED_IN',
      },
    });

    if (activeReservation) {
      const newStatus = UnitStatus.OCCUPIED;
      if (newStatus !== unit.status) {
        await this.recordStatusChange(unitId, unit.status, newStatus, 'Active reservation');
        await prisma.unit.update({
          where: { id: unitId },
          data: { status: newStatus, statusUpdatedAt: new Date() },
        });
      }
      return newStatus;
    }

    // Check for in-progress cleaning task
    const activeCleaning = await prisma.cleaningTask.findFirst({
      where: {
        unitId,
        status: 'IN_PROGRESS',
      },
    });

    if (activeCleaning) {
      const newStatus = UnitStatus.CLEANING;
      if (newStatus !== unit.status) {
        await this.recordStatusChange(unitId, unit.status, newStatus, 'Cleaning task in progress');
        await prisma.unit.update({
          where: { id: unitId },
          data: { status: newStatus, statusUpdatedAt: new Date() },
        });
      }
      return newStatus;
    }

    // Check for in-progress maintenance
    const activeMaintenance = await prisma.maintenanceRequest.findFirst({
      where: {
        unitId,
        status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
      },
    });

    if (activeMaintenance) {
      const newStatus = UnitStatus.MAINTENANCE;
      if (newStatus !== unit.status) {
        await this.recordStatusChange(unitId, unit.status, newStatus, 'Maintenance in progress');
        await prisma.unit.update({
          where: { id: unitId },
          data: { status: newStatus, statusUpdatedAt: new Date() },
        });
      }
      return newStatus;
    }

    // If manually blocked, keep blocked
    if (unit.status === UnitStatus.BLOCKED) {
      return unit.status;
    }

    // Otherwise, available
    const newStatus = UnitStatus.AVAILABLE;
    if (newStatus !== unit.status) {
      await this.recordStatusChange(unitId, unit.status, newStatus, 'Status auto-sync');
      await prisma.unit.update({
        where: { id: unitId },
        data: { status: newStatus, statusUpdatedAt: new Date() },
      });
    }
    return newStatus;
  }

  /**
   * Record unit status change for audit trail
   */
  private async recordStatusChange(
    unitId: string,
    previousStatus: UnitStatus,
    newStatus: UnitStatus,
    reason?: string
  ) {
    await prisma.unitStatusHistory.create({
      data: {
        unitId,
        previousStatus,
        newStatus,
        reason,
      },
    });
  }

  /**
   * Bulk import units from data
   */
  async importUnits(units: CreateUnitInput[], ctx: PermissionContext): Promise<Unit[]> {
    const hasAccess = await checkPermission(ctx, 'rooms.manage', 'rooms');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to manage rooms');
    }

    const created: Unit[] = [];
    for (const unitData of units) {
      const unit = await this.createUnit(unitData, ctx);
      created.push(unit);
    }
    return created;
  }

  /**
   * Create room type
   */
  async createRoomType(data: CreateRoomTypeInput, ctx: PermissionContext): Promise<RoomType> {
    const hasAccess = await checkPermission(ctx, 'rooms.manage', 'rooms');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to manage rooms');
    }

    return prisma.roomType.create({
      data,
    });
  }

  /**
   * Get all room types
   */
  async getRoomTypes(): Promise<RoomType[]> {
    return prisma.roomType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get all units
   */
  async getAllUnits(filters?: {
    status?: UnitStatus;
    roomTypeId?: string;
    departmentId?: string;
  }): Promise<any[]> {
    return prisma.unit.findMany({
      where: {
        status: filters?.status,
        roomTypeId: filters?.roomTypeId,
        departmentId: filters?.departmentId,
      },
      include: {
        roomType: true,
        reservations: {
          where: {
            status: {
              in: ['CONFIRMED', 'CHECKED_IN'],
            },
          },
          select: {
            id: true,
            status: true,
            checkInDate: true,
            checkOutDate: true,
            guest: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { checkInDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { roomNumber: 'asc' },
    });
  }
}

export const roomService = new RoomService();
