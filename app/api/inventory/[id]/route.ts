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

import { NextRequest } from 'next/server';
import { inventoryItemService, inventoryMovementService } from '@/services/inventory.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { StockService } from '@/services/stock.service';

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
