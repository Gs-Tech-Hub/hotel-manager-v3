/**
 * GET /api/orders/[id]/extras
 * Get all extras for an order
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { extrasService } from '@/services/extras.service';

/**
 * GET /api/orders/[id]/extras
 * Get all extras for a specific order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderHeaderId } = await params;

    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'User not found'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to view extras
    const permCtx: PermissionContext = {
      userId: ctx.userId!,
      userType: (userWithRoles.userType as 'admin' | 'employee' | 'other') || 'employee',
      departmentId: null,
    };
    const canRead = await checkPermission(permCtx, 'extras.read', 'extras');
    if (!canRead) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view extras'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const extras = await extrasService.getOrderExtras(orderHeaderId);

    return NextResponse.json(
      successResponse({ data: { extras } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/orders/[id]/extras error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch order extras'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
