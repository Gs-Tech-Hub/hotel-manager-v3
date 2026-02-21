/**
 * CleaningService: Manage cleaning tasks, assignments, and QA inspections
 */

import { prisma } from '@/lib/auth/prisma';
import {
  CleaningTask,
  CleaningTaskStatus,
  CleaningPriority,
  CleaningLog,
} from '@prisma/client';
import { PermissionContext } from './types';
import { checkPermission } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/auth/audit';
import { roomService } from './RoomService';

export interface CreateCleaningTaskInput {
  unitId: string;
  taskType: string; // 'turnover', 'deep_clean', 'maintenance_clean', 'touch_up'
  priority?: CleaningPriority;
  notes?: string;
}

export interface CleaningLogInput {
  itemType: string;
  status: string;
  notes?: string;
}

export class CleaningService {
  /**
   * Create cleaning task
   */
  async createTask(
    data: CreateCleaningTaskInput,
    ctx: PermissionContext
  ): Promise<CleaningTask> {
    const hasAccess = await checkPermission(ctx, 'cleaning.assign', 'cleaning');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to create cleaning tasks');
    }

    const task = await prisma.cleaningTask.create({
      data: {
        unitId: data.unitId,
        taskType: data.taskType,
        priority: data.priority || CleaningPriority.NORMAL,
        status: CleaningTaskStatus.PENDING,
        notes: data.notes,
      },
    });

    // Update unit status
    await roomService.updateUnitStatus(data.unitId);

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'CLEANING_TASK_CREATED',
      resourceType: 'cleaning_task',
      resourceId: task.id,
      changes: { unitId: data.unitId, taskType: data.taskType },
    });

    return task;
  }

  /**
   * Assign task to cleaner
   */
  async assignTask(
    taskId: string,
    assignedToId: string,
    ctx: PermissionContext
  ): Promise<CleaningTask> {
    const hasAccess = await checkPermission(ctx, 'cleaning.assign', 'cleaning');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to assign tasks');
    }

    const task = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: { assignedToId },
    });

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'CLEANING_TASK_ASSIGNED',
      resourceType: 'cleaning_task',
      resourceId: taskId,
      changes: { assignedToId },
    });

    return task;
  }

  /**
   * Mark task as in-progress
   */
  async startTask(taskId: string, ctx: PermissionContext): Promise<CleaningTask> {
    const hasAccess = await checkPermission(ctx, 'cleaning.work', 'cleaning');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to work on cleaning tasks');
    }

    const task = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: {
        status: CleaningTaskStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    // Update unit status
    await roomService.updateUnitStatus(task.unitId);

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'CLEANING_TASK_STARTED',
      resourceType: 'cleaning_task',
      resourceId: taskId,
      changes: {},
    });

    return task;
  }

  /**
   * Log cleaning item completion
   */
  async logCleaningItem(
    taskId: string,
    data: CleaningLogInput,
    ctx: PermissionContext
  ): Promise<CleaningLog> {
    const hasAccess = await checkPermission(ctx, 'cleaning.work', 'cleaning');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to log cleaning items');
    }

    const log = await prisma.cleaningLog.create({
      data: {
        taskId,
        itemType: data.itemType,
        status: data.status,
        notes: data.notes,
        loggedById: ctx.userId!,
      },
    });

    return log;
  }

  /**
   * Complete task (mark for inspection)
   */
  async completeTask(
    taskId: string,
    notes?: string,
    ctx?: PermissionContext
  ): Promise<CleaningTask> {
    const task = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: {
        status: CleaningTaskStatus.COMPLETED,
        completedAt: new Date(),
        notes: notes || undefined,
      },
    });

    if (ctx) {
      await logAudit({
        userId: ctx.userId!,
        action: 'CLEANING_TASK_COMPLETED',
        resourceType: 'cleaning_task',
        resourceId: taskId,
        changes: { notes },
      });
    }

    return task;
  }

  /**
   * QA inspect task (approve or reject)
   */
  async inspectTask(
    taskId: string,
    approved: boolean,
    notes?: string,
    ctx?: PermissionContext
  ): Promise<CleaningTask> {
    const newStatus = approved
      ? CleaningTaskStatus.INSPECTED
      : CleaningTaskStatus.REJECTED;

    const task = await prisma.cleaningTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Cleaning task not found');
    }

    const updated = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: {
        status: newStatus,
        inspectedAt: new Date(),
        inspectedById: ctx?.userId,
        notes: notes || task.notes,
      },
    });

    // If approved, try to update unit status to available
    if (approved) {
      await roomService.updateUnitStatus(task.unitId);
    }

    if (ctx) {
      await logAudit({
        userId: ctx.userId,
        action: 'CLEANING_TASK_INSPECTED',
        resourceType: 'cleaning_task',
        resourceId: taskId,
        changes: { approved, notes },
      });
    }

    return updated;
  }

  /**
   * Get pending tasks (unassigned or in-progress)
   */
  async getPendingTasks(departmentId?: string): Promise<
    (CleaningTask & { unit: { roomNumber: string } })[]
  > {
    return prisma.cleaningTask.findMany({
      where: {
        status: { in: [CleaningTaskStatus.PENDING, CleaningTaskStatus.IN_PROGRESS] },
        unit: departmentId ? { departmentId } : undefined,
      },
      include: {
        unit: { select: { roomNumber: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get tasks by unit (history)
   */
  async getTasksByUnit(unitId: string): Promise<
    (CleaningTask & { logs: CleaningLog[] })[]
  > {
    return prisma.cleaningTask.findMany({
      where: { unitId },
      include: { logs: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Calculate average turnaround time (in hours)
   */
  async getAverageTurnaroundTime(
    unitKindFilter?: string,
    daysBack: number = 30
  ): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const completedTasks = await prisma.cleaningTask.findMany({
      where: {
        status: CleaningTaskStatus.INSPECTED,
        completedAt: { gte: since },
        unit: unitKindFilter ? { unitKind: unitKindFilter as any } : undefined,
      },
      select: {
        startedAt: true,
        completedAt: true,
      },
    });

    if (completedTasks.length === 0) {
      return 0;
    }

    let totalHours = 0;
    for (const task of completedTasks) {
      if (task.startedAt && task.completedAt) {
        const hours =
          (task.completedAt.getTime() - task.startedAt.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
      }
    }

    return Math.round(totalHours / completedTasks.length);
  }
}

export const cleaningService = new CleaningService();
