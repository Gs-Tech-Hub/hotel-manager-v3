/**
 * GET /api/cleaning-tasks - List cleaning tasks
 * POST /api/cleaning-tasks - Create cleaning task
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, hasAnyRole, loadUserWithRoles } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const unitId = searchParams.get('unitId');
    const assignedToId = searchParams.get('assignedToId');
    const priority = searchParams.get('priority');

    // Build where clause
    const where: any = {};
    if (status) where.status = status;
    if (unitId) where.unitId = unitId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (priority) where.priority = priority;

    const tasks = await prisma.cleaningTask.findMany({
      where,
      include: {
        unit: {
          include: { roomType: true },
        },
        routine: true,
        logs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(
      successResponse({
        data: tasks,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching cleaning tasks:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch cleaning tasks'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const {
      unitId,
      routineId,
      taskType,
      priority,
      assignedToId,
      notes,
    } = body;

    // Validate required fields
    if (!unitId || !taskType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'unitId and taskType are required'),
        { status: 400 }
      );
    }

    // Verify unit exists
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
    });

    if (!unit) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Unit not found'),
        { status: 404 }
      );
    }

    // Create task
    const task = await prisma.cleaningTask.create({
      data: {
        unitId,
        routineId,
        taskType,
        priority: priority || 'NORMAL',
        assignedToId,
        notes,
      },
      include: {
        unit: { include: { roomType: true } },
        routine: true,
      },
    });

    // Update room status to CLEANING
    await prisma.unit.update({
      where: { id: unitId },
      data: {
        status: 'CLEANING',
        statusUpdatedAt: new Date(),
      },
    });

    // Log status change
    await prisma.unitStatusHistory.create({
      data: {
        unitId,
        previousStatus: unit.status,
        newStatus: 'CLEANING',
        reason: `Cleaning task created: ${taskType}`,
        changedBy: ctx.userId,
      },
    });

    return NextResponse.json(
      successResponse({
        data: task,
        message: 'Cleaning task created successfully',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating cleaning task:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create cleaning task';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
