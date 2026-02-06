/**
 * Order Detail API Routes
 * 
 * GET    /api/orders/[id] - Get order details
 * PUT    /api/orders/[id] - Update order (notes, status)
 * DELETE /api/orders/[id] - Cancel order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';

/**
 * GET /api/orders/[id]
 * Get complete order details with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    console.log(`[GET /api/orders] Fetching order: ${orderId}`);

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

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: {
          include: {
            fulfillments: true,
          },
        },
        departments: true,
        discounts: {
          include: {
            discountRule: true,
          },
        },
        payments: {
          include: {
            paymentType: true,
          },
        },
        fulfillments: true,
        reservations: true,
        extras: {
          include: {
            extra: true,
          },
        },
      },
    });

    if (!order) {
      console.log(`[GET /api/orders] Order not found: ${orderId}`);
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, `Order with ID "${orderId}" not found in database`),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check permissions: customer can only view own order, staff can view all
    if (userWithRoles && !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      if (order.customerId !== ctx.userId) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Cannot access this order'),
          { status: getStatusCode(ErrorCodes.FORBIDDEN) }
        );
      }
    }

    const payload = successResponse({ data: order });
    try {
      console.log('GET /api/orders/[id] payload:', JSON.stringify(payload));
    } catch (logErr) {
      console.log('GET /api/orders/[id] payload (non-serializable):', payload);
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * PUT /api/orders/[id]
 * Update order details (notes, status)
 * 
 * Request body:
 * {
 *   notes?: string
 *   status?: "pending" | "processing" | "fulfilled" | "completed" | "cancelled"
 * }
 */
export async function PUT(
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
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can update orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { notes, status } = body;

    // Validate status if provided
    const validStatuses = ['pending', 'processing', 'fulfilled', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Update order
    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;

    let updatedOrder: any = null;
    if (status !== undefined) {
      // Use service to update status and ensure department rows are synced
      const orderService = new OrderService();
      const res = await orderService.updateOrderStatus(orderId, status as string, userWithRoles as any);
      if ('error' in res) {
        return NextResponse.json(res, { status: getStatusCode(res.error.code) });
      }

      // Apply additional fields (notes) if provided
      if (notes !== undefined) {
        updatedOrder = await (prisma as any).orderHeader.update({ where: { id: orderId }, data: { notes }, include: { customer: true, lines: true, departments: true, discounts: true, payments: true, fulfillments: true } });
      } else {
        updatedOrder = await (prisma as any).orderHeader.findUnique({ where: { id: orderId }, include: { customer: true, lines: true, departments: true, discounts: true, payments: true, fulfillments: true } });
      }
    } else {
      // No status change; only update other fields
      if (notes !== undefined) updateData.notes = notes;
      updatedOrder = await (prisma as any).orderHeader.update({ where: { id: orderId }, data: updateData, include: { customer: true, lines: true, departments: true, discounts: true, payments: true, fulfillments: true } });
    }

    const payload = successResponse({data : updatedOrder, message : 'Order updated successfully'});
    try {
      console.log('PUT /api/orders/[id] payload:', JSON.stringify(payload));
    } catch (logErr) {
      console.log('PUT /api/orders/[id] payload (non-serializable):', payload);
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Cancel order - releases inventory reservations
 */
export async function DELETE(
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only managers/admins can cancel orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Cancel order using service
    const orderService = new OrderService();
    const result = await orderService.cancelOrder(orderId, 'Cancelled via API', userWithRoles);

    // Check if result is error response
    if ('error' in result) {
      return NextResponse.json(
        result,
        { status: getStatusCode((result as any).error.code) }
      );
    }

    const payload = successResponse({data : result, message : 'Order cancelled successfully'});
    try {
      console.log('DELETE /api/orders/[id] payload:', JSON.stringify(payload));
    } catch (logErr) {
      console.log('DELETE /api/orders/[id] payload (non-serializable):', payload);
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
