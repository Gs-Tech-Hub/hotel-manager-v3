import { prisma } from '@/lib/auth/prisma'
import { prismaDecimalToCents } from '@/lib/price'
import { stockService } from './stock.service'
import { buildDateFilter } from '@/src/lib/date-filter'

type ProductParams = {
  departmentCode: string
  type?: string
  page?: number
  pageSize?: number
  search?: string
  sectionFilter?: string | null
  includeDetails?: boolean
  fromDate?: string | null
  toDate?: string | null
}

export class SectionService {
  // Safe defaults and maximums to avoid large payloads
  private readonly DEFAULT_PAGE = 1
  private readonly DEFAULT_PAGE_SIZE = 20
  private readonly MAX_PAGE_SIZE = 100

  async getProducts(params: ProductParams) {
    const page = Math.max(1, params.page || this.DEFAULT_PAGE)
    const pageSize = Math.min(this.MAX_PAGE_SIZE, Math.max(5, params.pageSize || this.DEFAULT_PAGE_SIZE))
    const skip = (page - 1) * pageSize
    const type = (params.type || '').toString()
    const search = params.search || ''
    const includeDetails = Boolean(params.includeDetails)
    const sectionFilter = params.sectionFilter || null

    // Resolve department row - handle section codes
    let dept = await prisma.department.findUnique({ where: { code: params.departmentCode } })
    
    // If not found and code contains ':', it might be a section code
    if (!dept && params.departmentCode.includes(':')) {
      const parts = params.departmentCode.split(':')
      const parentCode = parts[0]
      const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
      if (parentDept) {
        dept = parentDept
      }
    }
    
    if (!dept) throw new Error('Department not found')

    // Drink/food specializations
    if ((type === 'drink' || dept.referenceType === 'BarAndClub') && dept.referenceId) {
      const where: any = { barAndClubId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      const [items, total] = await Promise.all([
        prisma.drink.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.drink.count({ where }),
      ])

      // Use stockService for all drink balances - single source of truth
      const drinkIds = items.map((d: any) => d.id)
      const drinkBalances = await stockService.getBalances('drink', drinkIds, dept.id)

      let mapped = items.map((d: any) => ({ id: d.id, name: d.name, type: 'drink', available: drinkBalances.get(d.id) ?? 0, unitPrice: prismaDecimalToCents(d.price) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.id)
        const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

        // Only count items as sold if:
        // 1. Line status is 'fulfilled' (fulfillment requirement)
        // 2. Order header status is 'fulfilled' or 'completed'
        // 3. Payment status is 'paid' or 'partial' (payment was made)
        // 4. Order created within date range (if provided)
        const dateWhere = buildDateFilter(params.fromDate, params.toDate)

        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: 'fulfilled',
            orderHeader: { 
              status: { in: ['fulfilled', 'completed'] },
              paymentStatus: { in: ['paid', 'partial'] },
              ...dateWhere,
            },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

        mapped = mapped.map((m: any) => {
          const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
          // amountSold is lineTotal from database (Decimal type, already in cents)
          return {
            ...m,
            unitsSold: sold?.quantity || 0,
            amountSold: sold?.lineTotal ? prismaDecimalToCents(sold.lineTotal) : 0,
            pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || (pendingMap.get(`menu-${m.id}`) as any)?.quantity || 0,
          }
        })
      }

      return { items: mapped, total, page, pageSize }
    }

    // Food specialization
    if ((type === 'food' || dept.referenceType === 'Restaurant') && dept.referenceId) {
      const where: any = { restaurantId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      const [items, total] = await Promise.all([
        prisma.foodItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.foodItem.count({ where }),
      ])

      // Use stockService for all food balances - single source of truth
      const foodIds = items.map((f: any) => f.id)
      const foodBalances = await stockService.getBalances('food', foodIds, dept.id)

      let mapped = items.map((f: any) => ({ id: f.id, name: f.name, type: 'food', available: foodBalances.get(f.id) ?? 0 > 0 ? 1 : 0, unitPrice: prismaDecimalToCents(f.price) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.id)
        const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

        // Only count items as sold if:
        // 1. Line status is 'fulfilled' (fulfillment requirement)
        // 2. Order header status is 'fulfilled' or 'completed'
        // 3. Payment status is 'paid' or 'partial' (payment was made)
        // 4. Order created within date range (if provided)
        const dateWhere = buildDateFilter(params.fromDate, params.toDate)

        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: 'fulfilled',
            orderHeader: { 
              status: { in: ['fulfilled', 'completed'] },
              paymentStatus: { in: ['paid', 'partial'] },
              ...dateWhere,
            },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

        mapped = mapped.map((m: any) => {
          const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
          // amountSold is lineTotal from database (Decimal type, already in cents)
          return {
            ...m,
            unitsSold: sold?.quantity || 0,
            amountSold: sold?.lineTotal ? prismaDecimalToCents(sold.lineTotal) : 0,
            pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || (pendingMap.get(`menu-${m.id}`) as any)?.quantity || 0,
          }
        })
      }

      return { items: mapped, total, page, pageSize }
    }

    // Generic inventory fallback
    {
      const where: any = {}
      if (search) where.name = { contains: search, mode: 'insensitive' }

      const deptToCategoryMap: Record<string, string> = {
        restaurants: 'food',
        restaurant: 'food',
        bars: 'drinks',
        'bar-and-clubs': 'drinks',
        gyms: 'supplies',
        housekeeping: 'supplies',
        laundry: 'supplies',
        games: 'supplies',
        security: 'supplies',
      }

      let mappedCategory: string | undefined = undefined
      if (dept?.type) {
        const raw = String(dept.type).toLowerCase()
        if (deptToCategoryMap[raw]) mappedCategory = deptToCategoryMap[raw]
        else if (['food', 'drinks', 'supplies', 'toiletries', 'misc'].includes(raw)) mappedCategory = raw
      }

      if (mappedCategory) where.category = mappedCategory

      const [items, total] = await Promise.all([
        prisma.inventoryItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.inventoryItem.count({ where }),
      ])

      const itemIds = items.map((i: any) => i.id)
      
      // Resolve section ID if filtering by section
      let resolvedSectionId: string | undefined = undefined
      if (sectionFilter) {
        try {
          const parts = sectionFilter.split(':')
          if (parts.length === 2) {
            const parentCode = parts[0]
            const sectionSlugOrId = parts.slice(1).join(':')
            
            const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
            if (parentDept) {
              const section = await prisma.departmentSection.findFirst({
                where: {
                  departmentId: parentDept.id,
                  OR: [
                    { slug: sectionSlugOrId },
                    { id: sectionSlugOrId }
                  ]
                }
              })
              
              if (section) {
                resolvedSectionId = section.id
              }
            }
          }
        } catch (e) {}
      }

      const balances = await stockService.getBalances('inventoryItem', itemIds, dept.id, resolvedSectionId)

      let mapped = items.map((it: any) => ({ id: it.id, name: it.name, type: 'inventoryItem', available: balances.get(it.id) ?? 0, unitPrice: prismaDecimalToCents(it.unitPrice) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.id)
        const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

        // Only count items as sold if:
        // 1. Line status is 'fulfilled' (fulfillment requirement)
        // 2. Order header status is 'fulfilled' or 'completed'
        // 3. Payment status is 'paid' or 'partial' (payment was made)
        // 4. Order created within date range (if provided)
        const dateWhere = buildDateFilter(params.fromDate, params.toDate)

        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: 'fulfilled',
            orderHeader: { 
              status: { in: ['fulfilled', 'completed'] },
              paymentStatus: { in: ['paid', 'partial'] },
              ...dateWhere,
            },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
            ...(sectionFilter ? { departmentCode: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        let reservations: any[] = []
        try {
          // Reservations are not date-filtered as they're current state, not historical
          reservations = await (prisma as any).inventoryReservation.groupBy({
            by: ['inventoryItemId'],
            where: { inventoryItemId: { in: ids }, status: { in: ['reserved', 'confirmed'] } },
            _sum: { quantity: true },
          })
        } catch (e: any) {
          reservations = []
        }

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))
        const resMap = new Map(reservations.map((r: any) => [r.inventoryItemId, r._sum]))

        mapped = mapped.map((m: any) => {
          const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
          // amountSold is lineTotal from database (Decimal type, already in cents)
          return {
            ...m,
            unitsSold: sold?.quantity || 0,
            amountSold: sold?.lineTotal ? prismaDecimalToCents(sold.lineTotal) : 0,
            pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || (pendingMap.get(`menu-${m.id}`) as any)?.quantity || 0,
            reservedQuantity: (resMap.get(m.id) as any)?.quantity || 0,
          }
        })
      }

      return { items: mapped, total, page, pageSize }
    }
  }

  /**
   * Validate availability of drinks for a department before creating a transfer.
   * Uses stockService for consistency with other validation endpoints.
   * Returns { success: boolean, message?: string }
   */
  async validateDrinksAvailability(departmentCode: string, items: Array<{ productId: string; quantity: number }>) {
    if (!departmentCode) return { success: false, message: 'Missing department code' }
    if (!Array.isArray(items) || items.length === 0) return { success: true }

    const dept = await prisma.department.findUnique({ where: { code: departmentCode } })
    if (!dept) return { success: false, message: 'Department not found' }

    const drinkIds = Array.from(new Set(items.map((i) => i.productId)))
    if (drinkIds.length === 0) return { success: true }

    // Use stockService for all balance checks - single source of truth
    const checks = await stockService.checkAvailabilityBatch('drink', items.map(i => ({ productId: i.productId, requiredQuantity: i.quantity })), dept.id)

    for (const check of checks) {
      if (!check.hasStock) {
        return { success: false, message: check.message || `Insufficient stock for product ${check.productId}` }
      }
    }

    return { success: true }
  }
}

export const sectionService = new SectionService()
