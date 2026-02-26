/**
 * GET /api/maintenance/requests - List maintenance requests
 * POST /api/maintenance/requests - Create maintenance request
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { maintenanceService } from '@/src/services/MaintenanceService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';

export async function GET(request: NextRequest) {
  try {
    // Extract and verify user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Load user with roles and check permissions
    const user = await loadUserWithRoles(ctx.userId);
    if (!user) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      );
    }

    // Check permission to view maintenance requests
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: user.isAdmin ? 'admin' : hasAnyRole(user, ['admin', 'manager', 'staff']) ? 'employee' : 'other',
    };
    const hasAccess = await checkPermission(permCtx, 'maintenance.view', 'maintenance');
    if (!hasAccess) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view maintenance requests'),
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');

    // Get open requests
    const requests = await maintenanceService.getOpenRequests(priority as any);

    // Filter by status if provided
    const filtered = status
      ? requests.filter((r) => r.status === status)
      : requests;

    return NextResponse.json(
      successResponse({ data: filtered }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { unitId, category, description, priority, requestedBy } = body;

    // Validate required fields
    if (!unitId || !category || !description) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'unitId, category, and description are required'),
        { status: 400 }
      );
    }

    // Create request
    const maintenanceRequest = await maintenanceService.createRequest(
      {
        unitId,
        category,
        description,
        priority,
        requestedBy: requestedBy || ctx.userId,
      },
      { userId: ctx.userId, userType: (ctx.userRole as any) || 'employee' }
    );

    return NextResponse.json(
      successResponse({
        data: maintenanceRequest,
        message: 'Maintenance request created successfully',
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg.includes('Insufficient permissions')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, errorMsg),
        { status: 403 }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}
