/**
 * CleaningService: Manage cleaning tasks, assignments, and QA inspections
 */

import { prisma } from '@/lib/auth/prisma';
import {
  CleaningTask,
  CleaningTaskStatus,
  CleaningPriority,
  CleaningLog,
  CleaningRoutine,
} from '@prisma/client';
import { PermissionContext } from './types';
import { checkPermission } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/auth/audit';
import { roomService } from './RoomService';

export interface CreateCleaningTaskInput {
  unitId: string;
  taskType: string; // 'turnover', 'deep_clean', 'maintenance_clean', 'touch_up'
  routineId?: string;
  priority?: CleaningPriority;
  notes?: string;
}

export interface CleaningLogInput {
  itemType: string;
  status: string;
  notes?: string;
}

export interface CreateCleaningRoutineInput {
  code: string;
  name: string;
  description?: string;
  type: string; // TURNOVER, DEEP, MAINTENANCE, TOUCH_UP, LINEN_CHANGE, NIGHT_AUDIT
  frequency: string; // EVERY_CHECKOUT, DAILY, WEEKLY, BIWEEKLY, MONTHLY, AS_NEEDED
  estimatedMinutes: number;
  priority?: CleaningPriority;
  checklist?: any[];
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

    // Determine priority from routine if not specified
    let priority = data.priority || CleaningPriority.NORMAL;
    if (data.routineId) {
      const routine = await prisma.cleaningRoutine.findUnique({
        where: { id: data.routineId },
      });
      if (routine && !data.priority) {
        priority = routine.priority as any;
      }
    }

    const task = await prisma.cleaningTask.create({
      data: {
        unitId: data.unitId,
        routineId: data.routineId,
        taskType: data.taskType,
        priority,
        status: CleaningTaskStatus.PENDING,
        notes: data.notes,
      },
    });

    // Update unit status to CLEANING
    const unit = await prisma.unit.findUnique({
      where: { id: data.unitId },
    });

    if (unit && unit.status !== 'CLEANING') {
      await prisma.unit.update({
        where: { id: data.unitId },
        data: {
          status: 'CLEANING',
          statusUpdatedAt: new Date(),
        },
      });

      await prisma.unitStatusHistory.create({
        data: {
          unitId: data.unitId,
          previousStatus: unit.status,
          newStatus: 'CLEANING',
          reason: `Cleaning task created: ${data.taskType}`,
          changedBy: ctx.userId,
        },
      });
    }

    // Log audit
    await logAudit({
      userId: ctx.userId!,
      action: 'CLEANING_TASK_CREATED',
      resourceType: 'cleaning_task',
      resourceId: task.id,
      changes: { unitId: data.unitId, taskType: data.taskType, routineId: data.routineId },
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
    const existingTask = await prisma.cleaningTask.findUnique({
      where: { id: taskId },
      include: { unit: true },
    });

    if (!existingTask) {
      throw new Error('Cleaning task not found');
    }

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
      include: { unit: true },
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

    // If approved, check if room can go back to available
    if (approved) {
      const otherActiveTasks = await prisma.cleaningTask.findMany({
        where: {
          unitId: task.unitId,
          id: { not: taskId },
          status: { in: [CleaningTaskStatus.PENDING, CleaningTaskStatus.IN_PROGRESS, CleaningTaskStatus.COMPLETED] },
        },
      });

      // Only mark available if no other active tasks
      if (otherActiveTasks.length === 0) {
        await prisma.unit.update({
          where: { id: task.unitId },
          data: {
            status: 'AVAILABLE',
            statusUpdatedAt: new Date(),
          },
        });

        // Log status change
        await prisma.unitStatusHistory.create({
          data: {
            unitId: task.unitId,
            previousStatus: 'CLEANING',
            newStatus: 'AVAILABLE',
            reason: 'Cleaning task inspected and approved',
            changedBy: ctx?.userId,
          },
        });
      }
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

  /**
   * Create cleaning routine (template)
   */
  async createRoutine(
    data: CreateCleaningRoutineInput,
    ctx: PermissionContext
  ): Promise<CleaningRoutine> {
    const hasAccess = await checkPermission(ctx, 'cleaning.manage', 'cleaning');
    if (!hasAccess) {
      throw new Error('Insufficient permissions to create cleaning routines');
    }

    const routine = await prisma.cleaningRoutine.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        type: data.type as any,
        frequency: data.frequency as any,
        estimatedMinutes: data.estimatedMinutes,
        priority: data.priority || CleaningPriority.NORMAL,
        checklist: data.checklist || [],
        notes: data.notes,
        isActive: true,
      },
    });

    await logAudit({
      userId: ctx.userId!,
      action: 'CLEANING_ROUTINE_CREATED',
      resourceType: 'cleaning_routine',
      resourceId: routine.id,
      changes: data,
    });

    return routine;
  }

  /**
   * Get all active cleaning routines
   */
  async getRoutines(
    type?: string,
    frequency?: string
  ): Promise<CleaningRoutine[]> {
    return prisma.cleaningRoutine.findMany({
      where: {
        isActive: true,
        ...(type && { type: type as any }),
        ...(frequency && { frequency: frequency as any }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get cleaning routine by ID
   */
  async getRoutineDetail(routineId: string) {
    return prisma.cleaningRoutine.findUnique({
      where: { id: routineId },
      include: {
        roomTypes: true,
        departments: true,
        tasks: {
          where: { status: { not: 'CANCELLED' } },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get cleaning routine for room type and cleaning type
   */
  async getRoutineForRoomType(
    roomTypeId: string,
    cleaningType: string
  ): Promise<CleaningRoutine | null> {
    return prisma.cleaningRoutine.findFirst({
      where: {
        type: cleaningType as any,
        isActive: true,
        roomTypes: {
          some: { id: roomTypeId },
        },
      },
    });
  }

  /**
   * Create task from routine template
   */
  async createTaskFromRoutine(
    unitId: string,
    routineId: string,
    assignedToId?: string,
    ctx?: PermissionContext
  ): Promise<CleaningTask> {
    const routine = await prisma.cleaningRoutine.findUnique({
      where: { id: routineId },
    });

    if (!routine) {
      throw new Error('Cleaning routine not found');
    }

    const task = await prisma.cleaningTask.create({
      data: {
        unitId,
        routineId,
        taskType: routine.type.toLowerCase(),
        priority: routine.priority,
        assignedToId,
        status: CleaningTaskStatus.PENDING,
      },
    });

    if (ctx) {
      await logAudit({
        userId: ctx.userId!,
        action: 'CLEANING_TASK_CREATED_FROM_ROUTINE',
        resourceType: 'cleaning_task',
        resourceId: task.id,
        changes: { routineId, unitId },
      });
    }

    return task;
  }

}

export const cleaningService = new CleaningService();
