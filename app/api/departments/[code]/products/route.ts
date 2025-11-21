import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'

/**
 * GET /api/departments/[code]/products
 * Query params: ?type=drink|inventoryItem&page=1&pageSize=20&search=...
 * Returns paginated list of products relevant to the department with available quantity.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const url = new URL(request.url)
    const type = url.searchParams.get('type') || ''
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') || '20')))
    const search = url.searchParams.get('search') || ''

    const dept = await prisma.department.findUnique({ where: { code } })
    if (!dept) return NextResponse.json(errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'), { status: getStatusCode(ErrorCodes.NOT_FOUND) })

    const skip = (page - 1) * pageSize

    if ((type === 'drink' || dept.referenceType === 'BarAndClub') && dept.referenceId) {
      const where: any = { barAndClubId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }

      const [items, total] = await Promise.all([
        prisma.drink.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.drink.count({ where }),
      ])

      const mapped = items.map((d) => ({ id: d.id, name: d.name, type: 'drink', available: d.barStock ?? d.quantity ?? 0, unitPrice: d.price }))
      return NextResponse.json(successResponse({ items: mapped, total, page, pageSize }))
    }

    if ((type === 'food' || dept.referenceType === 'Restaurant') && dept.referenceId) {
      const where: any = { restaurantId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      const [items, total] = await Promise.all([
        prisma.foodItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.foodItem.count({ where }),
      ])
      const mapped = items.map((f) => ({ id: f.id, name: f.name, type: 'food', available: f.availability ? 1 : 0, unitPrice: (f.price as any) }))
      return NextResponse.json(successResponse({ items: mapped, total, page, pageSize }))
    }

    // Generic inventory items fallback
    {
      const where: any = {}
      if (search) where.name = { contains: search, mode: 'insensitive' }
      // if department.type looks like a category, filter by it
      if (dept.type) where.category = dept.type

      const [items, total] = await Promise.all([
        prisma.inventoryItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.inventoryItem.count({ where }),
      ])

      // fetch department balances in bulk
      const itemIds = items.map((i) => i.id)
  const balances = await (prisma as any).departmentInventory.findMany({ where: { departmentId: dept.id, inventoryItemId: { in: itemIds } } })
  const balancesMap = new Map(balances.map((b: any) => [b.inventoryItemId, b.quantity]))

      const mapped = items.map((it) => ({ id: it.id, name: it.name, type: 'inventoryItem', available: balancesMap.get(it.id) ?? it.quantity ?? 0, unitPrice: it.unitPrice }))
      return NextResponse.json(successResponse({ items: mapped, total, page, pageSize }))
    }
  } catch (err: any) {
    console.error('GET /api/departments/[code]/products error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch products'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}
