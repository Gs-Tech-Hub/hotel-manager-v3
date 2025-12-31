/**
 * GET/POST /api/extras
 * - GET: List all extras
 * - POST: Create new extra (admin/manager only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { extrasService } from '@/src/services/extras.service';

/**
 * GET /api/extras
 * List all extras optionally filtered by section
 * 
 * Query parameters:
 * - sectionId: filter by department section
 * - includeInactive: include inactive extras (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectionId = searchParams.get('sectionId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let extras;
    if (sectionId) {
      extras = await extrasService.getExtrasForSection(sectionId, includeInactive);
    } else {
      extras = await extrasService.getAllExtras(includeInactive);
    }

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
 * Create a new extra (admin/manager only)
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

    const extra = await extrasService.createExtra({
      name: body.name,
      description: body.description,
      unit: body.unit,
      price: body.price || 0,
      departmentSectionId: body.departmentSectionId,
      isActive: body.isActive ?? true,
    });

    if ('error' in extra) {
      return NextResponse.json(extra, { status: getStatusCode(ErrorCodes.INVALID_INPUT) });
    }

    return NextResponse.json(
      successResponse({ extra }),
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
