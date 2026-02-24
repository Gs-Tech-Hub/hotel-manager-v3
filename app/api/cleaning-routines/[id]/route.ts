/**
 * GET /api/cleaning-routines/[id] - Get cleaning routine details
 * PUT /api/cleaning-routines/[id] - Update cleaning routine
 * DELETE /api/cleaning-routines/[id] - Delete cleaning routine
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

    const routine = await prisma.cleaningRoutine.findUnique({
      where: { id },
      include: {
        roomTypes: true,
        departments: true,
        tasks: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!routine) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Cleaning routine not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({ data: routine }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching cleaning routine:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch cleaning routine'),
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

    // Verify routine exists
    const existing = await prisma.cleaningRoutine.findUnique({
      where: { id },
      include: { roomTypes: true, departments: true },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Cleaning routine not found'),
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      code,
      name,
      description,
      type,
      frequency,
      estimatedMinutes,
      priority,
      checklist,
      isActive,
      roomTypeIds,
      departmentIds,
      notes,
    } = body;

    // Check code uniqueness if changed
    if (code && code !== existing.code) {
      const codeExists = await prisma.cleaningRoutine.findUnique({
        where: { code },
      });
      if (codeExists) {
        return NextResponse.json(
          errorResponse(ErrorCodes.CONFLICT, 'Cleaning routine code already exists'),
          { status: 409 }
        );
      }
    }

    // Update routine
    const updated = await prisma.cleaningRoutine.update({
      where: { id },
      data: {
        ...(code && { code }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(frequency && { frequency }),
        ...(estimatedMinutes && { estimatedMinutes }),
        ...(priority && { priority }),
        ...(checklist && { checklist }),
        ...(isActive !== undefined && { isActive }),
        ...(notes !== undefined && { notes }),
        ...(roomTypeIds && {
          roomTypes: {
            disconnect: existing.roomTypes.map((r) => ({ id: r.id })),
            connect: roomTypeIds.map((id: string) => ({ id })),
          },
        }),
        ...(departmentIds && {
          departments: {
            disconnect: existing.departments.map((d) => ({ id: d.id })),
            connect: departmentIds.map((id: string) => ({ id })),
          },
        }),
      },
      include: {
        roomTypes: true,
        departments: true,
      },
    });

    // Audit log
    await logAudit({
      userId: ctx.userId,
      action: 'CLEANING_ROUTINE_UPDATED',
      resourceType: 'cleaning_routine',
      resourceId: id,
      changes: { from: existing, to: updated },
    });

    return NextResponse.json(
      successResponse({
        data: updated,
        message: 'Cleaning routine updated successfully',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating cleaning routine:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update cleaning routine';
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

    // Check if routine exists and has active tasks
    const routine = await prisma.cleaningRoutine.findUnique({
      where: { id },
      include: {
        tasks: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
    });

    if (!routine) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Cleaning routine not found'),
        { status: 404 }
      );
    }

    if (routine.tasks.length > 0) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          'Cannot delete routine with active cleaning tasks'
        ),
        { status: 409 }
      );
    }

    // Delete routine
    await prisma.cleaningRoutine.delete({
      where: { id },
    });

    // Audit log
    await logAudit({
      userId: ctx.userId,
      action: 'CLEANING_ROUTINE_DELETED',
      resourceType: 'cleaning_routine',
      resourceId: id,
    });

    return NextResponse.json(
      successResponse({
        message: 'Cleaning routine deleted successfully',
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting cleaning routine:', error);
    const msg = error instanceof Error ? error.message : 'Failed to delete cleaning routine';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
