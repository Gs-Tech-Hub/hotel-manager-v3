/**
 * GET /api/terminals - List all terminals
 * POST /api/terminals - Create a new terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { z } from 'zod';

const CreateTerminalSchema = z.object({
  name: z.string().min(1, 'Terminal name is required'),
  slug: z.string().min(1, 'Terminal slug is required').toLowerCase(),
  description: z.string().optional(),
  type: z.enum(['consolidated', 'section']).default('section'),
  allowedSectionIds: z.array(z.string()).optional().default([]),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
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
    // Allow access if user has any POS-related permissions (orders.read, pos_terminal.access, etc.)
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    
    // Check for POS-related permissions - any of these grants terminal visibility
    const hasOrdersPermission = await checkPermission(permCtx, 'orders.read', 'orders');
    const hasPOSTerminalAccess = await checkPermission(permCtx, 'pos_terminal.access', 'pos_terminal');
    const hasDashboardAccess = await checkPermission(permCtx, 'dashboard.read', 'dashboard');
    
    if (!hasOrdersPermission && !hasPOSTerminalAccess && !hasDashboardAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view terminals'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const isActive = searchParams.get('isActive');
    const departmentId = searchParams.get('departmentId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const whereFilters: any = {};
    if (type) {
      whereFilters.type = type;
    }
    if (isActive !== null) {
      whereFilters.isActive = isActive === 'true';
    }

    // Fetch terminals without sections first (to separate consolidated vs section-type)
    const terminals = await prisma.terminal.findMany({
      where: whereFilters,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.terminal.count({ where: whereFilters });

    // Enrich each terminal with its sections based on type
    const enrichedTerminals = await Promise.all(terminals.map(async (terminal: any) => {
      let sectionsData: any[] = [];

      if (terminal.type === 'consolidated') {
        // For consolidated terminals, dynamically fetch all ACTIVE sections
        // This ensures new sections are automatically included without updating allowedSectionIds
        sectionsData = await prisma.departmentSection.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            departmentId: true,
          },
          orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
        });
      } else {
        // For section-specific terminals, fetch sections linked via terminalId
        sectionsData = await prisma.departmentSection.findMany({
          where: { terminalId: terminal.id },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            departmentId: true,
          },
        });
      }

      return {
        ...terminal,
        sections: sectionsData,
      };
    }));

    const response = {
      terminals: enrichedTerminals,
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
    console.error('Error fetching terminals:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch terminals'),
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

    // Check permission to create terminals
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'terminals.create', 'terminals');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to create terminals'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const validatedData = CreateTerminalSchema.parse(body);

    // If this is a default consolidated terminal, unset any other defaults
    if (validatedData.isDefault && validatedData.type === 'consolidated') {
      await prisma.terminal.updateMany({
        where: {
          type: 'consolidated',
        },
        data: {
          isDefault: false,
        } as any,
      });
    }

    // Check if slug already exists
    const existingSlug = await prisma.terminal.findFirst({
      where: { slug: validatedData.slug },
    });

    if (existingSlug) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Terminal slug already exists'),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    const terminal = await prisma.terminal.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        type: validatedData.type,
        allowedSectionIds: JSON.stringify(validatedData.allowedSectionIds || []),
        isDefault: validatedData.isDefault,
        isActive: validatedData.isActive,
      } as any,
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

    return NextResponse.json(
      successResponse({
        message: 'Terminal created successfully',
        data: terminal,
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error('Error creating terminal:', err);
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
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create terminal'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
