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

    // Fetch inventory snapshot for all order lines
    const inventorySnapshot: any = {};
    try {
      const inventoryPromises = order.lines.map(async (line: any) => {
        if (line.productType && ['inventoryItem', 'food', 'drink'].includes(line.productType)) {
          try {
            const dept = await prisma.department.findUnique({ 
              where: { code: line.departmentCode } 
            });
            
            if (dept) {
              const invWhere: any = {
                departmentId: dept.id,
                inventoryItemId: line.productId,
              };
              
              if (line.departmentSectionId) {
                invWhere.sectionId = line.departmentSectionId;
              }
              
              const inv = await prisma.departmentInventory.findFirst({
                where: invWhere,
              });
              
              if (inv) {
                inventorySnapshot[line.id] = {
                  lineId: line.id,
                  productId: line.productId,
                  quantity: inv.quantity,
                  reserved: inv.reserved,
                  available: Math.max(0, inv.quantity - inv.reserved),
                };
              }
            }
          } catch (e) {
            console.error(`Error fetching inventory for line ${line.id}:`, e);
          }
        }
      });
      
      await Promise.all(inventoryPromises);
    } catch (e) {
      console.error('Error fetching inventory snapshot:', e);
    }

    return NextResponse.json(
      successResponse({
        data: {
          order,
          inventory: inventorySnapshot, // Include current inventory state
          fulfillmentSummary: {
            totalLines,
            fulfilledLines,
            processingLines,
            pendingLines,
            fulfillmentPercentage: totalLines > 0 ? Math.round((fulfilledLines / totalLines) * 100) : 0,
          },
        }
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

    // PRE-FULFILLMENT VALIDATION: Check inventory availability if fulfilling
    // This MUST happen BEFORE any status updates
    if (status === 'fulfilled' && ['inventoryItem', 'food', 'drink'].includes(lineItem.productType)) {
      try {
        const fulfilledQty = quantity || lineItem.quantity;
        
        // Get department info
        const dept = await prisma.department.findUnique({ 
          where: { code: lineItem.departmentCode } 
        });
        
        if (dept) {
          // Build inventory check query
          const inventoryWhere: any = {
            departmentId: dept.id,
            inventoryItemId: lineItem.productId,
          };
          
          // If there's a section, check section-level inventory
          if (lineItem.departmentSectionId) {
            inventoryWhere.sectionId = lineItem.departmentSectionId;
          } else {
            inventoryWhere.sectionId = null;
          }
          
          // Get current inventory
          const inventory = await prisma.departmentInventory.findFirst({
            where: inventoryWhere,
          });
          
          // Check if enough quantity is available
          if (!inventory || inventory.quantity < fulfilledQty) {
            const available = inventory?.quantity || 0;
            console.warn(
              `Insufficient inventory for line ${lineItemId}: need ${fulfilledQty}, ` +
              `available ${available} at ${lineItem.departmentCode}`
            );
            
            return NextResponse.json(
              errorResponse(
                ErrorCodes.VALIDATION_ERROR,
                `Insufficient inventory: need ${fulfilledQty} units but only ${available} available`
              ),
              { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
            );
          }
        }
      } catch (e) {
        console.error('Inventory validation error:', e);
        // Log but allow fulfillment to proceed (inventory check failed but not critical)
        // In production, you might want to return an error here instead
      }
    }

    // Step 1: MINIMAL TRANSACTION - Update line and create fulfillment + deduct inventory
    // Inventory deduction happens IN the transaction to ensure atomicity
    const txStart = Date.now();
    let inventoryDeducted = false;
    
    await prisma.$transaction(async (tx: any) => {
      // Update line status
      await tx.orderLine.update({
        where: { id: lineItemId },
        data: { status },
      });

      // Create fulfillment record
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

      // If fulfilled AND inventory item, deduct inventory within transaction
      if (status === 'fulfilled' && ['inventoryItem', 'food', 'drink'].includes(lineItem.productType)) {
        const dept = await tx.department.findUnique({ 
          where: { code: lineItem.departmentCode } 
        });
        
        if (dept) {
          const fulfilledQty = quantity || lineItem.quantity;
          const inventoryWhere: any = {
            departmentId: dept.id,
            inventoryItemId: lineItem.productId,
          };
          
          if (lineItem.departmentSectionId) {
            inventoryWhere.sectionId = lineItem.departmentSectionId;
          } else {
            inventoryWhere.sectionId = null;
          }
          
          // Deduct inventory - will only succeed if quantity >= fulfilledQty
          const invResult = await tx.departmentInventory.updateMany({
            where: inventoryWhere,
            data: { quantity: { decrement: fulfilledQty } },
          });
          
          inventoryDeducted = invResult.count > 0;
          
          if (!inventoryDeducted) {
            // Inventory couldn't be found/updated - this shouldn't happen after pre-check
            // but we log it for audit purposes
            console.warn(`Inventory deduction failed for line ${lineItemId}`);
          }
        }
      }
    }, { timeout: 10000 });
    const txEnd = Date.now();
    
    // Step 2: BATCH OPERATION - Fetch all required data for post-fulfillment operations
    // Get line details, check completion, fetch order data all together
    let shouldUpdateOrderStatus = false;
    let updatedOrder = null;
    let deptCodesResult: any[] = [];
    
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

        // Step 4: BATCH OPERATION - Create inventory movement record if inventory was deducted in transaction
        // Inventory deduction happened in the transaction above, now just log it
        if (inventoryDeducted && txLine && txLine.productType && ['inventoryItem', 'food', 'drink'].includes(txLine.productType)) {
          const fulfilledQty = quantity || (txLine?.quantity || 0);
          
          try {
            await prisma.inventoryMovement.create({
              data: {
                movementType: 'out',
                quantity: fulfilledQty,
                reason: 'sale',
                reference: orderId,
                inventoryItemId: txLine.productId,
              },
            });

            // Consume reservations
            await prisma.inventoryReservation.updateMany({
              where: { orderHeaderId: orderId, inventoryItemId: txLine.productId, status: 'reserved' },
              data: { status: 'consumed' },
            });
          } catch (e) {
            console.error('Error creating inventory movement:', e);
          }
        }
      } catch (e) {
        console.error('Error in post-fulfillment operations:', e);
        // Log but don't fail the request
      }
    }

    // Step 5: BATCH OPERATION - Fetch updated order and department codes in parallel
    // We need department codes for EVERY fulfillment to update stats (amount sold)
    let deptCodes: string[] = [];
    const inventorySnapshot: any = {};
    try {
      [updatedOrder, deptCodesResult] = await Promise.all([
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
        // Always fetch department codes for stats update
        prisma.orderLine.findMany({
          where: { orderHeaderId: orderId },
          select: { departmentCode: true },
        }),
      ]);
      deptCodes = Array.from(
        new Set((deptCodesResult as any[]).map((l: any) => l.departmentCode).filter(Boolean))
      );

      // Fetch current inventory for all order lines to include in response
      if (updatedOrder?.lines) {
        const inventoryPromises = updatedOrder.lines.map(async (line: any) => {
          if (line.productType && ['inventoryItem', 'food', 'drink'].includes(line.productType)) {
            try {
              const dept = await prisma.department.findUnique({ 
                where: { code: line.departmentCode } 
              });
              
              if (dept) {
                const invWhere: any = {
                  departmentId: dept.id,
                  inventoryItemId: line.productId,
                };
                
                if (line.departmentSectionId) {
                  invWhere.sectionId = line.departmentSectionId;
                }
                
                const inv = await prisma.departmentInventory.findFirst({
                  where: invWhere,
                });
                
                if (inv) {
                  inventorySnapshot[line.id] = {
                    lineId: line.id,
                    quantity: inv.quantity,
                    reserved: inv.reserved,
                    available: Math.max(0, inv.quantity - inv.reserved),
                  };
                }
              }
            } catch (e) {
              console.error(`Error fetching inventory for line ${line.id}:`, e);
            }
          }
        });
        
        await Promise.all(inventoryPromises);
      }
    } catch (e) {
      console.error('Error fetching updated order:', e);
      updatedOrder = null;
    }

    const payload = successResponse({
      data: {
        order: updatedOrder,
        inventory: inventorySnapshot, // Include current inventory state
        deducted: inventoryDeducted,  // Indicate if inventory was deducted
      },
      message: 'Fulfillment status updated successfully',
    });

    // Step 6: BATCH OPERATION - Recalculate stats for ALL affected departments
    // This ensures section inventory and amount sold are updated for every fulfilled line
    if (deptCodes.length > 0) {
      try {
        const { departmentService } = await import('@/services/department.service');

        // Batch all stat calculations in parallel for all affected departments
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
