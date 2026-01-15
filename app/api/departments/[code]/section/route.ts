import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { sectionService } from '@/src/services/section.service'
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { buildDateFilter } from '@/src/lib/date-filter'

/**
 * GET /api/departments/[code]/section
 * Get complete section data including department info, products, inventory, and stock stats
 * This is the consolidated endpoint for section UI - provides all needed data in one request
 * 
 * Params:
 *   - code: department or section code (e.g., "RESTAURANT" or "RESTAURANT:bar")
 *   - type: optional product type filter (drink|food|inventoryItem)
 *   - pageSize: optional page size (default 20, max 100)
 *   - fromDate: optional ISO date string to filter sales from this date
 *   - toDate: optional ISO date string to filter sales to this date
 * 
 * Returns:
 * {
 *   success: boolean,
 *   data: {
 *     department: { id, code, name, description, type, icon, isActive, _isSection, ... },
 *     products: { items: [...], total, page, pageSize },
 *     stock: { low, high, empty, totalProducts },
 *     stats: { totalOrders, pendingOrders, processingOrders, fulfilledOrders }
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    
    // Normalize the code
    let lookupCode = code
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode)
        if (decoded === lookupCode) break
        lookupCode = decoded
      }
    } catch (e) {
      lookupCode = code
    }

    const url = new URL(request.url)
    const type = url.searchParams.get('type') || ''
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('pageSize') || '20')))
    const fromDate = url.searchParams.get('fromDate') || null
    const toDate = url.searchParams.get('toDate') || null

    // Allow public reads but include role/context if provided
    const ctx = await extractUserContext(request)
    
    // Get department/section info (includes order stats)
    let dept = await (prisma as any).department.findUnique({ where: { code: lookupCode } })
    let sectionRow: any = null

    // If not found, try to resolve as a section
    if (!dept) {
      try {
        const parts = (lookupCode || '').toString().split(':')
        if (parts.length >= 2) {
          const parentCode = parts[0]
          const slugOrId = parts.slice(1).join(':')
          const parent = await (prisma as any).department.findUnique({ where: { code: parentCode } })
          if (parent) {
            sectionRow = await (prisma as any).departmentSection.findFirst({
              where: {
                departmentId: parent.id,
                isActive: true,
                OR: [
                  { slug: slugOrId },
                  { id: slugOrId }
                ]
              }
            })

            if (sectionRow) {
              dept = {
                id: sectionRow.id,
                code: `${parent.code}:${sectionRow.slug || sectionRow.id}`,
                name: sectionRow.name,
                description: sectionRow.metadata?.description || sectionRow.metadata?.note || null,
                slug: sectionRow.slug || null,
                type: parent.type,
                icon: parent.icon,
                image: parent.image || null,
                referenceType: parent.referenceType,
                referenceId: parent.referenceId,
                metadata: sectionRow.metadata || {},
                isActive: sectionRow.isActive,
                _isSection: true,
              }
            }
          }
        }
      } catch (err) {
        // ignore
      }
    }

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department/section not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    // Get products with details using section service
    let products: any = { items: [], total: 0, page: 1, pageSize }
    try {
      products = await sectionService.getProducts({
        departmentCode: lookupCode,
        type: type || undefined,
        pageSize,
        includeDetails: true,
        sectionFilter: lookupCode.includes(':') ? lookupCode : null,
        fromDate,
        toDate,
      })
    } catch (e) {
      console.error('Failed to fetch products:', e)
      // Continue with empty products rather than failing completely
    }

    // Calculate stock stats from products
    const stock = { low: 0, high: 0, empty: 0, totalProducts: 0 }
    if (products.items && Array.isArray(products.items) && products.items.length > 0) {
      stock.totalProducts = products.total || products.items.length
      
      for (const item of products.items as any[]) {
        const available = (item && item.available) || 0
        if (available === 0) {
          stock.empty++
        } else if (available < 10) {
          stock.low++
        } else {
          stock.high++
        }
      }
    }

    // Compute order stats for section
    let totalOrders = 0
    let pendingOrders = 0
    let processingOrders = 0
    let fulfilledOrders = 0

    try {
      const codeStr = (dept.code || '').toString()
      // Build date filter for orderHeader using centralized utility
      const dateWhere = buildDateFilter(fromDate, toDate)

      if (codeStr.includes(':')) {
        // Section: count by department code on order lines
        const headerRows = await (prisma as any).orderLine.findMany({
          where: { departmentCode: dept.code },
          distinct: ['orderHeaderId'],
          select: { orderHeaderId: true },
        })
        const headerIds = (headerRows || []).map((h: any) => h.orderHeaderId).filter(Boolean)
        if (headerIds.length) {
          const hdrCounts = await (prisma as any).orderHeader.groupBy({
            by: ['status'],
            where: { id: { in: headerIds }, ...dateWhere },
            _count: { _all: true }
          })
          for (const r of hdrCounts) {
            const cnt = (r as any)._count?._all || 0
            totalOrders += cnt
            if (r.status === 'pending') pendingOrders += cnt
            if (r.status === 'processing') processingOrders += cnt
            if (r.status === 'fulfilled') fulfilledOrders += cnt
          }
        }
      } else {
        // Parent department: use OrderDepartment table
        totalOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, ...(Object.keys(dateWhere).length > 0 ? { orderHeader: dateWhere } : {}) } })
        pendingOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'pending', ...(Object.keys(dateWhere).length > 0 ? { orderHeader: dateWhere } : {}) } })
        processingOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'processing', ...(Object.keys(dateWhere).length > 0 ? { orderHeader: dateWhere } : {}) } })
        fulfilledOrders = await (prisma as any).orderDepartment.count({ where: { departmentId: dept.id, status: 'fulfilled', ...(Object.keys(dateWhere).length > 0 ? { orderHeader: dateWhere } : {}) } })
      }
    } catch (e) {
      // Ignore errors and keep zeros
      console.error('Failed to fetch order stats:', e)
    }

    // Prepare response with only needed data
    const response = {
      department: {
        id: dept.id,
        code: dept.code,
        name: dept.name,
        description: dept.description,
        type: dept.type,
        icon: dept.icon,
        image: dept.image,
        isActive: dept.isActive,
        _isSection: dept._isSection || false,
      },
      products,
      stock,
      stats: {
        totalOrders,
        pendingOrders,
        processingOrders,
        fulfilledOrders,
      },
    }

    return NextResponse.json(successResponse(response))
  } catch (error) {
    console.error('GET /api/departments/[code]/section error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section data'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}

