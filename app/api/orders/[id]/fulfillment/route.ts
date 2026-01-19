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

    // Update line item and create fulfillment record
    // Increase interactive transaction timeout to reduce P2028 occurrences
    const txStart = Date.now();
    await prisma.$transaction(async (tx: any) => {
      const t0 = Date.now();
      // Update line item status
      await tx.orderLine.update({
        where: { id: lineItemId },
        data: {
          status,
        },
      });
      const t1 = Date.now();

      // Create fulfillment record using the transactional client to keep atomicity
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
      const t2 = Date.now();

      // If status is fulfilled, perform inventory consumption for this line,
      // then check if all lines are fulfilled.
      if (status === 'fulfilled') {
        try {
          // Re-fetch the line within the transaction to get authoritative data
          const txLine = await tx.orderLine.findUnique({ where: { id: lineItemId } });
          const fulfilledQty = quantity || (txLine?.quantity || 0);

          // If this line is an inventory-backed item, decrement dept inventory and record movement
          if (txLine && txLine.productType && ['inventoryItem', 'food', 'drink'].includes(txLine.productType)) {
            try {
              const dept = await tx.department.findUnique({ where: { code: txLine.departmentCode } });
              if (dept) {
                // Build the where clause to include sectionId if available
                // This ensures we decrement the correct section's inventory
                const whereClause: any = { 
                  departmentId: dept.id, 
                  inventoryItemId: txLine.productId, 
                  quantity: { gte: fulfilledQty } 
                };
                
                // If this line has a departmentSectionId, scope to that section
                if (txLine.departmentSectionId) {
                  whereClause.sectionId = txLine.departmentSectionId;
                } else {
                  // Legacy: if no sectionId, scope to parent (sectionId = null)
                  whereClause.sectionId = null;
                }
                
                const res = await tx.departmentInventory.updateMany({
                  where: whereClause,
                  data: { quantity: { decrement: fulfilledQty } },
                });

                if (res.count && res.count > 0) {
                  await tx.inventoryMovement.create({
                    data: {
                      movementType: 'out',
                      quantity: fulfilledQty,
                      reason: 'sale',
                      reference: orderId,
                      inventoryItemId: txLine.productId,
                    },
                  });
                } else {
                  // If updateMany didn't find sufficient stock, log a warning but continue
                  console.warn(`Insufficient inventory to decrement for line ${lineItemId} (product ${txLine.productId})`);
                }

                // Consume any existing reservation(s) for this order + inventoryItem
                await tx.inventoryReservation.updateMany({
                  where: { orderHeaderId: orderId, inventoryItemId: txLine.productId, status: 'reserved' },
                  data: { status: 'consumed', consumedAt: new Date() },
                });

                // Recalculate section stats for this department within the transaction
                try {
                  const { departmentService } = await import('@/services/department.service');
                  await departmentService.recalculateSectionStats(dept.code as string, tx);
                } catch (e) {
                  console.error('Error recalculating section stats during fulfillment tx:', e);
                }
              }
            } catch (invErr) {
              console.error('Inventory decrement during fulfillment failed:', invErr);
            }
          }
        } catch (e) {
          console.error('Error handling inventory consumption during fulfillment:', e);
        }

        const remaining = await tx.orderLine.count({
          where: { orderHeaderId: orderId, status: { not: 'fulfilled' } },
        });

        if (remaining === 0) {
          // Update order status to fulfilled
          // Update header and sync department statuses atomically
          await tx.orderHeader.update({ where: { id: orderId }, data: { status: 'fulfilled' } });
          await tx.orderDepartment.updateMany({ where: { orderHeaderId: orderId }, data: { status: 'fulfilled' } });
        }
      }
      const t3 = Date.now();
      try { console.log(`Fulfillment transaction timings (ms): update=${t1-t0} create=${t2-t1} post=${t3-t2} total=${t3-t0}`); } catch(e){}
    }, { timeout: 15000 });
    const txEnd = Date.now();
    try { console.log('Fulfillment overall transaction duration (ms):', txEnd - txStart); } catch(e){}

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

    const payload = successResponse({data : updatedOrder, message : 'Fulfillment status updated successfully'});
    try {
      console.log('PUT /api/orders/[id]/fulfillment payload:', JSON.stringify(payload));
    } catch (logErr) {
      console.log('PUT /api/orders/[id]/fulfillment payload (non-serializable):', payload);
    }

    // After fulfillment update, roll up parent stats for all departments involved
    try {
      const { departmentService } = await import('@/services/department.service');
      const lines = await prisma.orderLine.findMany({ where: { orderHeaderId: orderId } });
      const deptCodes = Array.from(new Set(lines.map((l: any) => l.departmentCode)));
      for (const code of deptCodes) {
        if (!code) continue;
        await departmentService.rollupParentStats(code);
      }
    } catch (rollupErr) {
      console.error('Error rolling up parent stats after fulfillment:', rollupErr);
      // Don't fail the request; just log
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('PUT /api/orders/[id]/fulfillment error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update fulfillment'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
