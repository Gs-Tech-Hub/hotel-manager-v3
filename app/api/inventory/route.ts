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

import { NextRequest } from 'next/server';
import { inventoryItemService } from '@/services/inventory.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { mapDeptCodeToCategory } from '@/lib/utils';
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

    let items: any[] = [];

    if (search) {
      items = await inventoryItemService.search(search);
    } else if (lowStock) {
      items = await inventoryItemService.getLowStockItems();
    } else if (expired) {
      items = await inventoryItemService.getExpiredItems();
    } else {
      // Query directly from Prisma to ensure isActive filter
      const where: any = { isActive: true };
      if (inventoryTypeId) where.inventoryTypeId = inventoryTypeId;
      if (category) where.category = category;
      if (itemType) where.itemType = itemType;
      if (location) where.location = location;

      items = await prisma.inventoryItem.findMany({
        where,
        include: { inventoryType: true },
        orderBy: { name: 'asc' },
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
    if (!body.name || !body.category || body.unitPrice === undefined) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: name, category, unitPrice'
      );
    }

    // Auto-generate SKU if not provided (category + timestamp)
    let sku = body.sku;
    if (!sku && body.category) {
      const timestamp = Date.now().toString().slice(-6);
      const prefix = body.category.slice(0, 3).toUpperCase();
      sku = `${prefix}-${timestamp}`;
    }

    if (!sku) {
      return sendError(ErrorCodes.VALIDATION_ERROR, 'SKU could not be generated or provided');
    }

    // Strict category validation: build allowed categories from departments mapping
    try {
      const depts = await prisma.department.findMany({ select: { code: true } });
      const allowed = Array.from(new Set(depts.map((d) => mapDeptCodeToCategory(d.code)).filter(Boolean)));
      if (allowed.length > 0 && !allowed.includes(body.category)) {
        return sendError(ErrorCodes.VALIDATION_ERROR, 'Invalid category. Must be one of: ' + allowed.join(', '));
      }
    } catch (err) {
      console.warn('[Inventory] Could not validate category against departments', err);
    }

    // Check if SKU already exists
    const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (existing) {
      return sendError(ErrorCodes.VALIDATION_ERROR, `Inventory item with SKU "${sku}" already exists`);
    }

    // Get or create default inventory type
    let inventoryTypeId = (await prisma.inventoryType.findFirst({ where: { typeName: 'General' } }))?.id;
    if (!inventoryTypeId) {
      const defaultType = await prisma.inventoryType.create({ data: { typeName: 'General' } });
      inventoryTypeId = defaultType.id;
    }

    // Create inventory item directly via Prisma
    const item = await prisma.inventoryItem.create({
      data: {
        name: body.name,
        sku,
        category: body.category,
        unitPrice: Number(body.unitPrice),
        quantity: body.quantity ? Number(body.quantity) : 0,
        description: body.description || null,
        itemType: body.itemType || null,
        inventoryTypeId,
        isActive: true,
      },
    });

    if (!item) {
      return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to create inventory item');
    }

    return sendSuccess(item, 'Inventory item created successfully', 201);
  } catch (error) {
    console.error('[Inventory POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create inventory item';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * DELETE /api/inventory/:id or ?id=
 * Delete/deactivate an inventory item (admin only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    
    // Check query string first, then pathname
    let id: string | null = url.searchParams.get('id');
    if (!id) {
      const pathId = url.pathname.split('/').pop();
      id = pathId && pathId !== 'route.ts' && pathId !== 'inventory' ? pathId : null;
    }

    if (!id) {
      return sendError(ErrorCodes.VALIDATION_ERROR, 'Inventory item ID is required');
    }

    // Soft delete: set isActive to false
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { isActive: false },
    });

    if (!item) {
      return sendError(ErrorCodes.NOT_FOUND, 'Inventory item not found');
    }

    return sendSuccess(item, 'Inventory item deleted successfully');
  } catch (error: any) {
    console.error('[Inventory DELETE] Error:', error);
    
    // Handle Prisma not found error
    if (error?.code === 'P2025') {
      return sendError(ErrorCodes.NOT_FOUND, 'Inventory item not found');
    }
    
    const message = error instanceof Error ? error.message : 'Failed to delete inventory item';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
