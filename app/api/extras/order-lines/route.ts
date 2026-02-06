/**
 * POST /api/extras/order-lines
 * Add extras to an order line
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { extrasService } from '@/services/extras.service';
import { prisma } from '@/lib/auth/prisma';

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

    const result = await extrasService.addExtrasToOrderLine({
      orderHeaderId: body.orderHeaderId,
      orderLineId: body.orderLineId,
      extras: body.extras,
    });

    if ('error' in result) {
      return NextResponse.json(result, { status: getStatusCode(ErrorCodes.INVALID_INPUT) });
    }

    // Extract the updated order and orderExtras from result
    // Result is { orderExtras: [], order: OrderHeader }
    const resultObj = result as any;
    const { order, orderExtras } = resultObj;

    // AFTER adding extras, reset payment status from 'paid' to 'partial' (if was paid)
    try {
      if (order && order.paymentStatus === 'paid') {
        // Extras increased the total, so reset status to 'partial'
        await (prisma as any).orderHeader.update({
          where: { id: body.orderHeaderId },
          data: { paymentStatus: 'partial' },
        });

        // Fetch updated order with new payment status
        const refreshedOrder = await (prisma as any).orderHeader.findUnique({
          where: { id: body.orderHeaderId },
          include: {
            customer: true,
            lines: { include: { departmentSection: true } },
            departments: { include: { department: true } },
            discounts: { include: { discountRule: true } },
            payments: { include: { paymentType: true } },
            fulfillments: true,
            reservations: true,
            extras: {
              include: {
                extra: true,
              },
            },
          },
        });

        console.log(`[Extras] Order ${body.orderHeaderId} payment status reset to 'partial' (was 'paid')`);

        // Return the refreshed order with updated payment status
        return NextResponse.json(
          successResponse({ data: { order: refreshedOrder, orderExtras } }),
          { status: 201 }
        );
      }

      // Return the order from transaction (already has updated total and extras)
      return NextResponse.json(
        successResponse({ data: { order, orderExtras } }),
        { status: 201 }
      );
    } catch (updateErr) {
      console.error('[Extras] Failed to update order payment status:', updateErr);
      // Return the order from transaction (still has correct total and extras)
      return NextResponse.json(
        successResponse({ data: { order, orderExtras } }),
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('POST /api/extras/order-lines error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to add extras to order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

