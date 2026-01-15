/**
 * POST /api/extras/order-lines
 * Add extras to an order line
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { extrasService } from '@/src/services/extras.service';

/**
 * POST /api/extras/order-lines
 * Add extras to an order line
 * 
 * Body:
 * {
 *   orderHeaderId: string,
 *   orderLineId: string,
 *   extras: [
 *     { extraId: string, quantity: number },
 *     ...
 *   ]
 * }
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
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can add extras to orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.orderHeaderId || !body.orderLineId || !Array.isArray(body.extras)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, 'orderHeaderId, orderLineId, and extras array are required'),
        { status: getStatusCode(ErrorCodes.INVALID_INPUT) }
      );
    }

    if (body.extras.length === 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, 'At least one extra is required'),
        { status: getStatusCode(ErrorCodes.INVALID_INPUT) }
      );
    }

    // Validate each extra
    for (const extra of body.extras) {
      if (!extra.extraId || !extra.quantity || extra.quantity <= 0) {
        return NextResponse.json(
          errorResponse(ErrorCodes.INVALID_INPUT, 'Each extra must have extraId and positive quantity'),
          { status: getStatusCode(ErrorCodes.INVALID_INPUT) }
        );
      }
    }

    const orderExtras = await extrasService.addExtrasToOrderLine({
      orderHeaderId: body.orderHeaderId,
      orderLineId: body.orderLineId,
      extras: body.extras,
    });

    if ('error' in orderExtras) {
      return NextResponse.json(orderExtras, { status: getStatusCode(ErrorCodes.INVALID_INPUT) });
    }

    return NextResponse.json(
      successResponse({ orderExtras }),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/extras/order-lines error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to add extras to order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

