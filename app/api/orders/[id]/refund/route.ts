/**
 * Order Refund API Route
 * 
 * POST /api/orders/[id]/refund - Refund a fulfilled order with payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';

/**
 * POST /api/orders/[id]/refund
 * Refund a fulfilled order with payment
 * Only fulfilled/completed orders with paid/partial payment can be refunded
 * 
 * Request body:
 * {
 *   reason?: string  // Optional refund reason
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Get user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load full user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only managers/admins can refund orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Refund order using service
    const orderService = new OrderService();
    const result = await orderService.refundOrder(orderId, reason || 'Refunded via API', userWithRoles);

    // Check if result is error response
    if ('error' in result && result.error && typeof result.error === 'object' && 'code' in result.error) {
      return NextResponse.json(
        result,
        { status: getStatusCode((result.error as { code: string }).code) }
      );
    }

    const payload = successResponse({data : result, message : 'Order refunded successfully'});
    try {
      console.log('POST /api/orders/[id]/refund payload:', JSON.stringify(payload));
    } catch (logErr) {
      console.log('POST /api/orders/[id]/refund payload (non-serializable):', payload);
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('POST /api/orders/[id]/refund error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to refund order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
