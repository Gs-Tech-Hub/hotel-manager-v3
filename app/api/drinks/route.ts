/**
 * GET /api/drinks
 * Get all drinks with pagination and filtering
 * 
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - availability: boolean
 * - drinkTypeId: string
 * - search: string (search by name/description)
 * - lowStock: boolean (items below threshold)
 * - barId: string (filter by bar)
 * 
 * POST /api/drinks
 * Create a new drink
 */

import { NextRequest, NextResponse } from 'next/server';
import { drinkService } from '@/services/food-drink.service';
import { sendSuccess, sendError, getQueryParams } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const params = getQueryParams(req);
    const { page = 1, limit = 10, search, status } = params;
    const availability = req.nextUrl.searchParams.get('availability');
    const drinkTypeId = req.nextUrl.searchParams.get('drinkTypeId');
    const lowStock = req.nextUrl.searchParams.get('lowStock');
    const barId = req.nextUrl.searchParams.get('barId');

    // If search parameter, use search method
    if (search) {
      const results = await drinkService.searchDrinks(search);
      return sendSuccess(results);
    }

    // If lowStock filter, get low stock items
    if (lowStock === 'true') {
      const results = await drinkService.getLowStockDrinks();
      return sendSuccess(results);
    }

    // If bar filter, get drinks at specific bar
    if (barId) {
      if (typeof drinkService.getDrinksAtBar === 'function') {
        const results = await drinkService.getDrinksAtBar(barId);
        return sendSuccess(results);
      }
    }

    // If drinkType filter, get drinks by type
    if (drinkTypeId) {
      const results = await drinkService.getDrinksByType(drinkTypeId);
      return sendSuccess(results);
    }

    // If availability filter, get available drinks
    if (availability === 'true') {
      const results = await drinkService.getAvailableDrinks();
      return sendSuccess(results);
    }

    // Default: get all drinks with pagination
    const results = await drinkService.findAll({
      page,
      limit,
    });

    return sendSuccess(results);
  } catch (error) {
    console.error('GET /api/drinks error:', error);
    return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch drinks');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, price, drinkTypeId, barAndClubId } = body;

    // Validate required fields
    if (!name || !drinkTypeId) {
      return sendError(ErrorCodes.VALIDATION_ERROR, 'Missing required fields: name, drinkTypeId');
    }

    const drink = await drinkService.create({
      name,
      description,
      price,
      drinkTypeId,
      barAndClubId,
      availability: true,
      quantity: 0,
      barStock: 0,
      restaurantStock: 0,
    });

  return sendSuccess(drink, 'Drink created', 201);
  } catch (error) {
    console.error('POST /api/drinks error:', error);
    return sendError(ErrorCodes.INTERNAL_ERROR, 'Failed to create drink');
  }
}
