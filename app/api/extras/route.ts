/**
 * GET/POST /api/extras
 * - GET: List all extras
 * - POST: Create new extra (admin/manager only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { extrasService } from '@/src/services/extras.service';

/**
 * GET /api/extras
 * List all extras (global registry, not department/section filtered)
 * For department/section-specific extras, use /api/departments/[code]/extras
 * 
 * Query parameters:
 * - includeInactive: include inactive extras (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const extras = await extrasService.getAllExtras(includeInactive);

    return NextResponse.json(
      successResponse({ extras }),
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/extras error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch extras'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/extras
 * Create a new extra at the global level (admin/manager only)
 * After creation, use /api/departments/[code]/extras to allocate to departments
 * 
 * Body:
 * - name: string (required)
 * - description?: string
 * - unit: string (required) - e.g., "piece", "glass", "order"
 * - price?: number - price in cents
 * - productId?: string - optional inventory item reference
 * - trackInventory?: boolean - whether to track inventory for this extra
 * - isActive?: boolean (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admin/manager can create extras'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.unit) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, 'name and unit are required'),
        { status: getStatusCode(ErrorCodes.INVALID_INPUT) }
      );
    }

    // Create extra at global level (no department/section assignment)
    const extra = await extrasService.createExtra({
      name: body.name,
      description: body.description,
      unit: body.unit,
      price: body.price || 0,
      productId: body.productId,
      trackInventory: body.trackInventory ?? false,
      isActive: body.isActive ?? true,
    });

    return NextResponse.json(
      successResponse({ extra, message: 'Extra created. Use /api/departments/[code]/extras to allocate to departments.' }),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/extras error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create extra'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

