/**
 * Order Detail API Routes
 * 
 * GET    /api/orders/[id] - Get order details
 * PUT    /api/orders/[id] - Update order (notes, status)
 * DELETE /api/orders/[id] - Cancel order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    // Get user context
    const ctx = extractUserContext(request);
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
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
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

    return NextResponse.json(successResponse(order));
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
    const ctx = extractUserContext(request);
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
    if (status !== undefined) updateData.status = status;

    const updatedOrder = await (prisma as any).orderHeader.update({
      where: { id: orderId },
      data: updateData,
      include: {
        customer: true,
        lines: true,
        departments: true,
        discounts: true,
        payments: true,
        fulfillments: true,
      },
    });

    return NextResponse.json(
      successResponse(updatedOrder, 'Order updated successfully')
    );
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
    const ctx = extractUserContext(request);
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
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json(
      successResponse(result, 'Order cancelled successfully')
    );
  } catch (error) {
    console.error('DELETE /api/orders/[id] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to cancel order'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
