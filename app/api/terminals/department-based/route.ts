/**
 * GET /api/terminals/section-based - List all section-based terminals
 * POST /api/terminals/section-based/toggle - Toggle active status for section terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { z } from 'zod';

const ToggleTerminalSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
  isActive: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check permission to view terminals
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : 'employee',
    };
    const hasAccess = await checkPermission(permCtx, 'terminals.read');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const sectionId = searchParams.get('sectionId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const whereFilters: any = {
      type: 'section',
    };

    if (sectionId) {
      // Find terminal for this section
      const section = await prisma.departmentSection.findUnique({
        where: { id: sectionId },
        select: { terminalId: true },
      });
      if (section?.terminalId) {
        whereFilters.id = section.terminalId;
      } else {
        whereFilters.id = 'none'; // No matching terminal
      }
    }

    const terminals = await prisma.terminal.findMany({
      where: whereFilters,
      include: {
        sections: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            department: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.terminal.count({ where: whereFilters });

    const response = {
      terminals,
      total,
      limit,
      offset,
    };

    return NextResponse.json(
      successResponse({
        data: response,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching department terminals:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch department terminals'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check permission to update terminals
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : 'employee',
    };
      const hasAccess = await checkPermission(permCtx, 'terminals.update');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const validatedData = ToggleTerminalSchema.parse(body);

    // Check if terminal exists and is department-based
    const terminal = await prisma.terminal.findUnique({
      where: { id: validatedData.terminalId },
      select: { id: true, type: true },
    });

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (terminal.type !== 'section') {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Only section-based terminals can be toggled'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    const updated = await prisma.terminal.update({
      where: { id: validatedData.terminalId },
      data: {
        isActive: validatedData.isActive,
      } as any,
      include: {
        sections: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            department: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      successResponse({
        message: `Terminal ${validatedData.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updated,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error toggling terminal status:', err);
    if (err instanceof z.ZodError) {
      const errors = err.errors.reduce((acc: Record<string, string[]>, e) => {
        const path = e.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(e.message);
        return acc;
      }, {});
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid request data', errors),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to toggle terminal status'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
