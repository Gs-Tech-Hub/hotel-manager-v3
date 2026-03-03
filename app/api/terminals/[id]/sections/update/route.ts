/**
 * PUT /api/terminals/[id]/sections/update - Update allowed sections for a terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { logAudit } from '@/lib/auth/audit';
import { z } from 'zod';

const UpdateTerminalSectionsSchema = z.object({
  allowedSectionIds: z.array(z.string()).optional().default([]),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: terminalId } = await params;
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

    // Check permission to manage terminals
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : 'employee',
    };

    // Allow if user is admin or has POS-related management permissions
    const isAdmin = user.isAdmin || hasAnyRole(user, ['admin', 'manager']);
    const hasOrdersPermission = await checkPermission(permCtx, 'orders.create', 'orders');
    const hasPOSTerminalAccess = await checkPermission(permCtx, 'pos_terminal.manage', 'pos_terminal');
    
    if (!isAdmin && !hasOrdersPermission && !hasPOSTerminalAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to manage terminals'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Validate request body
    const body = await request.json().catch(() => ({}));
    const validatedData = UpdateTerminalSectionsSchema.parse(body);

    // Find terminal
    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId },
      include: {
        sections: {
          select: { id: true, name: true },
        },
      },
    });

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Validate that all provided section IDs exist
    if (validatedData.allowedSectionIds.length > 0) {
      const sectionCount = await prisma.departmentSection.count({
        where: {
          id: {
            in: validatedData.allowedSectionIds,
          },
        },
      });

      if (sectionCount !== validatedData.allowedSectionIds.length) {
        return NextResponse.json(
          errorResponse(ErrorCodes.BAD_REQUEST, 'One or more section IDs are invalid'),
          { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
        );
      }
    }

    // Update terminal with new allowed sections
    const updatedTerminal = await prisma.terminal.update({
      where: { id: terminalId },
      data: {
        allowedSectionIds: JSON.stringify(validatedData.allowedSectionIds),
      },
      include: {
        sections: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });

    // Audit log
    try {
      await logAudit({
        action: 'update',
        resourceType: 'terminals',
        resourceId: terminalId,
        userId: ctx.userId,
        changes: {
          terminalName: updatedTerminal.name,
          previousSectionIds: terminal.sections.map(s => s.id),
          newSectionIds: validatedData.allowedSectionIds,
        },
      });
    } catch (auditError) {
      console.error('Audit log failed:', auditError);
    }

    const response = {
      ...updatedTerminal,
      allowedSectionIds: JSON.parse(updatedTerminal.allowedSectionIds),
    };

    return NextResponse.json(
      successResponse({ data: response }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating terminal sections:', error);

    if (error instanceof z.ZodError) {
      const formattedErrors: Record<string, string[]> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!formattedErrors[path]) {
          formattedErrors[path] = [];
        }
        formattedErrors[path].push(err.message);
      });
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Validation error', formattedErrors),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update terminal sections'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * GET /api/terminals/[id]/sections/update - Get available sections for a terminal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: terminalId } = await params;
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

    // Find terminal
    const terminal = await prisma.terminal.findUnique({
      where: { id: terminalId },
      include: {
        sections: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            departmentId: true,
          },
        },
      },
    });

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Get all available sections
    const allSections = await prisma.departmentSection.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        departmentId: true,
        hasTerminal: true,
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });

    const response = {
      terminal: {
        ...terminal,
        allowedSectionIds: JSON.parse(terminal.allowedSectionIds),
      },
      availableSections: allSections,
      currentSections: terminal.sections,
    };

    return NextResponse.json(
      successResponse({ data: response }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching terminal sections:', error);

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch terminal sections'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
