/**
 * Admin API: Price Consistency Check
 * GET /api/admin/price-check
 * 
 * Validates price consistency across the system
 * Returns audit report of all price-related data
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { runPriceConsistencyMigration } from '@/scripts/price-consistency-migration';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'User not found'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Require admin role
    if (!hasAnyRole(userWithRoles, ['admin']) && !userWithRoles.isAdmin) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Admin role required'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: 'admin',
    };

    const hasReadPerm = await checkPermission(permCtx, 'admin.read', 'system');
    if (!hasReadPerm) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Run price consistency check
    const report = await runPriceConsistencyMigration();

    return NextResponse.json(
      successResponse(report, 'Price consistency check completed'),
      { status: 200 }
    );
  } catch (error) {
    console.error('Price check error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Price consistency check failed'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
