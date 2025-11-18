/**
 * GET /api/inventory/movements?itemId=string&type=in|out|adjustment|loss&startDate=ISO&endDate=ISO
 * Get inventory movements/history
 * 
 * POST /api/inventory/movements
 * Record a new inventory movement
 */

import { NextRequest } from 'next/server';
import { inventoryMovementService } from '@/services/inventory.service';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId') || undefined;
    const movementType = searchParams.get('type') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    let movements;

    if (itemId) {
      movements = await inventoryMovementService.getByItem(itemId);
    } else if (movementType) {
      movements = await inventoryMovementService.getByType(
        movementType as 'in' | 'out' | 'adjustment' | 'loss'
      );
    } else if (startDate && endDate) {
      movements = await inventoryMovementService.getByDateRange(
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      // Get all movements
      movements = await inventoryMovementService.findAll({
        page,
        limit,
      });

      if ('error' in movements) {
        return sendError(movements.error.code, movements.error.message);
      }

      return sendSuccess(movements, 'Movements fetched successfully');
    }

    // Apply pagination to filtered results
    const total = movements.length;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedMovements = movements.slice(startIdx, endIdx);
    const pages = Math.ceil(total / limit);

    return sendSuccess(
      {
        items: paginatedMovements,
        meta: {
          total,
          page,
          limit,
          pages,
        },
      },
      'Movements fetched successfully'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch movements';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (
      !body.itemId ||
      !body.movementType ||
      body.quantity === undefined
    ) {
      return sendError(
        ErrorCodes.VALIDATION_ERROR,
        'Missing required fields: itemId, movementType, quantity'
      );
    }

    const movement = await inventoryMovementService.recordMovement(
      body.itemId,
      body.movementType,
      body.quantity,
      body.reason,
      body.reference
    );

    if (!movement) {
      return sendError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to record movement'
      );
    }

    return sendSuccess(movement, 'Movement recorded successfully', 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record movement';
    return sendError(ErrorCodes.INTERNAL_ERROR, message);
  }
}
