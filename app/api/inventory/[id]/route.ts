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

    // Get the department for quantity lookup (default to restaurant for display context)
    let activeDeptId = departmentId;
    if (!activeDeptId) {
      const restaurantDept = await prisma.department.findFirst({ where: { code: 'restaurant' } });
      if (restaurantDept) {
        activeDeptId = restaurantDept.id;
      }
    }

    // Enrich with CONSOLIDATED current quantity from DepartmentInventory (authoritative source)
    // Use null departmentId to get sum across ALL departments
    let enrichedItem = item;
    const consolidatedBalance = await stockService.getBalance('inventoryItem', id, activeDeptId || '');
    // Also get the truly consolidated balance across all departments
    const consolidatedBalances = await stockService.getBalances('inventoryItem', [id], null);
    const globalConsolidatedQty = consolidatedBalances.get(id) ?? 0;
    
    enrichedItem = {
      ...item,
      quantity: globalConsolidatedQty,  // Use global consolidated quantity, not department-specific
    };

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
      userType: (userWithRoles.isAdmin ? 'admin' : 'employee') as 'admin' | 'employee' | 'other',
    };
    
    const canUpdate = await checkPermission(permCtx, 'inventory.update');
    if (!canUpdate) {
      return sendError(ErrorCodes.FORBIDDEN, 'Insufficient permissions to update inventory');
    }

    const body = await req.json();

    // Only allow updating name and unitPrice through PUT
    // Quantity changes must go through /api/inventory/movements for audit trail
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.unitPrice !== undefined) {
      // Forms already convert dollars to cents, API stores as-is
      updateData.unitPrice = Number(body.unitPrice);
    }
    // Explicitly ignore quantity field if provided
    delete body.quantity;

    // Apply updates directly via Prisma to ensure normalized prices are stored
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
    });

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
      userType: (userWithRoles.isAdmin ? 'admin' : 'employee') as 'admin' | 'employee' | 'other',
    };
    
    const canDelete = await checkPermission(permCtx, 'inventory.delete');
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
    const { name, unitPrice } = body;

    // Get current item
    const currentItem = await inventoryItemService.findById(id);

    if (!currentItem) {
      return sendError(ErrorCodes.NOT_FOUND, 'Inventory item not found');
    }

    // Build update data for item metadata only (name, unitPrice)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (unitPrice !== undefined) updateData.unitPrice = unitPrice;

    // Update item metadata
    const updated = await inventoryItemService.update(id, updateData);

    if (!updated) {
      return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to update inventory item');
    }

    return sendSuccess(updated, 'Product updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
