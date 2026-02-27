/**
 * ReservationService: Manage reservations, bookings, check-in/out, and pricing
 */

import { prisma } from '@/lib/auth/prisma';
import {
  Reservation,
  ReservationStatus,
  Guest,
  CleaningTask,
} from '@prisma/client';
import { PermissionContext } from './types';
import { checkPermission } from '@/lib/auth/rbac';
import { roomService } from './RoomService';
import { logAudit } from '@/lib/auth/audit';

export interface CreateReservationInput {
  unitId: string;
  guestId: string;
  checkInDate: Date;
  checkOutDate: Date;
  source?: string;
  notes?: string;
}

export interface ModifyReservationInput {
  checkInDate?: Date;
  checkOutDate?: Date;
  guestId?: string;
  notes?: string;
}

export interface SearchAvailabilityResult {
  unitId: string;
  unitKind: string;
  roomNumber: string;
  roomType: {
    id: string;
    name: string;
    capacity: number;
    imageUrl?: string;
  };
  pricePerNightCents: number;
  totalCents: number;
  nights: number;
}

export class ReservationService {
  /**
   * Search availability and get prices
   */
  async searchAvailability(
    checkInDate: Date,
    checkOutDate: Date,
    filters?: {
      unitKind?: string;
      capacity?: number;
      roomTypeId?: string;
    }
  ): Promise<SearchAvailabilityResult[]> {
    // Find available units
    const availableUnits = await roomService.findAvailableUnits(
      checkInDate,
      checkOutDate,
      filters as any
    );

    // Calculate nights and pricing
    const checkin = new Date(checkInDate);
    checkin.setUTCHours(0, 0, 0, 0);

    const checkout = new Date(checkOutDate);
    checkout.setUTCHours(0, 0, 0, 0);

    const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24));

    const results: SearchAvailabilityResult[] = [];

    for (const unit of availableUnits) {
      const totalCents = await roomService.calculatePrice(unit.id, checkInDate, checkOutDate);
      const pricePerNightCents = Math.round(totalCents / nights);

      results.push({
        unitId: unit.id,
        unitKind: unit.unitKind,
        roomNumber: unit.roomNumber,
        roomType: {
          id: unit.roomType.id,
          name: unit.roomType.name,
          capacity: unit.roomType.capacity,
          imageUrl: unit.roomType.imageUrl ?? undefined,
        },
        pricePerNightCents,
        totalCents,
        nights,
      });
    }

    return results;
  }

  /**
   * Create reservation with conflict detection
   */
  async createReservation(
    data: CreateReservationInput,
    ctx: PermissionContext,
    idempotencyKey?: string
  ): Promise<{ reservation: Reservation; cleaningTaskCreated: boolean }> {
    // Check permission
    const hasAccess = await checkPermission(ctx, 'reservations.create', 'reservations');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to create reservations');
    }

    // Normalize dates
    const checkInDate = new Date(data.checkInDate);
    checkInDate.setUTCHours(0, 0, 0, 0);

    const checkOutDate = new Date(data.checkOutDate);
    checkOutDate.setUTCHours(0, 0, 0, 0);

    // Check for idempotency key (prevent double-booking on retry)
    if (idempotencyKey) {
      const existing = await prisma.reservation.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return { reservation: existing, cleaningTaskCreated: false };
      }
    }

    // Check for conflicts
    const conflict = await prisma.reservation.findFirst({
      where: {
        unitId: data.unitId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        AND: [
          { checkInDate: { lt: checkOutDate } },
          { checkOutDate: { gt: checkInDate } },
        ],
      },
    });

    if (conflict) {
      throw new Error('Unit not available for selected dates');
    }

    // Calculate price
    const totalPriceCents = await roomService.calculatePrice(
      data.unitId,
      checkInDate,
      checkOutDate
    );

    // Create reservation in transaction
    let reservation: Reservation;
    const cleaningTaskCreated = false;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const res = await tx.reservation.create({
          data: {
            unitId: data.unitId,
            guestId: data.guestId,
            checkInDate,
            checkOutDate,
            totalPriceCents,
            currency: 'USD',
            source: data.source || 'api',
            notes: data.notes,
            status: ReservationStatus.CONFIRMED,
            idempotencyKey,
            createdBy: ctx.userId,
          },
        });

        // Update unit status
        await roomService.updateUnitStatus(data.unitId);

        return res;
      });

      reservation = result;

      // Log audit
      await logAudit({
        userId: ctx.userId!,
        action: 'RESERVATION_CREATED',
        resourceType: 'reservation',
        resourceId: reservation.id,
        changes: {
          confirmationNo: reservation.confirmationNo,
          guestId: data.guestId,
          unitId: data.unitId,
          total: totalPriceCents,
        },
      });
    } catch (error) {
      throw new Error(`Failed to create reservation: ${error}`);
    }

    return { reservation, cleaningTaskCreated };
  }

  /**
   * Modify existing reservation
   */
  async modifyReservation(
    reservationId: string,
    data: ModifyReservationInput,
    ctx: PermissionContext
  ): Promise<Reservation> {
    const hasAccess = await checkPermission(ctx, 'reservations.modify', 'reservations');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to modify reservations');
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const checkInDate = data.checkInDate || reservation.checkInDate;
    const checkOutDate = data.checkOutDate || reservation.checkOutDate;

    // Check for conflicts with new dates
    if (data.checkInDate || data.checkOutDate) {
      const conflict = await prisma.reservation.findFirst({
        where: {
          id: { not: reservationId },
          unitId: reservation.unitId,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          AND: [
            { checkInDate: { lt: checkOutDate } },
            { checkOutDate: { gt: checkInDate } },
          ],
        },
      });

      if (conflict) {
        throw new Error('Unit not available for new dates');
      }
    }

    // Calculate new price if dates changed
    let totalPriceCents = reservation.totalPriceCents;
    if (data.checkInDate || data.checkOutDate) {
      totalPriceCents = await roomService.calculatePrice(
        reservation.unitId,
        checkInDate,
        checkOutDate
      );
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        checkInDate,
        checkOutDate,
        guestId: data.guestId || reservation.guestId,
        notes: data.notes || reservation.notes,
        totalPriceCents,
      },
    });

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'RESERVATION_MODIFIED',
      resourceType: 'reservation',
      resourceId: reservationId,
      changes: data,
    });

    return updated;
  }

  /**
   * Cancel reservation
   */
  async cancelReservation(
    reservationId: string,
    reason: string,
    ctx: PermissionContext
  ): Promise<Reservation> {
    const hasAccess = await checkPermission(ctx, 'reservations.cancel', 'reservations');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to cancel reservations');
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const cancelled = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CANCELLED,
        notes: `${reservation.notes || ''}\nCancelled: ${reason}`,
      },
    });

    // Update unit status
    await roomService.updateUnitStatus(reservation.unitId);

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'RESERVATION_CANCELLED',
      resourceType: 'reservation',
      resourceId: reservationId,
      changes: { reason },
    });

    return cancelled;
  }

  /**
   * Check-in guest
   */
  async checkInGuest(
    reservationId: string,
    actualCheckInTime: Date,
    ctx: PermissionContext
  ): Promise<Reservation> {
    const hasAccess = await checkPermission(ctx, 'reservations.checkin', 'reservations');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to check-in guests');
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { unit: true },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new Error(`Cannot check-in a reservation with status ${reservation.status}. Must be CONFIRMED.`);
    }

    // Verify no active conflicts
    const conflict = await prisma.reservation.findFirst({
      where: {
        unitId: reservation.unitId,
        id: { not: reservationId },
        status: { in: ['CHECKED_IN'] },
      },
    });

    if (conflict) {
      throw new Error('Unit is already occupied by another guest');
    }

    const checkedIn = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: ReservationStatus.CHECKED_IN,
        checkInTime: actualCheckInTime,
      },
    });

    // Update unit status to OCCUPIED
    await prisma.unit.update({
      where: { id: reservation.unitId },
      data: {
        status: 'OCCUPIED',
        statusUpdatedAt: new Date(),
      },
    });

    // Log status change
    await prisma.unitStatusHistory.create({
      data: {
        unitId: reservation.unitId,
        previousStatus: reservation.unit.status,
        newStatus: 'OCCUPIED',
        reason: 'Guest checked in',
        changedBy: ctx.userId,
      },
    });

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'RESERVATION_CHECKED_IN',
      resourceType: 'reservation',
      resourceId: reservationId,
      changes: { checkInTime: actualCheckInTime, roomStatus: 'AVAILABLE → OCCUPIED' },
    });

    return checkedIn;
  }

  /**
   * Check-out guest and trigger cleaning task
   */
  async checkOutGuest(
    reservationId: string,
    actualCheckOutTime: Date,
    ctx: PermissionContext,
    cleaningOptions?: {
      cleaningRoutineId?: string;
      cleaningPriority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      assignCleanerTo?: string;
      cleaningNotes?: string;
    }
  ): Promise<{ reservation: Reservation; cleaningTask: CleaningTask }> {
    const hasAccess = await checkPermission(ctx, 'reservations.checkout', 'reservations');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to check-out guests');
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        unit: {
          include: { roomType: true, department: true },
        },
        guest: true,
      },
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status !== 'CHECKED_IN') {
      throw new Error(`Cannot checkout a reservation with status ${reservation.status}. Must be CHECKED_IN.`);
    }

    let checkedOut: Reservation;
    let cleaningTask: CleaningTask;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update reservation
        checkedOut = await tx.reservation.update({
          where: { id: reservationId },
          data: {
            status: ReservationStatus.CHECKED_OUT,
            checkOutTime: actualCheckOutTime,
          },
        });

        // Get cleaning routine
        let routineId: string | undefined;
        let priority = cleaningOptions?.cleaningPriority || 'NORMAL';
        
        if (cleaningOptions?.cleaningRoutineId) {
          routineId = cleaningOptions.cleaningRoutineId;
          // Get routine to check its priority
          const routine = await tx.cleaningRoutine.findUnique({
            where: { id: routineId },
          });
          if (routine && !cleaningOptions.cleaningPriority) {
            priority = routine.priority as any;
          }
        } else {
          // Find default turnover routine for this room type
          const routine = await tx.cleaningRoutine.findFirst({
            where: {
              type: 'TURNOVER',
              isActive: true,
              frequency: 'EVERY_CHECKOUT',
              roomTypes: {
                some: { id: reservation.unit.roomTypeId },
              },
            },
          });
          if (routine) {
            routineId = routine.id;
            if (!cleaningOptions?.cleaningPriority) {
              priority = routine.priority as any;
            }
          }
        }

        // Create cleaning task
        const task = await tx.cleaningTask.create({
          data: {
            unitId: reservation.unitId,
            routineId,
            taskType: 'turnover',
            status: 'PENDING',
            priority,
            assignedToId: cleaningOptions?.assignCleanerTo,
            notes: cleaningOptions?.cleaningNotes || 
              `Turnover cleaning after ${reservation.guest.firstName} ${reservation.guest.lastName} checkout`,
          },
          include: {
            routine: true,
          },
        });

        // Update unit status to CLEANING
        await tx.unit.update({
          where: { id: reservation.unitId },
          data: {
            status: 'CLEANING',
            statusUpdatedAt: new Date(),
          },
        });

        // Log status change
        await tx.unitStatusHistory.create({
          data: {
            unitId: reservation.unitId,
            previousStatus: 'OCCUPIED',
            newStatus: 'CLEANING',
            reason: 'Guest checkout - turnover cleaning initiated',
            changedBy: ctx.userId,
          },
        });

        return { checkedOut, cleaningTask: task };
      });

      cleaningTask = result.cleaningTask;
      checkedOut = result.checkedOut;
    } catch (error) {
      throw new Error(`Failed to check-out guest: ${error}`);
    }

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'RESERVATION_CHECKED_OUT',
      resourceType: 'reservation',
      resourceId: reservationId,
      changes: { 
        checkOutTime: actualCheckOutTime, 
        cleaningTaskId: cleaningTask.id,
        roomStatus: 'OCCUPIED → CLEANING',
      },
    });

    return { reservation: checkedOut, cleaningTask };
  }

  /**
   * Get active reservations (checked-in, not yet checked-out)
   */
  async getActiveReservations(): Promise<
    (Reservation & { guest: Guest; unit: { roomNumber: string } })[]
  > {
    return prisma.reservation.findMany({
      where: {
        status: 'CHECKED_IN',
      },
      include: {
        guest: true,
        unit: {
          select: { roomNumber: true },
        },
      },
      orderBy: { checkOutDate: 'asc' },
    });
  }

  /**
   * Detect overlapping reservations (for reconciliation)
   */
  async findConflicts(): Promise<
    Array<{ unitId: string; conflicts: Reservation[] }>
  > {
    const activeReservations = await prisma.reservation.findMany({
      where: {
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
      orderBy: [{ unitId: 'asc' }, { checkInDate: 'asc' }],
    });

    const conflicts: Array<{ unitId: string; conflicts: Reservation[] }> = [];

    // Group by unit
    const byUnit = new Map<string, Reservation[]>();
    for (const res of activeReservations) {
      if (!byUnit.has(res.unitId)) {
        byUnit.set(res.unitId, []);
      }
      byUnit.get(res.unitId)!.push(res);
    }

    // Check for overlaps
    for (const [unitId, reservations] of byUnit.entries()) {
      for (let i = 0; i < reservations.length - 1; i++) {
        if (reservations[i].checkOutDate > reservations[i + 1].checkInDate) {
          conflicts.push({
            unitId,
            conflicts: [reservations[i], reservations[i + 1]],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Get reservation by ID with full details
   */
  async getReservationDetail(reservationId: string) {
    return prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        unit: {
          include: { roomType: true },
        },
      },
    });
  }
}

export const reservationService = new ReservationService();
