/**
 * GET/PATCH/DELETE /api/extras/[id]
 * - GET: Get single extra
 * - PATCH: Update extra
 * - DELETE: Delete extra (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { extrasService } from '@/src/services/extras.service';

/**
 * GET /api/extras/[id]
 * Get a specific extra
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const extra = await extrasService.getExtra(id);
    if ('error' in extra) {
      return NextResponse.json(extra, { status: getStatusCode(ErrorCodes.NOT_FOUND) });
    }

    return NextResponse.json(
      successResponse({ extra }),
      { status: 200 }
    );
  } catch (error) {
    console.error(`GET /api/extras/[id] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch extra'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * PATCH /api/extras/[id]
 * Update an extra (admin/manager only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admin/manager can update extras'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();

    const extra = await extrasService.updateExtra(id, body);
    if ('error' in extra) {
      return NextResponse.json(extra, { status: getStatusCode(ErrorCodes.NOT_FOUND) });
    }

    return NextResponse.json(
      successResponse({ extra }),
      { status: 200 }
    );
  } catch (error) {
    console.error(`PATCH /api/extras/[id] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update extra'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/extras/[id]
 * Delete an extra (soft delete via isActive) (admin/manager only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admin/manager can delete extras'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const extra = await extrasService.deleteExtra(id);
    if ('error' in extra) {
      return NextResponse.json(extra, { status: getStatusCode(ErrorCodes.NOT_FOUND) });
    }

    return NextResponse.json(
      successResponse({ extra }),
      { status: 200 }
    );
  } catch (error) {
    console.error(`DELETE /api/extras/[id] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete extra'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
