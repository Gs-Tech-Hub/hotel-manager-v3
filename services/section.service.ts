import { prisma } from '@/lib/auth/prisma'
import { stockService } from './stock.service'
import { buildDateFilter, getTodayDate } from '@/lib/date-filter'

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

    // Normalize department code to lowercase to match database storage
    const normalizedDeptCode = (params.departmentCode || '').toLowerCase()

    // Resolve department row - handle section codes
    let dept = await prisma.department.findUnique({ where: { code: normalizedDeptCode } })
    
    // If not found and code contains ':', it might be a section code
    if (!dept && normalizedDeptCode.includes(':')) {
      const parts = normalizedDeptCode.split(':')
      const parentCode = parts[0]
      const parentDept = await prisma.department.findUnique({ where: { code: parentCode } })
      if (parentDept) {
        dept = parentDept
      }
    }
    
    if (!dept) throw new Error('Department not found')

    // Resolve section ID FIRST if filtering by section - needed for inventory queries
    let resolvedSectionId: string | undefined = undefined
    const isFilteringBySection = Boolean(params.sectionFilter)
    
    if (params.sectionFilter) {
      try {
        // Normalize section filter to lowercase
        const normalizedSectionFilter = params.sectionFilter.toLowerCase()
        const parts = normalizedSectionFilter.split(':')
        if (parts.length >= 2) {
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
      } catch (e) {
        console.error('Failed to resolve section filter:', params.sectionFilter, e)
      }
    }

    // If sectionFilter was provided but couldn't be resolved, return empty
    // Sections should NEVER inherit parent department inventory
    if (isFilteringBySection && !resolvedSectionId) {
      return { items: [], total: 0, page, pageSize }
    }

    // Drink/food specializations
    if ((type === 'drink' || dept.referenceType === 'BarAndClub') && dept.referenceId) {
      // For sections, only get drinks that have been transferred to that section
      if (resolvedSectionId) {
        // Get total count of transferred drinks for this section (before pagination)
        const totalTransferred = await prisma.departmentInventory.count({
          where: {
            departmentId: dept.id,
            sectionId: resolvedSectionId,
            quantity: { gt: 0 },
          },
        })

        if (totalTransferred === 0) {
          // No transferred drinks for this section
          return { items: [], total: 0, page, pageSize }
        }

        // Query paginated transferred drinks for section
        const sectionInventories = await prisma.departmentInventory.findMany({
          where: {
            departmentId: dept.id,
            sectionId: resolvedSectionId,
            quantity: { gt: 0 },
          },
          select: { inventoryItemId: true },
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' }, // Consistent ordering
        })

        const drinkIds = sectionInventories.map((si) => si.inventoryItemId)

        // Get drinks matching the transferred IDs (no pagination here - IDs already paginated)
        const where: any = { 
          barAndClubId: dept.referenceId,
          id: { in: drinkIds }
        }
        if (search) where.name = { contains: search, mode: 'insensitive' }

        const items = await prisma.drink.findMany({ 
          where,
          orderBy: { name: 'asc' }
        })

        const drinkBalances = await stockService.getBalances('drink', items.map(d => d.id), dept.id, resolvedSectionId)
        let mapped = items.map((d: any) => ({ id: d.id, name: d.name, type: 'drink', available: drinkBalances.get(d.id) ?? 0, unitPrice: Number(d.price) }))

        if (includeDetails && mapped.length > 0) {
          const ids = mapped.map((m: any) => m.id)
          const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

          // Build date filter - use today if no dates provided
          let dateWhere = buildDateFilter(params.fromDate, params.toDate)
          if (!params.fromDate && !params.toDate) {
            const today = getTodayDate()
            dateWhere = buildDateFilter(today, today)
          }

          const soldGroups = await prisma.orderLine.groupBy({
            by: ['productId'],
            where: {
              productId: { in: allPossibleIds },
              status: 'fulfilled',
              orderHeader: { 
                status: { in: ['processing', 'fulfilled', 'completed'] },
                paymentStatus: { in: ['paid', 'partial'] },
                ...dateWhere,
              },
              ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
            },
            _sum: { quantity: true, lineTotal: true },
          })

          const pendingGroups = await prisma.orderLine.groupBy({
            by: ['productId'],
            where: {
              productId: { in: allPossibleIds },
              status: { in: ['pending', 'processing'] },
              orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
              ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
            },
            _sum: { quantity: true },
          })

          const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
          const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

          mapped = mapped.map((m: any) => {
            const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
            return {
              ...m,
              unitsSold: sold?.quantity || 0,
              amountSold: (m.unitPrice * (sold?.quantity || 0)),
              pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || (pendingMap.get(`menu-${m.id}`) as any)?.quantity || 0,
            }
          })
        }

        return { items: mapped, total: totalTransferred, page, pageSize }
      }

      // For parent departments (no section filter), get all drinks
      const where: any = { barAndClubId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      const [items, total] = await Promise.all([
        prisma.drink.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.drink.count({ where }),
      ])

      // Use stockService for all drink balances - single source of truth
      const drinkIds = items.map((d: any) => d.id)
      const drinkBalances = await stockService.getBalances('drink', drinkIds, dept.id)

      let mapped = items.map((d: any) => ({ id: d.id, name: d.name, type: 'drink', available: drinkBalances.get(d.id) ?? 0, unitPrice: Number(d.price) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.id)
        const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

        // Build date filter - use today if no dates provided
        let dateWhere = buildDateFilter(params.fromDate, params.toDate)
        if (!params.fromDate && !params.toDate) {
          const today = getTodayDate()
          dateWhere = buildDateFilter(today, today)
        }

        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: 'fulfilled',
            orderHeader: { 
              status: { in: ['processing', 'fulfilled', 'completed'] },
              paymentStatus: { in: ['paid', 'partial'] },
              ...dateWhere,
            },
            ...(sectionFilter ? { departmentSectionId: sectionFilter } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
            ...(sectionFilter ? { departmentSectionId: sectionFilter } : {}),
          },
          _sum: { quantity: true },
        })

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

        mapped = mapped.map((m: any) => {
          const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
          return {
            ...m,
            unitsSold: sold?.quantity || 0,
            amountSold: (m.unitPrice * (sold?.quantity || 0)),
            pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || (pendingMap.get(`menu-${m.id}`) as any)?.quantity || 0,
          }
        })
      }

      return { items: mapped, total, page, pageSize }
    }

    // Food specialization
    if ((type === 'food' || dept.referenceType === 'Restaurant') && dept.referenceId) {
      // For sections, only get food items that have been transferred to that section
      if (resolvedSectionId) {
        // Get total count of transferred food items for this section (before pagination)
        const totalTransferred = await prisma.departmentInventory.count({
          where: {
            departmentId: dept.id,
            sectionId: resolvedSectionId,
            quantity: { gt: 0 },
          },
        })

        if (totalTransferred === 0) {
          // No transferred food items for this section
          return { items: [], total: 0, page, pageSize }
        }

        // Query paginated transferred food items for section
        const sectionInventories = await prisma.departmentInventory.findMany({
          where: {
            departmentId: dept.id,
            sectionId: resolvedSectionId,
            quantity: { gt: 0 },
          },
          select: { inventoryItemId: true },
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' }, // Consistent ordering
        })

        const foodIds = sectionInventories.map((si) => si.inventoryItemId)

        // Get food items matching the transferred IDs (no pagination here - IDs already paginated)
        const where: any = { 
          restaurantId: dept.referenceId,
          id: { in: foodIds }
        }
        if (search) where.name = { contains: search, mode: 'insensitive' }

        const items = await prisma.foodItem.findMany({ 
          where,
          orderBy: { name: 'asc' }
        })

        const foodBalances = await stockService.getBalances('food', items.map(f => f.id), dept.id, resolvedSectionId)
        let mapped = items.map((f: any) => ({ id: f.id, name: f.name, type: 'food', available: foodBalances.get(f.id) ?? 0 > 0 ? 1 : 0, unitPrice: Number(f.price) }))

        if (includeDetails && mapped.length > 0) {
          const ids = mapped.map((m: any) => m.id)
          const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

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
              ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
            },
            _sum: { quantity: true, lineTotal: true },
          })

          const pendingGroups = await prisma.orderLine.groupBy({
            by: ['productId'],
            where: {
              productId: { in: allPossibleIds },
              status: { in: ['pending', 'processing'] },
              orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
              ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
            },
            _sum: { quantity: true },
          })

          const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
          const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

          mapped = mapped.map((m: any) => {
            const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
            return {
              ...m,
              unitsSold: sold?.quantity || 0,
              amountSold: (m.unitPrice * (sold?.quantity || 0)),
              pendingQuantity: (pendingMap.get(m.id) as any)?.quantity || (pendingMap.get(`menu-${m.id}`) as any)?.quantity || 0,
            }
          })
        }

        return { items: mapped, total: totalTransferred, page, pageSize }
      }

      // For parent departments (no section filter), get all food items
      const where: any = { restaurantId: dept.referenceId }
      if (search) where.name = { contains: search, mode: 'insensitive' }
      const [items, total] = await Promise.all([
        prisma.foodItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
        prisma.foodItem.count({ where }),
      ])

      // Use stockService for all food balances - single source of truth
      const foodIds = items.map((f: any) => f.id)
      const foodBalances = await stockService.getBalances('food', foodIds, dept.id)

      let mapped = items.map((f: any) => ({ id: f.id, name: f.name, type: 'food', available: foodBalances.get(f.id) ?? 0 > 0 ? 1 : 0, unitPrice: Number(f.price) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.id)
        const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

        // Only count items as sold if:
        // 1. Line status is 'fulfilled' (fulfillment requirement)
        // 2. Order header status is 'fulfilled' or 'completed'
        // 3. Payment status is 'paid' or 'partial' (payment was made)
        // 4. Order created within date range (by default today)
        let dateWhere = buildDateFilter(params.fromDate, params.toDate)
        if (!params.fromDate && !params.toDate) {
          const today = getTodayDate()
          dateWhere = buildDateFilter(today, today)
        }

        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: 'fulfilled',
            orderHeader: { 
              status: { in: ['processing', 'fulfilled', 'completed'] },
              paymentStatus: { in: ['paid', 'partial'] },
              ...dateWhere,
            },
            ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
            ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
          },
          _sum: { quantity: true },
        })

        const soldMap = new Map(soldGroups.map((g: any) => [g.productId, g._sum]))
        const pendingMap = new Map(pendingGroups.map((g: any) => [g.productId, g._sum]))

        mapped = mapped.map((m: any) => {
          const sold = (soldMap.get(m.id) as any) || (soldMap.get(`menu-${m.id}`) as any)
          return {
            ...m,
            unitsSold: sold?.quantity || 0,
            amountSold: (m.unitPrice * (sold?.quantity || 0)),
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

      // If filtering by section, only get items that have been explicitly transferred to that section
      let items: any[] = []
      let total = 0
      
      if (resolvedSectionId) {
        // For sections: only show items with DepartmentInventory records for this section
        // Get total count first (before pagination)
        const totalInSection = await prisma.departmentInventory.count({
          where: {
            departmentId: dept.id,
            sectionId: resolvedSectionId,
            quantity: { gt: 0 }, // Only items with stock > 0
          },
        })

        if (totalInSection === 0) {
          items = []
          total = 0
        } else {
          // Get paginated inventory records for section
          const sectionInventories = await prisma.departmentInventory.findMany({
            where: {
              departmentId: dept.id,
              sectionId: resolvedSectionId,
              quantity: { gt: 0 },
            },
            select: { inventoryItemId: true },
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' }, // Consistent ordering
          })

          const inventoryItemIds = sectionInventories.map((si) => si.inventoryItemId)

          // Fetch the actual inventory items (no pagination - IDs already paginated)
          items = await prisma.inventoryItem.findMany({
            where: { ...where, id: { in: inventoryItemIds } },
            orderBy: { name: 'asc' },
          })
          total = totalInSection
        }
      } else {
        // For parent departments: get all items in the category
        [items, total] = await Promise.all([
          prisma.inventoryItem.findMany({ where, skip, take: pageSize, orderBy: { name: 'asc' } }),
          prisma.inventoryItem.count({ where }),
        ])
      }

      const itemIds = items.map((i: any) => i.id)
      const balances = await stockService.getBalances('inventoryItem', itemIds, dept.id, resolvedSectionId)

      let mapped = items.map((it: any) => ({ id: it.id, name: it.name, type: 'inventoryItem', available: balances.get(it.id) ?? 0, unitPrice: Number(it.unitPrice) }))

      if (includeDetails && mapped.length > 0) {
        const ids = mapped.map((m: any) => m.id)
        const allPossibleIds = [...ids, ...ids.map((id) => `menu-${id}`)]

        // Build date filter - use today if no dates provided
        let dateWhere = buildDateFilter(params.fromDate, params.toDate)
        if (!params.fromDate && !params.toDate) {
          // Use today's date by default
          const today = getTodayDate()
          dateWhere = buildDateFilter(today, today)
        }

        // Only count items as sold if:
        // 1. Line status is 'fulfilled' (fulfillment requirement)
        // 2. Order header status is 'processing', 'fulfilled' or 'completed' (after payment, order moves to processing)
        // 3. Payment status is 'paid' or 'partial' (payment was made)
        // 4. Order created within date range (today by default)
        const soldGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: 'fulfilled',
            orderHeader: { 
              status: { in: ['processing', 'fulfilled', 'completed'] },
              paymentStatus: { in: ['paid', 'partial'] },
              ...dateWhere,
            },
            ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
          },
          _sum: { quantity: true, lineTotal: true },
        })

        const pendingGroups = await prisma.orderLine.groupBy({
          by: ['productId'],
          where: {
            productId: { in: allPossibleIds },
            status: { in: ['pending', 'processing'] },
            orderHeader: { status: { not: 'cancelled' }, ...dateWhere },
            ...(resolvedSectionId ? { departmentSectionId: resolvedSectionId } : {}),
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
          const pending = (pendingMap.get(m.id) as any) || (pendingMap.get(`menu-${m.id}`) as any)
          const reserved = (resMap.get(m.id) as any) || { quantity: 0 }
          
          // Reserved quantity includes both explicit reservations and pending orders
          const totalReserved = (reserved?.quantity || 0) + (pending?.quantity || 0)
          
          return {
            ...m,
            unitsSold: sold?.quantity || 0,
            amountSold: (m.unitPrice * (sold?.quantity || 0)),
            pendingQuantity: pending?.quantity || 0,
            reservedQuantity: totalReserved,
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

    // Normalize department code to lowercase
    const normalizedCode = departmentCode.toLowerCase()
    const dept = await prisma.department.findUnique({ where: { code: normalizedCode } })
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
