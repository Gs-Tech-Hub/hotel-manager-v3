import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * GET /api/departments/[code]/stock
 * Returns a stock summary for the department or section.
 * 
 * If code is a section (contains ':'), returns section-specific inventory.
 * Otherwise returns parent department inventory summary.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params

    // Check if this is a section code
    if (code.includes(':')) {
      const parts = code.split(':')
      const parentCode = parts[0]
      const sectionSlugOrId = parts.slice(1).join(':')

      const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
      if (!parentDept) {
        return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Parent department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
      }

      const section = await prisma.departmentSection.findFirst({
        where: {
          departmentId: parentDept.id,
          OR: [
            { slug: sectionSlugOrId },
            { id: sectionSlugOrId }
          ]
        }
      })

      if (!section) {
        return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Section not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
      }

      // Get section-specific inventory
      const inventories = await prisma.departmentInventory.findMany({
        where: { sectionId: section.id },
        include: { inventoryItem: true }
      })

      let low = 0
      let high = 0
      let empty = 0

      for (const inv of inventories) {
        const qty = inv.quantity ?? 0
        const threshold = inv.inventoryItem.reorderLevel ?? 10
        if (qty <= 0) empty += 1
        else if (qty <= threshold) low += 1
        else high += 1
      }

      const summary = { low, high, empty, totalProducts: inventories.length }
      return NextResponse.json(successResponse(summary))
    }

    // Otherwise process as parent department
    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) {
      return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })
    }

    // Default summary
    let summary = { low: 0, high: 0, empty: 0, totalProducts: 0 }

    // Always query DepartmentInventory for accurate department-level stock (regardless of department type)
    // This reflects transfers and other inventory movements
    const inventories = await prisma.departmentInventory.findMany({
      where: { departmentId: dept.id, sectionId: null },
      include: { inventoryItem: true }
    })

    if (inventories.length > 0) {
      let empty = 0
      let low = 0
      let high = 0
      for (const inv of inventories) {
        const qty = inv.quantity ?? 0
        const threshold = inv.inventoryItem.reorderLevel ?? 10
        if (qty <= 0) empty += 1
        else if (qty <= threshold) low += 1
        else high += 1
      }
      summary = { low, high, empty, totalProducts: inventories.length }
    } else if (dept.referenceType === 'BarAndClub' && dept.referenceId) {
      // Fallback: Use Drink.quantity if no DepartmentInventory records exist
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
      // Fallback: FoodItem has no quantity in schema; use availability as proxy
      const foods = await prisma.foodItem.findMany({ where: { restaurantId: dept.referenceId } })
      const total = foods.length
      const empty = foods.filter((f: any) => !f.availability).length
      const available = foods.filter((f: any) => f.availability).length
      // Heuristic: interpret a small available count as low
      const low = available > 0 && available <= Math.max(1, Math.floor(total * 0.2)) ? available : 0
      const high = available > Math.max(1, Math.floor(total * 0.2)) ? available : 0
      summary = { low, high, empty, totalProducts: total }
    } else {
      // Fallback: Generic inventory fallback using InventoryItem quantity
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
