import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * GET /api/departments/[code]/stock
 * Returns a stock summary for the department's referenced entity.
 *
 * NOTE: schema limitations - FoodItem does not store quantity in schema;
 * for Restaurants we use FoodItem.availability as a simple proxy.
 * For BarAndClub we use Drink.quantity/threshold when available.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params

    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Default summary
    let summary = { low: 0, high: 0, empty: 0, totalProducts: 0 }

    if (dept.referenceType === 'BarAndClub' && dept.referenceId) {
      // Use Drink.quantity and threshold
      const drinks = await prisma.drink.findMany({ where: { barAndClubId: dept.referenceId } })
      const total = drinks.length
      let empty = 0
      let low = 0
      let high = 0
      for (const d of drinks) {
        const qty = d.quantity ?? 0
        const threshold = d.threshold ?? 10
        if (qty <= 0) empty += 1
        else if (qty <= threshold) low += 1
        else high += 1
      }
      summary = { low, high, empty, totalProducts: total }
    } else if (dept.referenceType === 'Restaurant' && dept.referenceId) {
      // FoodItem has no quantity in schema; use availability as proxy
      const foods = await prisma.foodItem.findMany({ where: { restaurantId: dept.referenceId } })
      const total = foods.length
      const empty = foods.filter((f: any) => !f.availability).length
      const available = foods.filter((f: any) => f.availability).length
      // Heuristic: interpret a small available count as low
      const low = available > 0 && available <= Math.max(1, Math.floor(total * 0.2)) ? available : 0
      const high = available > Math.max(1, Math.floor(total * 0.2)) ? available : 0
      summary = { low, high, empty, totalProducts: total }
    } else {
      // Generic inventory fallback: use inventory_items that match department type/category
      const items = await prisma.inventoryItem.findMany({ where: { category: dept.type || undefined } })
      const total = items.length
      let empty = 0
      let low = 0
      let high = 0
      for (const it of items) {
        const qty = it.quantity ?? 0
        const threshold = it.reorderLevel ?? 10
        if (qty <= 0) empty += 1
        else if (qty <= threshold) low += 1
        else high += 1
      }
      summary = { low, high, empty, totalProducts: total }
    }

    return NextResponse.json(successResponse(summary))
  } catch (err) {
    console.error('GET /api/departments/[code]/stock error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch stock summary'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}
