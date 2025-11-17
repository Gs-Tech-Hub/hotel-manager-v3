/**
 * GET /api/inventory
 * Get all inventory items with optional filtering
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - inventoryTypeId: string
 * - category: string (e.g., drinks, supplies, equipment, linens)
 * - itemType: string
 * - location: string
 * - search: string (search by name or SKU)
 * - lowStock: boolean (only show low stock items)
 * - expired: boolean (only show expired items)
 */

import { NextRequest, NextResponse } from 'next/server';
import { inventoryItemService } from '@/services/inventory.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const inventoryTypeId = searchParams.get('inventoryTypeId') || undefined;
    const category = searchParams.get('category') || undefined;
    const itemType = searchParams.get('itemType') || undefined;
    const location = searchParams.get('location') || undefined;
    const search = searchParams.get('search') || undefined;
    const lowStock = searchParams.get('lowStock') === 'true';
    const expired = searchParams.get('expired') === 'true';

    let items;

    if (search) {
      items = await inventoryItemService.search(search);
    } else if (lowStock) {
      items = await inventoryItemService.getLowStockItems();
    } else if (expired) {
      items = await inventoryItemService.getExpiredItems();
    } else {
      items = await inventoryItemService.getAllItems({
        inventoryTypeId,
        category,
        itemType,
        location,
      });
    }

    // Apply pagination
    const total = items.length;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedItems = items.slice(startIdx, endIdx);
    const pages = Math.ceil(total / limit);

    return sendSuccess(
      {
        items: paginatedItems,
        meta: {
          total,
          page,
          limit,
          pages,
        },
      },
      'Inventory items fetched successfully'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory items';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * POST /api/inventory
 * Create a new inventory item
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.sku || !body.category || !body.inventoryTypeId || body.unitPrice === undefined) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: name, sku, category, inventoryTypeId, unitPrice'
      );
    }

    const item = await inventoryItemService.create(body);

    if (!item) {
      return sendError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create inventory item'
      );
    }

    return sendSuccess(item, 'Inventory item created successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory item';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
