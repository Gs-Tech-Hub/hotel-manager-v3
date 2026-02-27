/**
 * POST /api/cleaning/tasks/[id]/start - Start a cleaning task
 * POST /api/cleaning/tasks/[id]/complete - Mark task as completed
 * POST /api/cleaning/tasks/[id]/inspect - QA inspect a completed task
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { cleaningService } from '@/src/services/CleaningService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { prisma } from '@/lib/auth/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id: taskId, action } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Load user with roles and check permissions
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

    // Check action permissions
    if (action === 'start') {
      const hasAccess = await checkPermission(permCtx, 'cleaning.work', 'cleaning');
      if (!hasAccess) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to start cleaning task'),
          { status: 403 }
        );
      }

      const task = await cleaningService.startTask(taskId, permCtx);
      return NextResponse.json(
        successResponse({ data: task, message: 'Cleaning task started' }),
        { status: 200 }
      );
    } else if (action === 'complete') {
      const hasAccess = await checkPermission(permCtx, 'cleaning.work', 'cleaning');
      if (!hasAccess) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to complete cleaning task'),
          { status: 403 }
        );
      }

      let body: any = {};
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        try {
          body = await request.json();
        } catch (e) {
          body = {};
        }
      }

      const task = await cleaningService.completeTask(taskId, body.notes, permCtx);

      return NextResponse.json(
        successResponse({ data: task, message: 'Cleaning task completed' }),
        { status: 200 }
      );
    } else if (action === 'inspect') {
      const hasAccess = await checkPermission(permCtx, 'cleaning.inspect', 'cleaning');
      if (!hasAccess) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to inspect cleaning task'),
          { status: 403 }
        );
      }

      let body: any = {};
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 0) {
        try {
          body = await request.json();
        } catch (e) {
          body = {};
        }
      }
      const approved = body.approved === true;

      const task = await cleaningService.inspectTask(taskId, approved, body.notes, permCtx);

      // If task is approved, mark room as AVAILABLE
      if (approved) {
        const cleTask = await prisma.cleaningTask.findUnique({
          where: { id: taskId },
          include: { unit: true },
        });

        if (cleTask && cleTask.unit) {
          // Check if there are other active tasks
          const otherActiveTasks = await prisma.cleaningTask.findMany({
            where: {
              unitId: cleTask.unitId,
              id: { not: taskId },
              status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
            },
          });

          if (otherActiveTasks.length === 0) {
            // All cleaning tasks are done and approved, mark room available
            await prisma.unit.update({
              where: { id: cleTask.unitId },
              data: {
                status: 'AVAILABLE',
                statusUpdatedAt: new Date(),
              },
            });

            // Log status change
            await prisma.unitStatusHistory.create({
              data: {
                unitId: cleTask.unitId,
                previousStatus: 'CLEANING',
                newStatus: 'AVAILABLE',
                reason: 'Cleaning task completed and inspected',
                changedBy: ctx.userId,
              },
            });
          }
        }
      }

      return NextResponse.json(
        successResponse({ data: task, message: approved ? 'Task approved' : 'Task rejected' }),
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, `Unknown action: ${action}`),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error(`Error performing cleaning task action:`, error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg.includes('Insufficient permissions')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, errorMsg),
        { status: 403 }
      );
    }

    if (errorMsg.includes('not found')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, errorMsg),
        { status: 404 }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}
