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

    // Load full user with roles (may be null if user doesn't exist in AdminUser table)
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    
    // Allow if user has roles loaded, or if they have a valid context with a staff-like role
    const hasStaffAccess = userWithRoles && hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']);
    const hasContextRole = ctx.userRole && ['admin', 'manager', 'staff'].includes(ctx.userRole);
    
    if (!hasStaffAccess && !hasContextRole) {
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

    // Load full user with roles (may be null if user doesn't exist in AdminUser table)
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    
    // Allow if user has roles loaded, or if they have a valid context with a staff-like role
    const hasStaffAccess = userWithRoles && hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']);
    const hasContextRole = ctx.userRole && ['admin', 'manager', 'staff'].includes(ctx.userRole);
    
    if (!hasStaffAccess && !hasContextRole) {
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

    // PRE-FULFILLMENT: Look up department OUTSIDE transaction (move expensive lookups out)
    let deptId: string | null = null;
    const fulfilledQty = quantity || lineItem.quantity;
    
    console.log(`[FULFILLMENT] START - Order: ${orderId}, Line: ${lineItemId}, Status: ${status}, Qty: ${fulfilledQty}`);
    console.log(`[FULFILLMENT] Product Type: ${lineItem.productType}, Dept Code: ${lineItem.departmentCode}, Section: ${lineItem.departmentSectionId}`);
    
    if (status === 'fulfilled' && ['inventoryItem', 'food', 'drink'].includes(lineItem.productType)) {
      try {
        console.log(`[FULFILLMENT] Inventory deduction required for product type: ${lineItem.productType}`);
        
        // Get department info BEFORE transaction
        const dept = await prisma.department.findUnique({ 
          where: { code: lineItem.departmentCode } 
        });
        
        console.log(`[FULFILLMENT] Department lookup: ${dept?.id || 'NOT FOUND'} (code: ${lineItem.departmentCode})`);
        
        if (dept) {
          deptId = dept.id;
          
          // Build inventory check query
          const inventoryWhere: any = {
            departmentId: dept.id,
            inventoryItemId: lineItem.productId,
          };
          
          if (lineItem.departmentSectionId) {
            inventoryWhere.sectionId = lineItem.departmentSectionId;
          } else {
            inventoryWhere.sectionId = null;
          }
          
          console.log(`[FULFILLMENT] Inventory query: ${JSON.stringify(inventoryWhere)}`);
          
          // Get current inventory
          const inventory = await prisma.departmentInventory.findFirst({
            where: inventoryWhere,
          });
          
          console.log(`[FULFILLMENT] Current inventory found: ${inventory ? `Qty=${inventory.quantity}` : 'NOT FOUND'}`);
          
          // Check if enough quantity is available
          if (!inventory || inventory.quantity < fulfilledQty) {
            const available = inventory?.quantity || 0;
            console.warn(
              `[FULFILLMENT] ❌ Insufficient inventory for line ${lineItemId}: need ${fulfilledQty}, ` +
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
          
          console.log(`[FULFILLMENT] ✅ Inventory check passed. Will deduct ${fulfilledQty} from ${inventory.quantity}`);
        } else {
          console.log(`[FULFILLMENT] ⚠️ Department not found for code: ${lineItem.departmentCode}`);
        }
      } catch (e) {
        console.error(`[FULFILLMENT] ❌ Inventory validation error:`, e);
        deptId = null;
      }
    } else {
      console.log(`[FULFILLMENT] No inventory deduction: status=${status}, productType=${lineItem.productType}`);
    }

    // Step 1: MINIMAL TRANSACTION - Only update line, create fulfillment, deduct inventory
    // Keep transaction focused and fast
    let inventoryDeducted = false;
    
    console.log(`[FULFILLMENT] Starting transaction - deptId: ${deptId}, status: ${status}`);
    
    await prisma.$transaction(async (tx: any) => {
      console.log(`[FULFILLMENT] [TX] Updating line ${lineItemId} status to ${status}`);
      
      // Update line status
      await tx.orderLine.update({
        where: { id: lineItemId },
        data: { status },
      });
      
      console.log(`[FULFILLMENT] [TX] ✅ Line status updated`);

      // Create fulfillment record
      await (tx as any).orderFulfillment.create({
        data: {
          orderHeaderId: orderId,
          orderLineId: lineItemId,
          fulfilledQuantity: fulfilledQty,
          status,
          notes,
          fulfilledAt: status === 'fulfilled' ? new Date() : null,
        },
      });
      
      console.log(`[FULFILLMENT] [TX] ✅ Fulfillment record created`);

      // If fulfilled AND inventory item, deduct inventory within transaction
      if (status === 'fulfilled' && deptId && ['inventoryItem', 'food', 'drink'].includes(lineItem.productType)) {
        const inventoryWhere: any = {
          departmentId: deptId,
          inventoryItemId: lineItem.productId,
        };
        
        if (lineItem.departmentSectionId) {
          inventoryWhere.sectionId = lineItem.departmentSectionId;
        } else {
          inventoryWhere.sectionId = null;
        }
        
        console.log(`[FULFILLMENT] [TX] About to decrement inventory: ${JSON.stringify(inventoryWhere)} by ${fulfilledQty}`);
        
        // Single updateMany call - no fallback logic in transaction
        const invResult = await tx.departmentInventory.updateMany({
          where: inventoryWhere,
          data: { quantity: { decrement: fulfilledQty } },
        });
        
        console.log(`[FULFILLMENT] [TX] updateMany result: count=${invResult.count}`);
        
        inventoryDeducted = invResult.count > 0;
        
        if (inventoryDeducted) {
          console.log(`[FULFILLMENT] [TX] ✅ Inventory deducted successfully (${fulfilledQty} units)`);
        } else {
          console.log(`[FULFILLMENT] [TX] ❌ No inventory records updated (count=0)`);
        }
      } else {
        console.log(`[FULFILLMENT] [TX] Skipping inventory deduction: status=${status}, deptId=${deptId}, productType=${lineItem.productType}`);
      }
    }, { timeout: 15000 });
    
    console.log(`[FULFILLMENT] Transaction complete - inventoryDeducted: ${inventoryDeducted}`);
    
    // Step 2: FALLBACK - If inventory deduction failed in section, try department-level OUTSIDE transaction
    if (!inventoryDeducted && status === 'fulfilled' && deptId && ['inventoryItem', 'food', 'drink'].includes(lineItem.productType)) {
      console.log(`[FULFILLMENT] [FALLBACK] Inventory not deducted in transaction, trying department-level...`);
      
      try {
        console.log(`[FULFILLMENT] [FALLBACK] Attempting dept-level deduction: deptId=${deptId}, productId=${lineItem.productId}, qty=${fulfilledQty}`);
        
        const deptLevelResult = await prisma.departmentInventory.updateMany({
          where: {
            departmentId: deptId,
            inventoryItemId: lineItem.productId,
            sectionId: null,
          },
          data: { quantity: { decrement: fulfilledQty } },
        });
        
        console.log(`[FULFILLMENT] [FALLBACK] Department-level updateMany result: count=${deptLevelResult.count}`);
        
        inventoryDeducted = deptLevelResult.count > 0;
        if (inventoryDeducted) {
          console.log(`[FULFILLMENT] [FALLBACK] ✅ Department-level inventory deducted (fallback)`);
        } else {
          console.log(`[FULFILLMENT] [FALLBACK] ❌ No department-level inventory found (count=0)`);
        }
      } catch (e) {
        console.error(`[FULFILLMENT] [FALLBACK] ❌ Fallback inventory deduction failed:`, e);
      }
    }
    
    // Step 3: BATCH OPERATION - Fetch all required data for post-fulfillment operations in parallel
    let shouldUpdateOrderStatus = false;
    let updatedOrder = null;
    let deptCodesResult: any[] = [];
    
    console.log(`[FULFILLMENT] Final inventory status: deducted=${inventoryDeducted}`);
    
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
        
        console.log(`[FULFILLMENT] Order completion check: remainingLines=${remainingCount}, willCompleteOrder=${shouldUpdateOrderStatus}`);

        // Step 4: BATCH OPERATION - Update order statuses if complete
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

        // Step 5: BATCH OPERATION - Create inventory movement record if inventory was deducted in transaction
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

    // Step 6: BATCH OPERATION - Fetch updated order and department codes in parallel
    // We need department codes AND section IDs for every fulfillment to update stats
    const deptCodesWithSections: Array<{ code: string; sectionId?: string }> = [];
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
        // Always fetch department codes AND section IDs for stats update
        prisma.orderLine.findMany({
          where: { orderHeaderId: orderId },
          select: { departmentCode: true, departmentSectionId: true },
        }),
      ]);
      
      // Build array of unique department codes with their section IDs
      const uniqueMap = new Map<string, Set<string | null>>();
      (deptCodesResult as any[]).forEach((l: any) => {
        if (l.departmentCode) {
          if (!uniqueMap.has(l.departmentCode)) {
            uniqueMap.set(l.departmentCode, new Set());
          }
          uniqueMap.get(l.departmentCode)?.add(l.departmentSectionId || null);
        }
      });
      
      // Convert map to array format
      // Only include sectionId if it actually has a value (not null)
      uniqueMap.forEach((sectionIds, code) => {
        sectionIds.forEach(sectionId => {
          const entry: any = { code };
          if (sectionId) {
            entry.sectionId = sectionId;
          }
          deptCodesWithSections.push(entry);
        });
      });

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

    // Step 7: BATCH OPERATION - Recalculate stats for ALL affected departments and sections
    // This ensures section inventory and amount sold are updated for every fulfilled line
    if (deptCodesWithSections.length > 0) {
      try {
        const { departmentService } = await import('@/services/department.service');

        // Batch all stat calculations in parallel for all affected departments and sections
        await Promise.all(
          deptCodesWithSections.map(async ({ code, sectionId }) => {
            try {
              await Promise.all([
                // Update section stats if sectionId exists, otherwise update parent department stats
                departmentService.recalculateSectionStats(code, sectionId),
                // Only rollup to parent if we have a section (to avoid duplicate parent updates)
                sectionId ? departmentService.rollupParentStats(code) : Promise.resolve(),
              ]);
            } catch (e) {
              console.error(`Error updating stats for department ${code}${sectionId ? ` section ${sectionId}` : ''}:`, e);
            }
          })
        );
      } catch (e) {
        console.error('Error in stats recalculation:', e);
        // Don't fail the request
      }
    }

    console.log(`[FULFILLMENT] ✅ COMPLETE - Status: ${status}, InventoryDeducted: ${inventoryDeducted}, LineID: ${lineItemId}`);
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
