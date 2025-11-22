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

    const includeDetails = url.searchParams.get('details') === 'true'
    const sectionFilter = url.searchParams.get('section') || null

    if ((type === 'drink' || dept.referenceType === 'BarAndClub') && dept.referenceId) {
      const where: any = { barAndClubId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }

      const [items, total] = await Promise.all([
        prisma.drink.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.drink.count({ where }),
      ])

      let mapped = items.map((d) => ({ id: d.id, name: d.name, type: 'drink', available: d.barStock ?? d.quantity ?? 0, unitPrice: d.price }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m) => m.id)
        // Units sold and amount sold (completed or fulfilled lines)
        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: ids },
            OR: [ { orderHeader: { status: 'completed' } }, { status: 'fulfilled' } ],
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: ids },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' } },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

        mapped = mapped.map((m) => ({
          ...m,
          unitsSold: (soldMap.get(m.id) as any)?.quantity || 0,
          amountSold: (soldMap.get(m.id) as any)?.lineTotal || 0,
          pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || 0,
        }))
      }

      return NextResponse.json(successResponse({ items: mapped, total, page, pageSize }))
    }

    if ((type === 'food' || dept.referenceType === 'Restaurant') && dept.referenceId) {
      const where: any = { restaurantId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      const [items, total] = await Promise.all([
        prisma.foodItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.foodItem.count({ where }),
      ])
      let mapped = items.map((f) => ({ id: f.id, name: f.name, type: 'food', available: f.availability ? 1 : 0, unitPrice: (f.price as any) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m) => m.id)
        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: ids },
            OR: [ { orderHeader: { status: 'completed' } }, { status: 'fulfilled' } ],
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: ids },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' } },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

        mapped = mapped.map((m) => ({
          ...m,
          unitsSold: (soldMap.get(m.id) as any)?.quantity || 0,
          amountSold: (soldMap.get(m.id) as any)?.lineTotal || 0,
          pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || 0,
        }))
      }

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

      // fetch department balances in bulk. The DepartmentInventory table may not exist
      // in some environments (before migrations). Catch the error and fall back to
      // using the inventory item's own quantity when the table is missing.
      const itemIds = items.map((i) => i.id)
      let balances: any[] = []
      try {
        balances = await (prisma as any).departmentInventory.findMany({ where: { departmentId: dept.id, inventoryItemId: { in: itemIds } } })
      } catch (e: any) {
        // Prisma P2021 means the table doesn't exist in the DB; log and continue
        // with no balances so the UI falls back to the item's base quantity.
        try {
          if (e?.code === 'P2021') {
            console.warn('departmentInventory table missing, falling back to inventoryItem.quantity')
          } else {
            console.error('Unexpected error querying departmentInventory, continuing with fallback', e)
          }
        } catch (ee) {
          // ignore
        }
        balances = []
      }

      const balancesMap = new Map(balances.map((b: any) => [b.inventoryItemId, b.quantity]))

      let mapped = items.map((it) => ({ id: it.id, name: it.name, type: 'inventoryItem', available: balancesMap.get(it.id) ?? it.quantity ?? 0, unitPrice: it.unitPrice }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m) => m.id)

        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: ids },
            OR: [ { orderHeader: { status: 'completed' } }, { status: 'fulfilled' } ],
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: ids },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' } },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        // reservations for inventory items
        let reservations: any[] = []
        try {
          reservations = await (prisma as any).inventoryReservation.groupBy({
            by: ['inventoryItemId'],
            where: { inventoryItemId: { in: ids }, status: { in: ['reserved', 'confirmed'] } },
            _sum: { quantity: true },
          })
        } catch (e: any) {
          // If reservations grouping fails for any reason, log and fall back
          // to zero reserved quantities to avoid failing the whole request.
          console.warn('inventoryReservation.groupBy failed, continuing with empty reservations', e?.message || e)
          reservations = []
        }

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))
        const resMap = new Map(reservations.map((r: any) => [r.inventoryItemId, r._sum]))

        mapped = mapped.map((m) => ({
          ...m,
          unitsSold: (soldMap.get(m.id) as any)?.quantity || 0,
          amountSold: (soldMap.get(m.id) as any)?.lineTotal || 0,
          pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || 0,
          reservedQuantity: (resMap.get(m.id) as any)?.quantity || 0,
        }))
      }

      return NextResponse.json(successResponse({ items: mapped, total, page, pageSize }))
    }
  } catch (err: any) {
    console.error('GET /api/departments/[code]/products error', err)
    return NextResponse.json(errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch products'), { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) })
  }
}
