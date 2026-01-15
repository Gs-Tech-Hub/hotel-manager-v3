/**
 * GET /api/food
 * List/search food items
 *
 * Query params:
 * - page, limit
 * - search
 * - availability
 * - categoryId
 * - restaurantId
 *
 * POST /api/food
 * Create a food item
 */

import { NextRequest } from 'next/server';
import { foodItemService } from '@/services/food-drink.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const params = getQueryParams(req);
    const { page = 1, limit = 10, search } = params;
    const availability = req.nextUrl.searchParams.get('availability');
    const categoryId = req.nextUrl.searchParams.get('categoryId');
    const restaurantId = req.nextUrl.searchParams.get('restaurantId');

    if (search) {
      const results = await foodItemService.searchFoodItems(search);
      return sendSuccess(results);
    }

    if (availability === 'true') {
      const results = await foodItemService.getAvailableFoodItems();
      return sendSuccess(results);
    }

    if (categoryId) {
      const results = await foodItemService.getByCategory(categoryId);
      return sendSuccess(results);
    }

    if (restaurantId) {
      const results = await foodItemService.getByRestaurant(restaurantId);
      return sendSuccess(results);
    }

    const results = await foodItemService.findAll({ page, limit });
    return sendSuccess(results);
  } catch (error) {
    console.error('GET /api/food error:', error);
    return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch food items');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, price, foodTypeId, menuCategoryId, restaurantId } = body;

    if (!name || !foodTypeId) {
      return sendError(ErrorCodes.VALIDATION_ERROR, 'Missing required fields: name, foodTypeId');
    }

    const item = await foodItemService.create({
      name,
      description,
      price,
      foodTypeId,
      menuCategoryId,
      restaurantId,
      availability: true,
    });

    return sendSuccess(item, 'Food item created', 201);
  } catch (error) {
    console.error('POST /api/food error:', error);
    return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to create food item');
  }
}

