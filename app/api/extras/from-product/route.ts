import { NextRequest, NextResponse } from 'next/server';
import { extrasService } from '@/src/services/extras.service';
import { errorResponse, successResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/src/lib/user-context';
import { loadUserWithRoles, hasAnyRole } from '@/src/lib/user-context';

/**
 * POST /api/extras/from-product
 * Create an extra from an existing inventory item
 * Supports inventory tracking
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and validate user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Load user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not found'),
        { status: 401 }
      );
    }

    // Check permissions - admin/manager only
    if (!hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.productId || !body.unit) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, 'productId and unit are required'),
        { status: 400 }
      );
    }

    const result = await extrasService.createExtraFromProduct({
      productId: body.productId,
      unit: body.unit,
      priceOverride: body.priceOverride,
      departmentSectionId: body.departmentSectionId,
      trackInventory: body.trackInventory
    });

    // Check if result is an error response (has success: false)
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      // It's an error response
      console.error('Error creating extra from product:', result);
      const statusCode = (result as any).error?.code === ErrorCodes.NOT_FOUND ? 404 : 
                        (result as any).error?.code === ErrorCodes.UNAUTHORIZED ? 401 :
                        (result as any).error?.code === ErrorCodes.FORBIDDEN ? 403 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(
      successResponse({ data: result }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating extra from product:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create extra from product'),
      { status: 500 }
    );
  }
}
