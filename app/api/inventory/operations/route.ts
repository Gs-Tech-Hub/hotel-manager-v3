/**
 * GET /api/inventory/stats
 * Get inventory statistics
 * 
 * GET /api/inventory/low-stock
 * Get items with low stock
 * 
 * GET /api/inventory/expired
 * Get expired items
 * 
 * POST /api/inventory/adjust
 * Adjust inventory quantity
 */

import { NextRequest } from 'next/server';
import { inventoryItemService, inventoryMovementService } from '@/services/inventory.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operation = searchParams.get('op');

    if (operation === 'stats') {
      const stats = await inventoryItemService.getInventoryStats();
      if (!stats) {
        return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch stats');
      }
      return sendSuccess(stats, 'Inventory statistics fetched');
    }

    if (operation === 'low-stock') {
      const items = await inventoryItemService.getLowStockItems();
      return sendSuccess(
        { items, count: items.length },
        'Low stock items fetched'
      );
    }

    if (operation === 'expired') {
      const items = await inventoryItemService.getExpiredItems();
      return sendSuccess(
        { items, count: items.length },
        'Expired items fetched'
      );
    }

    if (operation === 'needs-restock') {
      const items = await inventoryItemService.getItemsNeedingRestock();
      return sendSuccess(
        { items, count: items.length },
        'Items needing restock fetched'
      );
    }

    return sendError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid operation. Use ?op=stats, ?op=low-stock, ?op=expired, or ?op=needs-restock'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory data';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * POST /api/inventory/adjust
 * Adjust inventory quantity
 * 
 * Body:
 * {
 *   "itemId": "string",
 *   "delta": number (positive or negative),
 *   "reason": "string",
 *   "reference": "string" (optional - e.g., booking ID, order ID)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operation = searchParams.get('op');

    if (operation === 'adjust') {
      const body = await req.json();

      // Validate required fields
      if (!body.itemId || body.delta === undefined) {
        return sendError(
          ErrorCodes.VALIDATION_ERROR,
          'Missing required fields: itemId, delta'
        );
      }

      const item = await inventoryItemService.adjustQuantity(
        body.itemId,
        body.delta,
        body.reason
      );

      if (!item) {
        return sendError(
          ErrorCodes.NOT_FOUND,
          'Inventory item not found'
        );
      }

      // If reference is provided, record it in the movement
      if (body.reference) {
        await inventoryMovementService.recordMovement(
          body.itemId,
          body.delta > 0 ? 'in' : 'out',
          Math.abs(body.delta),
          body.reason,
          body.reference
        );
      }

      return sendSuccess(item, 'Inventory adjusted successfully');
    }

    return sendError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid operation. Use ?op=adjust for quantity adjustments'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to adjust inventory';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
