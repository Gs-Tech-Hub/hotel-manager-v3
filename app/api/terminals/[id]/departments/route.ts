/**
 * GET /api/terminals/[id]/sections - Get allowed sections for consolidated terminal
 * PUT /api/terminals/[id]/sections - Update allowed sections for consolidated terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { z } from 'zod';

const UpdateDepartmentsSchema = z.object({
  sectionIds: z.array(z.string()).default([]),
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
      userType: user.isAdmin ? 'admin' : 'employee',
    };
    const hasAccess = await checkPermission(permCtx, 'terminals.read');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const terminal = await prisma.terminal.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        allowedSectionIds: true,
      } as any,
    }) as any;

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (terminal.type !== 'consolidated') {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Only consolidated terminals support section restrictions'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    const allowedSectionIds = JSON.parse((terminal as any).allowedSectionIds || '[]');

    // Load full section info
    const sections = await prisma.departmentSection.findMany({
      where: {
        id: {
          in: allowedSectionIds,
        },
      },
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
    });

    return NextResponse.json(
      successResponse({
        data: {
          terminalId: terminal.id,
          terminalName: terminal.name,
          allowedSectionIds,
          sections,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching terminal departments:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch terminal departments'),
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
      userType: user.isAdmin ? 'admin' : 'employee',
    };
      const hasAccess = await checkPermission(permCtx, 'terminals.update');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const terminal = await prisma.terminal.findUnique({
      where: { id },
      select: { id: true, type: true },
    });

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (terminal.type !== 'consolidated') {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Only consolidated terminals support department restrictions'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    const body = await request.json();
    const validatedData = UpdateDepartmentsSchema.parse(body);

    // Verify all section IDs exist
    const sections = await prisma.departmentSection.findMany({
      where: {
        id: {
          in: validatedData.sectionIds,
        },
      },
      select: { id: true },
    });

    if (sections.length !== validatedData.sectionIds.length) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'One or more section IDs do not exist'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    const updated = await prisma.terminal.update({
      where: { id },
      data: {
        allowedSectionIds: JSON.stringify(validatedData.sectionIds),
      } as any,
      select: {
        id: true,
        name: true,
        type: true,
        allowedSectionIds: true,
      } as any,
    });

    const allowedSectionIds = JSON.parse((updated as any).allowedSectionIds || '[]');

    // Load full section info
    const updatedSections = await prisma.departmentSection.findMany({
      where: {
        id: {
          in: allowedSectionIds,
        },
      },
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
    });

    return NextResponse.json(
      successResponse({
        message: 'Terminal sections updated successfully',
        data: {
          terminalId: updated.id,
          terminalName: updated.name,
          allowedSectionIds,
          sections: updatedSections,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error updating terminal departments:', err);
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
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update terminal departments'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
