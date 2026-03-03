/**
 * GET /api/terminals/[id] - Get terminal by ID
 * PUT /api/terminals/[id] - Update terminal
 * DELETE /api/terminals/[id] - Delete terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { z } from 'zod';

const UpdateTerminalSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['consolidated', 'section']).optional(),
  allowedSectionIds: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  status: z.enum(['online', 'offline', 'maintenance']).optional(),
});

type Params = {
  id: string;
};

export async function GET(request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
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
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'terminals.read', 'terminals');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const terminal = await prisma.terminal.findUnique({
      where: { id },
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

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Parse JSON fields
    const allowedSectionIds = JSON.parse((terminal as any).allowedSectionIds || '[]');

    return NextResponse.json(
      successResponse({
        data: {
          ...terminal,
          allowedSectionIds,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching terminal:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch terminal'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
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
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'terminals.update', 'terminals');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check if terminal exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { id },
    });

    if (!existingTerminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const body = await request.json();
    const validatedData = UpdateTerminalSchema.parse(body);

    // If setting as default consolidated, unset other defaults
    if (validatedData.isDefault && validatedData.type === 'consolidated') {
      await prisma.terminal.updateMany({
        where: {
          type: 'consolidated',
          NOT: { id },
        },
        data: {
          isDefault: false,
        } as any,
      });
    }

    const updateData: any = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.allowedSectionIds !== undefined) {
      updateData.allowedSectionIds = JSON.stringify(validatedData.allowedSectionIds);
    }
    if (validatedData.isDefault !== undefined) updateData.isDefault = validatedData.isDefault;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;

    const updated = await prisma.terminal.update({
      where: { id },
      data: updateData,
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

    // Parse JSON fields
    const allowedSectionIds = JSON.parse((updated as any).allowedSectionIds || '[]');

    return NextResponse.json(
      successResponse({
        message: 'Terminal updated successfully',
        data: {
          ...updated,
          allowedSectionIds,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error updating terminal:', err);
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
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update terminal'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { id } = await params;
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

    // Check permission to delete terminals
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'terminals.delete', 'terminals');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check if terminal exists
    const existingTerminal = await prisma.terminal.findUnique({
      where: { id },
    });

    if (!existingTerminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if it's the default terminal
    if ((existingTerminal as any).isDefault) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Cannot delete the default consolidated terminal'),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    // Delete terminal (sections will have their terminalId set to null due to SetNull)
    await prisma.terminal.delete({
      where: { id },
    });

    return NextResponse.json(
      successResponse({
        message: 'Terminal deleted successfully',
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error deleting terminal:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete terminal'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
