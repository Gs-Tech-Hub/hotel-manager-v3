/**
 * GET /api/inventory/[id]
 * Get inventory item details with movement history and current stock
 * 
 * Query Parameters:
 * - includeMovements: boolean (default: false)
 * - departmentId: string (to get department-specific quantity)
 * 
 * PUT /api/inventory/[id]
 * Update an inventory item
 * 
 * DELETE /api/inventory/[id]
 * Delete an inventory item
 */

import { NextRequest, NextResponse } from 'next/server';
import { inventoryItemService, inventoryMovementService } from '@/services/inventory.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { StockService } from '@/services/stock.service';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { checkPermission } from '@/lib/auth/rbac';

const stockService = new StockService();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeMovements = searchParams.get('includeMovements') === 'true';
    const departmentId = searchParams.get('departmentId') || undefined;

    const item = await inventoryItemService.findById(id);

    if (!item) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Inventory item not found'
      );
    }

    // Get the department for quantity lookup (default to restaurant)
    let activeDeptId = departmentId;
    if (!activeDeptId) {
      const restaurantDept = await prisma.department.findFirst({ where: { code: 'restaurant' } });
      if (restaurantDept) {
        activeDeptId = restaurantDept.id;
      }
    }

    // Enrich with current quantity from DepartmentInventory (authoritative source)
    let enrichedItem = item;
    if (activeDeptId) {
      const balance = await stockService.getBalance('inventoryItem', id, activeDeptId);
      enrichedItem = {
        ...item,
        quantity: balance,
      };
    }

    if (includeMovements) {
      const movements = await inventoryMovementService.getByItem(id);
      return sendSuccess(
        { ...enrichedItem, movements },
        'Inventory item retrieved'
      );
    }

    return sendSuccess(enrichedItem, 'Inventory item retrieved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory item';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check authentication
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return sendError(ErrorCodes.UNAUTHORIZED, 'Not authenticated');
    }

    // Load user roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return sendError(ErrorCodes.FORBIDDEN, 'User not found');
    }

    // Check permission to update inventory
    const permCtx = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : 'other') as 'admin' | 'employee' | 'other',
    };
    
    const canUpdate = await checkPermission(permCtx, 'inventory.update', 'inventory');
    if (!canUpdate) {
      return sendError(ErrorCodes.FORBIDDEN, 'Insufficient permissions to update inventory');
    }

    const body = await req.json();

    const item = await inventoryItemService.update(id, body);

    if (!item) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Inventory item not found'
      );
    }

    return sendSuccess(item, 'Inventory item updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update inventory item';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check authentication
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return sendError(ErrorCodes.UNAUTHORIZED, 'Not authenticated');
    }

    // Load user roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return sendError(ErrorCodes.FORBIDDEN, 'User not found');
    }

    // Check permission to delete inventory
    const permCtx = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : 'other') as 'admin' | 'employee' | 'other',
    };
    
    const canDelete = await checkPermission(permCtx, 'inventory.delete', 'inventory');
    if (!canDelete) {
      return sendError(ErrorCodes.FORBIDDEN, 'Insufficient permissions to delete inventory');
    }

    const success = await inventoryItemService.delete(id);

    if (!success) {
      return sendError(
        ErrorCodes.NOT_FOUND,
        'Inventory item not found'
      );
    }

    return sendSuccess(null, 'Inventory item deleted successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete inventory item';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check authentication
    const ctx = await extractUserContext(req);
    if (!ctx.userId) {
      return sendError(ErrorCodes.UNAUTHORIZED, 'Not authenticated');
    }

    // Load user roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return sendError(ErrorCodes.FORBIDDEN, 'User not found');
    }

    // Admin-only for editing
    if (!userWithRoles.isAdmin) {
      return sendError(ErrorCodes.FORBIDDEN, 'Only admin can edit products');
    }

    const body = await req.json();
    const { name, unitPrice, quantity } = body;

    // Get current item
    const currentItem = await inventoryItemService.findById(id);

    if (!currentItem) {
      return sendError(ErrorCodes.NOT_FOUND, 'Inventory item not found');
    }

    // Build update data for item metadata
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (unitPrice !== undefined) updateData.unitPrice = unitPrice;

    // Update item metadata
    const updated = await inventoryItemService.update(id, updateData);

    if (!updated) {
      return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to update inventory item');
    }

    // Handle quantity update separately if provided
    if (quantity !== undefined && quantity !== currentItem.quantity) {
      // Get or create restaurant department for inventory tracking
      const restaurantDept = await prisma.department.findFirst({
        where: { code: 'restaurant' }
      });

      if (!restaurantDept) {
        return sendError(ErrorCodes.INTERNAL_ERROR, 'Restaurant department not found');
      }

      // Calculate quantity difference for movement tracking
      const quantityDifference = quantity - currentItem.quantity;

      // Find existing DepartmentInventory record
      const existingDeptInv = await prisma.departmentInventory.findFirst({
        where: {
          inventoryItemId: id,
          departmentId: restaurantDept.id,
          sectionId: null
        }
      });

      // Update or create DepartmentInventory (the authoritative source)
      if (existingDeptInv) {
        await prisma.departmentInventory.update({
          where: { id: existingDeptInv.id },
          data: { quantity: quantity }
        });
      } else {
        await prisma.departmentInventory.create({
          data: {
            inventoryItemId: id,
            departmentId: restaurantDept.id,
            quantity: quantity,
            sectionId: null
          }
        });
      }

      // Log inventory movement for audit trail
      if (quantityDifference !== 0) {
        const movementType = quantityDifference > 0 ? 'in' : 'out';
        await inventoryMovementService.create({
          inventoryItemId: id,
          movementType: movementType,
          quantity: Math.abs(quantityDifference),
          reason: `Manual adjustment: ${currentItem.quantity} → ${quantity}`,
          reference: `admin-edit-${ctx.userId}`
        });
      }
    }

    return sendSuccess(updated, 'Product updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
