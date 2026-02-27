/**
 * MaintenanceService: Manage maintenance requests, work orders, and tracking
 */

import { prisma } from '@/lib/auth/prisma';
import {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceLog,
} from '@prisma/client';
import { PermissionContext } from './types';
import { checkPermission } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/auth/audit';
import { roomService } from './RoomService';

export interface CreateMaintenanceRequestInput {
  unitId: string;
  category: string; // 'electrical', 'plumbing', 'hvac', 'appliance', 'structural', 'other'
  description: string;
  priority?: MaintenancePriority;
  requestedBy: string; // User ID
}

export interface MaintenanceLogInput {
  workDescription: string;
  status: MaintenanceStatus;
  partsUsed?: Record<string, number>;
  costCents?: number;
  notes?: string;
}

export class MaintenanceService {
  /**
   * Create maintenance request
   */
  async createRequest(
    data: CreateMaintenanceRequestInput,
    ctx: PermissionContext
  ): Promise<MaintenanceRequest> {
    const hasAccess = await checkPermission(ctx, 'maintenance.request', 'maintenance');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to create maintenance requests');
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        unitId: data.unitId,
        category: data.category,
        description: data.description,
        priority: data.priority || MaintenancePriority.NORMAL,
        status: MaintenanceStatus.OPEN,
        requestedBy: data.requestedBy,
      },
    });

    // Update unit status to MAINTENANCE
    const unit = await prisma.unit.findUnique({
      where: { id: data.unitId },
    });

    if (unit && unit.status !== 'MAINTENANCE') {
      await prisma.unit.update({
        where: { id: data.unitId },
        data: {
          status: 'MAINTENANCE',
          statusUpdatedAt: new Date(),
        },
      });

      await prisma.unitStatusHistory.create({
        data: {
          unitId: data.unitId,
          previousStatus: unit.status,
          newStatus: 'MAINTENANCE',
          reason: `Maintenance request created: ${data.category}`,
          changedBy: ctx.userId,
        },
      });
    }

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'MAINTENANCE_REQUEST_CREATED',
      resourceType: 'maintenance_request',
      resourceId: request.id,
      changes: {
        unitId: data.unitId,
        category: data.category,
        priority: data.priority,
      },
    });

    return request;
  }

  /**
   * Assign request to technician
   */
  async assignRequest(
    requestId: string,
    assignedToId: string,
    ctx: PermissionContext
  ): Promise<MaintenanceRequest> {
    const hasAccess = await checkPermission(ctx, 'maintenance.assign', 'maintenance');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to assign requests');
    }

    const request = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        assignedToId,
        status: MaintenanceStatus.ASSIGNED,
      },
    });

    // Update unit status
    await roomService.updateUnitStatus(request.unitId);

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'MAINTENANCE_REQUEST_ASSIGNED',
      resourceType: 'maintenance_request',
      resourceId: requestId,
      changes: { assignedToId },
    });

    return request;
  }

  /**
   * Log work (technician work log entry)
   */
  async logWork(
    requestId: string,
    data: MaintenanceLogInput,
    ctx: PermissionContext
  ): Promise<MaintenanceLog> {
    const hasAccess = await checkPermission(ctx, 'maintenance.work', 'maintenance');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to log maintenance work');
    }

    // Update request status
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Maintenance request not found');
    }

    // Update status and start time if first log
    if (request.status === MaintenanceStatus.ASSIGNED) {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          status: MaintenanceStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });
    }

    // Create log entry
    const log = await prisma.maintenanceLog.create({
      data: {
        requestId,
        status: data.status,
        workDescription: data.workDescription,
        partsUsed: data.partsUsed ? JSON.stringify(data.partsUsed) : null,
        costCents: data.costCents,
        notes: data.notes,
        loggedById: ctx.userId!,
      },
    });

    // Update unit status
    await roomService.updateUnitStatus(request.unitId);

    return log;
  }

  /**
   * Mark request as completed (by technician)
   */
  async completeRequest(
    requestId: string,
    ctx: PermissionContext
  ): Promise<MaintenanceRequest> {
    const hasAccess = await checkPermission(ctx, 'maintenance.work', 'maintenance');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to complete maintenance requests');
    }

    const request = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: MaintenanceStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'MAINTENANCE_REQUEST_COMPLETED',
      resourceType: 'maintenance_request',
      resourceId: requestId,
      changes: {},
    });

    return request;
  }

  /**
   * Verify completion (by manager)
   */
  async verifyCompletion(
    requestId: string,
    approved: boolean,
    notes?: string,
    ctx?: PermissionContext
  ): Promise<MaintenanceRequest> {
    const newStatus = approved
      ? MaintenanceStatus.VERIFIED
      : MaintenanceStatus.IN_PROGRESS;

    const request = await prisma.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        verifiedAt: approved ? new Date() : null,
        verifiedById: approved ? ctx?.userId : null,
        notes: notes || undefined,
      },
    });

    // If verified, close it and update unit status
    if (approved) {
      await prisma.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: MaintenanceStatus.CLOSED },
      });

      await roomService.updateUnitStatus(request.unitId);
    }

    if (ctx) {
      await logAudit({
        userId: ctx.userId,
        action: 'MAINTENANCE_REQUEST_VERIFIED',
        resourceType: 'maintenance_request',
        resourceId: requestId,
        changes: { approved, notes },
      });
    }

    return request;
  }

  /**
   * Get open/pending requests
   */
  async getOpenRequests(
    priority?: MaintenancePriority
  ): Promise<(MaintenanceRequest & { unit: { roomNumber: string } })[]> {
    return prisma.maintenanceRequest.findMany({
      where: {
        status: {
          in: [
            MaintenanceStatus.OPEN,
            MaintenanceStatus.ASSIGNED,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.ON_HOLD,
            MaintenanceStatus.COMPLETED,
            MaintenanceStatus.VERIFIED,
          ],
        },
        priority: priority ? { equals: priority } : undefined,
      },
      include: {
        unit: { select: { roomNumber: true } },
      },
      orderBy: [{ priority: 'asc' }, { status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get requests by unit
   */
  async getRequestsByUnit(unitId: string): Promise<
    (MaintenanceRequest & { logs: MaintenanceLog[] })[]
  > {
    return prisma.maintenanceRequest.findMany({
      where: { unitId },
      include: { logs: { orderBy: { loggedAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get average response time (hours from creation to assignment)
   */
  async getAverageResponseTime(
    categoryFilter?: string,
    daysBack: number = 30
  ): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const assignedRequests = await prisma.maintenanceRequest.findMany({
      where: {
        status: {
          in: [
            MaintenanceStatus.ASSIGNED,
            MaintenanceStatus.IN_PROGRESS,
            MaintenanceStatus.COMPLETED,
            MaintenanceStatus.VERIFIED,
            MaintenanceStatus.CLOSED,
          ],
        },
        createdAt: { gte: since },
        category: categoryFilter ? { equals: categoryFilter } : undefined,
      },
      select: {
        createdAt: true,
        startedAt: true,
      },
    });

    if (assignedRequests.length === 0) {
      return 0;
    }

    let totalHours = 0;
    let count = 0;

    for (const req of assignedRequests) {
      if (req.startedAt) {
        const hours =
          (req.startedAt.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        count++;
      }
    }

    return count > 0 ? Math.round(totalHours / count) : 0;
  }

  /**
   * Calculate total maintenance costs
   */
  async getTotalCosts(startDate: Date, endDate: Date): Promise<number> {
    const logs = await prisma.maintenanceLog.findMany({
      where: {
        loggedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        costCents: true,
      },
    });

    return logs.reduce((sum, log) => sum + (log.costCents || 0), 0);
  }

  /**
   * Get request detail with history
   */
  async getRequestDetail(requestId: string) {
    return prisma.maintenanceRequest.findUnique({
      where: { id: requestId },
      include: {
        unit: {
          include: { roomType: true },
        },
        logs: {
          orderBy: { loggedAt: 'asc' },
        },
      },
    });
  }
}

export const maintenanceService = new MaintenanceService();
