/**
 * GET /api/terminals/consolidated - Get the default consolidated terminal
 * POST /api/terminals/consolidated/ensure - Create consolidated terminal if it doesn't exist
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';

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

    const terminal = await prisma.terminal.findFirst({
      where: {
        type: 'consolidated',
      } as any,
    });

    if (!terminal) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Default consolidated terminal not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Dynamically fetch all active sections (not relying on stored allowedSectionIds)
    const activeSections = await prisma.departmentSection.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });

    const allowedSectionIds = activeSections.map(s => s.id);

    return NextResponse.json(
      successResponse({
        data: {
          ...terminal,
          sections: activeSections,
          allowedSectionIds,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching consolidated terminal:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch consolidated terminal'),
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

    // Check permission to manage terminals
    // Allow if user has any POS-related permissions (can view terminals)
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    
    const hasOrdersPermission = await checkPermission(permCtx, 'orders.read', 'orders');
    const hasPOSTerminalAccess = await checkPermission(permCtx, 'pos_terminal.access', 'pos_terminal');
    const hasDashboardAccess = await checkPermission(permCtx, 'dashboard.read', 'dashboard');
    
    if (!hasOrdersPermission && !hasPOSTerminalAccess && !hasDashboardAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to access terminals'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check if consolidated terminal already exists
    let terminal = await prisma.terminal.findFirst({
      where: {
        type: 'consolidated',
      } as any,
    });

    // Get all active sections
    const activeSections = await prisma.departmentSection.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });
    const allSectionIds = activeSections.map(s => s.id);

    // If not found, create it
    if (!terminal) {
      terminal = await (prisma.terminal as any).create({
        data: {
          name: 'Central Sales Terminal',
          slug: 'central-sales-terminal',
          description: 'Default consolidated terminal for multi-section sales',
          type: 'consolidated',
          isDefault: true,
          isActive: true,
          status: 'online',
          allowedSectionIds: JSON.stringify(allSectionIds),
          metadata: {
            createdBy: 'api-ensure',
            purpose: 'default-consolidated-terminal',
          },
        },
      });
    } else {
      // Update allowedSectionIds to match current active sections
      // (in case new sections were added dynamically)
      const currentIds = JSON.parse((terminal as any).allowedSectionIds || '[]');
      const newIds = allSectionIds;
      
      if (JSON.stringify(currentIds.sort()) !== JSON.stringify(newIds.sort())) {
        terminal = await prisma.terminal.update({
          where: { id: terminal.id },
          data: {
            allowedSectionIds: JSON.stringify(newIds),
          } as any,
        });
      }
    }

    return NextResponse.json(
      successResponse({
        data: {
          ...terminal,
          sections: activeSections,
          allowedSectionIds: allSectionIds,
        },
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error('Error ensuring consolidated terminal:', err);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to ensure consolidated terminal'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
