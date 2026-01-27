/**
 * Order Fulfillment API Routes
 * 
 * GET /api/orders/[id]/fulfillment - Get fulfillment status
 * PUT /api/orders/[id]/fulfillment - Update fulfillment/line items
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
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
        data: {
        order,
        fulfillmentSummary: {
          totalLines,
          fulfilledLines,
          processingLines,
          pendingLines,
          fulfillmentPercentage: totalLines > 0 ? Math.round((fulfilledLines / totalLines) * 100) : 0,
        },
      }})
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

    // Diagnostic log: who is performing the fulfillment update and payload
    try {
      console.log('PUT /api/orders/[id]/fulfillment called by:', ctx.userId, 'body:', JSON.stringify(body));
    } catch (e) {
      console.log('PUT /api/orders/[id]/fulfillment called by:', ctx.userId, 'body (non-serializable)');
    }

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

    // Prevent fulfillment updates on cancelled or refunded orders
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 
          `Cannot update fulfillment for a ${order.status} order`),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
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

    // Step 1: MINIMAL TRANSACTION - Only update line and create fulfillment
    // This is the fastest critical path
    const txStart = Date.now();
    await prisma.$transaction(async (tx: any) => {
      await tx.orderLine.update({
        where: { id: lineItemId },
        data: { status },
      });

      await (tx as any).orderFulfillment.create({
        data: {
          orderHeaderId: orderId,
          orderLineId: lineItemId,
          fulfilledQuantity: quantity || lineItem.quantity,
          status,
          notes,
          fulfilledAt: status === 'fulfilled' ? new Date() : null,
        },
      });
    }, { timeout: 10000 });
    const txEnd = Date.now();
    
    // Step 2: BATCH OPERATION - Fetch all required data for post-fulfillment operations
    // Get line details, check completion, fetch order data all together
    let shouldUpdateOrderStatus = false;
    let updatedOrder = null;
    
    if (status === 'fulfilled') {
      try {
        // Batch fetch: line details + remaining count in parallel
        const [txLine, remainingCount] = await Promise.all([
          prisma.orderLine.findUnique({ where: { id: lineItemId } }),
          prisma.orderLine.count({
            where: { orderHeaderId: orderId, status: { not: 'fulfilled' } },
          }),
        ]);

        shouldUpdateOrderStatus = remainingCount === 0;

        // Step 3: BATCH OPERATION - Update order statuses if complete
        if (shouldUpdateOrderStatus) {
          await Promise.all([
            prisma.orderHeader.update({
              where: { id: orderId },
              data: { status: 'fulfilled' },
            }),
            prisma.orderDepartment.updateMany({
              where: { orderHeaderId: orderId },
              data: { status: 'fulfilled' },
            }),
          ]);
        }

        // Step 4: BATCH OPERATION - Handle inventory operations in parallel
        if (txLine && txLine.productType && ['inventoryItem', 'food', 'drink'].includes(txLine.productType)) {
          const dept = await prisma.department.findUnique({ where: { code: txLine.departmentCode } });
          
          if (dept) {
            const fulfilledQty = quantity || (txLine?.quantity || 0);
            const whereClause: any = {
              departmentId: dept.id,
              inventoryItemId: txLine.productId,
              quantity: { gte: fulfilledQty },
            };

            if (txLine.departmentSectionId) {
              whereClause.sectionId = txLine.departmentSectionId;
            } else {
              whereClause.sectionId = null;
            }

            // Batch: decrement inventory and create movement record
            const invResult = await prisma.departmentInventory.updateMany({
              where: whereClause,
              data: { quantity: { decrement: fulfilledQty } },
            });

            // Only create movement if inventory was decremented
            if (invResult.count && invResult.count > 0) {
              await prisma.inventoryMovement.create({
                data: {
                  movementType: 'out',
                  quantity: fulfilledQty,
                  reason: 'sale',
                  reference: orderId,
                  inventoryItemId: txLine.productId,
                },
              });
            } else {
              console.warn(`Insufficient inventory to decrement for line ${lineItemId}`);
            }

            // Consume reservations
            await prisma.inventoryReservation.updateMany({
              where: { orderHeaderId: orderId, inventoryItemId: txLine.productId, status: 'reserved' },
              data: { status: 'consumed' },
            });
          }
        }
      } catch (e) {
        console.error('Error in post-fulfillment operations:', e);
        // Log but don't fail the request
      }
    }

    // Step 5: BATCH OPERATION - Fetch updated order and line departments in parallel
    try {
      [updatedOrder] = await Promise.all([
        (prisma as any).orderHeader.findUnique({
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
        }),
        // Optionally fetch department codes for stats update later
        shouldUpdateOrderStatus
          ? prisma.orderLine.findMany({
              where: { orderHeaderId: orderId },
              select: { departmentCode: true },
            })
          : Promise.resolve([]),
      ]);
    } catch (e) {
      console.error('Error fetching updated order:', e);
      updatedOrder = null;
    }

    const payload = successResponse({
      data: updatedOrder,
      message: 'Fulfillment status updated successfully',
    });

    // Step 6: BATCH OPERATION - Recalculate stats for affected departments in parallel
    if (shouldUpdateOrderStatus) {
      try {
        const { departmentService } = await import('@/services/department.service');
        const lines = await prisma.orderLine.findMany({
          where: { orderHeaderId: orderId },
          select: { departmentCode: true },
        });
        const deptCodes = Array.from(new Set(lines.map((l: any) => l.departmentCode).filter(Boolean)));

        // Batch all stat calculations in parallel
        await Promise.all(
          deptCodes.map(async (code) => {
            try {
              await Promise.all([
                departmentService.recalculateSectionStats(code),
                departmentService.rollupParentStats(code),
              ]);
            } catch (e) {
              console.error(`Error updating stats for department ${code}:`, e);
            }
          })
        );
      } catch (e) {
        console.error('Error in stats recalculation:', e);
        // Don't fail the request
      }
    }

    try {
      console.log(`Fulfillment completed: tx=${txEnd - txStart}ms`);
    } catch (e) {}

    return NextResponse.json(payload);
  } catch (error) {
    console.error('PUT /api/orders/[id]/fulfillment error:', error);
    
    // Log full error details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update fulfillment'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
