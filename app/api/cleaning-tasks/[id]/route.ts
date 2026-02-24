/**
 * GET /api/cleaning-tasks/[id] - Get cleaning task details
 * PUT /api/cleaning-tasks/[id] - Update cleaning task
 * DELETE /api/cleaning-tasks/[id] - Delete cleaning task
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, hasAnyRole, loadUserWithRoles } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { logAudit } from '@/lib/auth/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.cleaningTask.findUnique({
      where: { id },
      include: {
        unit: {
          include: { roomType: true },
        },
        routine: true,
        logs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Cleaning task not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({ data: task }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching cleaning task:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch cleaning task'),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Check permission
    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      );
    }

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'cleaning.manage', 'cleaning');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    // Verify task exists
    const existing = await prisma.cleaningTask.findUnique({
      where: { id },
      include: { unit: true },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Cleaning task not found'),
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      status,
      priority,
      assignedToId,
      notes,
      startedAt,
      completedAt,
      inspectedAt,
      inspectedById,
    } = body;

    // Update task
    const updated = await prisma.cleaningTask.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assignedToId !== undefined && { assignedToId }),
        ...(notes !== undefined && { notes }),
        ...(startedAt && { startedAt: new Date(startedAt) }),
        ...(completedAt && { completedAt: new Date(completedAt) }),
        ...(inspectedAt && { inspectedAt: new Date(inspectedAt) }),
        ...(inspectedById && { inspectedById }),
      },
      include: {
        unit: { include: { roomType: true } },
        routine: true,
      },
    });

    // If task is completed, update room status to AVAILABLE
    if (status === 'COMPLETED' || status === 'INSPECTED') {
      const unit = existing.unit;

      // Check if there are other pending/in-progress cleaning tasks for this unit
      const otherTasks = await prisma.cleaningTask.findMany({
        where: {
          unitId: unit.id,
          id: { not: id },
          status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
        },
      });

      // Only update to AVAILABLE if no other tasks are pending
      if (otherTasks.length === 0 && !unit.notes?.includes('maintenance')) {
        await prisma.unit.update({
          where: { id: unit.id },
          data: {
            status: 'AVAILABLE',
            statusUpdatedAt: new Date(),
          },
        });

        // Log status change
        await prisma.unitStatusHistory.create({
          data: {
            unitId: unit.id,
            previousStatus: 'CLEANING',
            newStatus: 'AVAILABLE',
            reason: `Cleaning task ${status.toLowerCase()}`,
            changedBy: ctx.userId,
          },
        });
      }
    }

    // Audit log
    await logAudit({
      userId: ctx.userId,
      action: 'cleaning_task_updated',
      resourceType: 'cleaning_task',
      resourceId: id,
      changes: { status: status || existing.status },
    });

    return NextResponse.json(
      successResponse({
        data: updated,
        message: 'Cleaning task updated successfully',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating cleaning task:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update cleaning task';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Check permission
    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      );
    }

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'cleaning.manage', 'cleaning');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    const task = await prisma.cleaningTask.findUnique({
      where: { id },
      include: {
        logs: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Cleaning task not found'),
        { status: 404 }
      );
    }

    // Prevent deletion if task is in progress or completed
    if (['IN_PROGRESS', 'COMPLETED', 'INSPECTED'].includes(task.status)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          'Cannot delete a task that is in progress or completed'
        ),
        { status: 409 }
      );
    }

    // Delete logs first
    await prisma.cleaningLog.deleteMany({
      where: { taskId: id },
    });

    // Delete task
    await prisma.cleaningTask.delete({
      where: { id },
    });

    // Audit log
    await logAudit({
      userId: ctx.userId,
      action: 'cleaning_task_deleted',
      resourceType: 'cleaning_task',
      resourceId: id,
    });

    return NextResponse.json(
      successResponse({
        message: 'Cleaning task deleted successfully',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting cleaning task:', error);
    const msg = error instanceof Error ? error.message : 'Failed to delete cleaning task';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
