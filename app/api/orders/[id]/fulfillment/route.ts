/**
 * Order Fulfillment API Routes
 * 
 * GET /api/orders/[id]/fulfillment - Get fulfillment status
 * PUT /api/orders/[id]/fulfillment - Update fulfillment/line items
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/orders/[id]/fulfillment
 * Get fulfillment status and details
 */
export async function GET(
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can view fulfillment'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch order with fulfillment details
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            fulfillments: true,
          },
        },
        departments: {
          include: {
            department: true,
          },
        },
        fulfillments: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Calculate fulfillment summary
    const totalLines = order.lines.length;
    const fulfilledLines = order.lines.filter((l: any) => l.status === 'fulfilled').length;
    const processingLines = order.lines.filter((l: any) => l.status === 'processing').length;
    const pendingLines = order.lines.filter((l: any) => l.status === 'pending').length;

    return NextResponse.json(
      successResponse({
        order,
        fulfillmentSummary: {
          totalLines,
          fulfilledLines,
          processingLines,
          pendingLines,
          fulfillmentPercentage: totalLines > 0 ? Math.round((fulfilledLines / totalLines) * 100) : 0,
        },
      })
    );
  } catch (error) {
    console.error('GET /api/orders/[id]/fulfillment error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch fulfillment status'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * PUT /api/orders/[id]/fulfillment
 * Update line item fulfillment status
 * 
 * Request body:
 * {
 *   lineItemId: string          // Order line ID
 *   status: "processing" | "fulfilled"
 *   notes?: string              // Fulfillment notes
 *   quantity?: number           // Partial fulfillment quantity
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can update fulfillment'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { lineItemId, status, notes, quantity } = body;

    // Validate input
    if (!lineItemId || !status) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'lineItemId and status are required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const validStatuses = ['processing', 'fulfilled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        lines: true,
        departments: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Fetch line item
    const lineItem = order.lines.find((l: any) => l.id === lineItemId);
    if (!lineItem) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Line item not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Update line item and create fulfillment record
    await prisma.$transaction(async (tx: any) => {
      // Update line item status
      await tx.orderLine.update({
        where: { id: lineItemId },
        data: {
          status,
        },
      });

      // Create fulfillment record
      await tx.orderFulfillment.create({
        data: {
          orderHeaderId: orderId,
          orderLineId: lineItemId,
          quantity: quantity || lineItem.quantity,
          status,
          notes,
          fulfilledAt: status === 'fulfilled' ? new Date() : null,
        },
      });

      // If status is fulfilled, check if all lines are fulfilled
      if (status === 'fulfilled') {
        const allLines = await tx.orderLine.findMany({
          where: { orderHeaderId: orderId },
        });

        const allFulfilled = allLines.every((l: any) => l.status === 'fulfilled');
        if (allFulfilled) {
          // Update order status to fulfilled
          await tx.orderHeader.update({
            where: { id: orderId },
            data: { status: 'fulfilled' },
          });
        }
      }
    });

    // Fetch updated order
    const updatedOrder = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            fulfillments: true,
          },
        },
        departments: true,
        fulfillments: true,
      },
    });

    return NextResponse.json(
      successResponse(updatedOrder, 'Fulfillment status updated successfully')
    );
  } catch (error) {
    console.error('PUT /api/orders/[id]/fulfillment error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update fulfillment'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
