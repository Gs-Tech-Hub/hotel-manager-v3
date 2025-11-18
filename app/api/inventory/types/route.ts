/**
 * GET /api/inventory/types
 * Get all inventory types
 * 
 * POST /api/inventory/types
 * Create a new inventory type
 */

import { NextRequest } from 'next/server';
import { inventoryTypeService } from '@/services/inventory.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;

    let types;

    if (category) {
      types = await inventoryTypeService.getByCategory(category);
    } else {
      types = await inventoryTypeService.getAllTypes();
    }

    return sendSuccess(
      {
        items: types,
        meta: {
          total: types.length,
        },
      },
      'Inventory types fetched successfully'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory types';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.typeName) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required field: typeName'
      );
    }

    const type = await inventoryTypeService.create(body);

    if (!type) {
      return sendError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create inventory type'
      );
    }

    return sendSuccess(type, 'Inventory type created successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory type';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
