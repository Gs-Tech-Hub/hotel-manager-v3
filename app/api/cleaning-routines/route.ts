/**
 * GET /api/cleaning-routines - List cleaning routines
 * POST /api/cleaning-routines - Create cleaning routine
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
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const departmentId = searchParams.get('departmentId');

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (isActive !== null) where.isActive = isActive === 'true';
    if (departmentId) {
      where.departments = {
        some: { id: departmentId },
      };
    }

    const routines = await prisma.cleaningRoutine.findMany({
      where,
      include: {
        roomTypes: true,
        departments: true,
        tasks: {
          where: { status: { not: 'CANCELLED' } },
          take: 5, // Last 5 tasks
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      successResponse({
        data: routines,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching cleaning routines:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch cleaning routines'),
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

    // Admin or manager check
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
      code,
      name,
      description,
      type,
      frequency,
      estimatedMinutes,
      priority,
      checklist,
      roomTypeIds,
      departmentIds,
      notes,
    } = body;

    // Validate required fields
    if (!code || !name || !type || !frequency) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'code, name, type, and frequency are required'),
        { status: 400 }
      );
    }

    // Check code uniqueness
    const existing = await prisma.cleaningRoutine.findUnique({
      where: { code },
    });
    if (existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Cleaning routine code already exists'),
        { status: 409 }
      );
    }

    // Create routine with relationships
    const routine = await prisma.cleaningRoutine.create({
      data: {
        code,
        name,
        description,
        type,
        frequency,
        estimatedMinutes: estimatedMinutes || 30,
        priority: priority || 'NORMAL',
        checklist: checklist || [],
        notes,
        roomTypes: roomTypeIds
          ? {
              connect: roomTypeIds.map((id: string) => ({ id })),
            }
          : undefined,
        departments: departmentIds
          ? {
              connect: departmentIds.map((id: string) => ({ id })),
            }
          : undefined,
      },
      include: {
        roomTypes: true,
        departments: true,
      },
    });

    return NextResponse.json(
      successResponse({
        data: routine,
        message: 'Cleaning routine created successfully',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating cleaning routine:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create cleaning routine';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
