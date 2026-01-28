import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { sectionService } from '@/services/section.service'
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { buildDateFilter } from '@/lib/date-filter'

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
    
    // Normalize the code to lowercase (database storage format)
    let lookupCode = code.toLowerCase()
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode)
        if (decoded === lookupCode) break
        lookupCode = decoded.toLowerCase() // Also lowercase the decoded result
      }
    } catch (e) {
      lookupCode = code.toLowerCase()
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

    // Compute order stats for section from department metadata
    // The recalculateSectionStats service already aggregates these,
    // so we just use the cached values in department.metadata.sectionStats
    let stats = {
      totalOrders: 0,
      pendingOrders: 0,
      processingOrders: 0,
      fulfilledOrders: 0,
      totalUnits: 0,
      fulfilledUnits: 0,
      amountFulfilled: 0,
      amountPaid: 0,
    }

    // Use cached stats from department metadata if available
    if (dept.metadata?.sectionStats) {
      stats = dept.metadata.sectionStats;
    } else {
      // Fallback: compute stats on the fly for debugging
      try {
        const codeStr = (dept.code || '').toString()
        
        if (codeStr.includes(':')) {
          // Section: aggregate by department code on order lines
          const [
            totalOrderIds,
            pendingLineIds,
            processingLineIds,
            fulfilledLineIds,
            totalUnitsRes,
            fulfilledUnitsRes,
            amountFulfilledRes,
            amountPaidRes,
          ] = await Promise.all([
            prisma.orderLine.findMany({
              where: { departmentCode: codeStr },
              distinct: ['orderHeaderId'],
              select: { orderHeaderId: true },
            }),
            prisma.orderLine.count({ where: { departmentCode: codeStr, status: 'pending' } }),
            prisma.orderLine.count({ where: { departmentCode: codeStr, status: 'processing' } }),
            prisma.orderLine.count({ where: { departmentCode: codeStr, status: 'fulfilled' } }),
            (prisma as any).orderLine.aggregate({
              _sum: { quantity: true },
              where: { departmentCode: codeStr },
            }),
            (prisma as any).orderLine.aggregate({
              _sum: { quantity: true },
              where: { departmentCode: codeStr, status: 'fulfilled' },
            }),
            (prisma as any).orderLine.aggregate({
              _sum: { lineTotal: true },
              where: { departmentCode: codeStr, status: 'fulfilled' },
            }),
            (prisma as any).orderLine.aggregate({
              _sum: { lineTotal: true },
              where: {
                departmentCode: codeStr,
                status: 'fulfilled',
                orderHeader: {
                  status: { in: ['fulfilled', 'completed'] },
                  paymentStatus: { in: ['paid', 'partial'] },
                },
              },
            }),
          ]);

          stats = {
            totalOrders: totalOrderIds.length,
            pendingOrders: pendingLineIds,
            processingOrders: processingLineIds,
            fulfilledOrders: fulfilledLineIds,
            totalUnits: totalUnitsRes._sum?.quantity || 0,
            fulfilledUnits: fulfilledUnitsRes._sum?.quantity || 0,
            amountFulfilled: amountFulfilledRes._sum?.lineTotal || 0,
            amountPaid: amountPaidRes._sum?.lineTotal || 0,
          };
        }
      } catch (e) {
        console.error('Failed to compute order stats fallback:', e)
      }
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
        totalOrders: stats.totalOrders,
        pendingOrders: stats.pendingOrders,
        processingOrders: stats.processingOrders,
        fulfilledOrders: stats.fulfilledOrders,
        totalUnits: stats.totalUnits,
        fulfilledUnits: stats.fulfilledUnits,
        amountFulfilled: stats.amountFulfilled,
        amountPaid: stats.amountPaid,
      },
    }

    return NextResponse.json(successResponse({ data: response }))
  } catch (error) {
    console.error('GET /api/departments/[code]/section error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section data'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}

