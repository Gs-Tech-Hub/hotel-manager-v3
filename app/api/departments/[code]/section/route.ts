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
      // If this is a section, pass the full section code as sectionFilter
      let sectionFilterValue = null
      if (sectionRow && sectionRow.id) {
        // Extract parent code from lookupCode (format: parentCode:sectionId)
        const parts = lookupCode.split(':')
        if (parts.length >= 2) {
          const parentCode = parts[0]
          sectionFilterValue = `${parentCode}:${sectionRow.id}`
        }
      }
      
      products = await sectionService.getProducts({
        departmentCode: lookupCode,
        type: type || undefined,
        pageSize,
        includeDetails: true,
        sectionFilter: sectionFilterValue,
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
    // ALWAYS use date filters - default to TODAY if not provided
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

    // Import getTodayDate for default date handling
    const { getTodayDate } = await import('@/lib/date-filter');
    const today = getTodayDate();
    const effectiveFromDate = fromDate || today;
    const effectiveToDate = toDate || today;
    
    // Always compute fresh stats with date filter (default to TODAY)
    try {
      console.log(`[SECTION/STATS] DATE FILTER PATH - Computing stats for section: ${sectionRow?.id}, dept: ${dept.id}, dates: ${effectiveFromDate} to ${effectiveToDate}`)
      
      if (sectionRow && sectionRow.id) {
        // Section: find orders via orderLine.departmentSectionId (section ID field)
        const dateFilter = buildDateFilter(effectiveFromDate, effectiveToDate)
          
          // Get distinct order header IDs for this section (use departmentSectionId, not departmentCode)
          const sectionLines = await (prisma as any).orderLine.findMany({
            where: {
              departmentSectionId: sectionRow.id,
              orderHeader: {
                ...dateFilter,
                // Exclude cancelled and refunded orders
                status: { notIn: ['cancelled', 'refunded'] }
              }
            },
            distinct: ['orderHeaderId'],
            select: { orderHeaderId: true },
          })
          
          const orderHeaderIds = sectionLines.map((l: any) => l.orderHeaderId)
          console.log(`[SECTION/STATS] DATE FILTER - Found ${orderHeaderIds.length} orders with section lines`)
          
          // Build where clause for headers with date filter
          const headerWhere: any = {
            id: { in: orderHeaderIds },
            ...dateFilter,
            // Exclude cancelled and refunded orders
            status: { notIn: ['cancelled', 'refunded'] }
          }
          
          // Fetch all orders with ALL their lines (not filtered) to calculate section proportion
          const ordersForSection = await (prisma as any).orderHeader.findMany({
            where: headerWhere,
            include: {
              lines: true, // All lines for proportion calculation
              payments: true
            }
          })
          
          console.log(`[SECTION/STATS] DATE FILTER - Fetched ${ordersForSection.length} complete orders`)
          
          // Calculate section-proportional stats
          let totalPaid = 0
          let totalUnpaid = 0
          let pendingOrderCount = 0
          let fulfilledOrderCount = 0
          let paidFulfilledOrderCount = 0
          
          for (const order of ordersForSection) {
            // Find section lines in this order
            const sectionLines = order.lines.filter((l: any) => l.departmentSectionId === sectionRow.id)
            if (sectionLines.length === 0) continue
            
            // Calculate section's proportion
            const allLineTotal = order.lines.reduce((sum: number, l: any) => sum + (l.unitPrice * l.quantity), 0)
            const sectionLineTotal = sectionLines.reduce((sum: number, l: any) => sum + (l.unitPrice * l.quantity), 0)
            const sectionProportion = allLineTotal > 0 ? sectionLineTotal / allLineTotal : 0
            
            // Distribute order amounts proportionally
            const sectionDiscount = Math.round(sectionProportion * (order.discount || 0))
            const sectionTax = Math.round(sectionProportion * (order.tax || 0))
            // TAX NOT INCLUDED IN PAYMENT CALCULATION - tracked separately
            const sectionFinalAmount = Math.max(0, sectionLineTotal - sectionDiscount)
            
            // DEBUG: Log tax information
            console.log(`[SECTION/STATS] DATE FILTER - Order ${order.id} TAX: orderTax=${order.tax || 0}, sectionTax=${sectionTax}, discount=${sectionDiscount}`)
            
            // DEBUG: Log payment fields to see what's available
            if (order.payments && order.payments.length > 0) {
              console.log(`[SECTION/STATS] DATE FILTER - Order ${order.id} payments:`, JSON.stringify(order.payments[0], null, 2))
            } else {
              console.log(`[SECTION/STATS] DATE FILTER - Order ${order.id}: NO PAYMENTS FOUND`)
            }
            
            // Calculate section's payment share based on line proportion
            const totalOrderPaid = order.payments?.reduce((sum: any, p: any) => {
              const amt = p.amountPaid || p.amount || p.paymentAmount || 0
              return sum + amt
            }, 0) || 0
            
            // OPTION B: Simple proportional allocation
            const sectionPaymentAllocated = Math.round(sectionProportion * totalOrderPaid)
            
            console.log(`[SECTION/STATS] DATE FILTER - Order ${order.id}: section proportion=${sectionProportion.toFixed(2)}, lineTotal=${sectionLineTotal}, discount=${sectionDiscount}, tax=${sectionTax}, totalOrderPaid=${totalOrderPaid}, sectionPaymentAllocated=${sectionPaymentAllocated}, final=${sectionFinalAmount}`)
            
            // Track paid and unpaid amounts
            const sectionOwedAmount = Math.max(0, sectionFinalAmount - sectionPaymentAllocated)
            totalPaid += sectionPaymentAllocated
            totalUnpaid += sectionOwedAmount
            
            // Track order statuses
            if (order.status === 'pending') {
              pendingOrderCount++
            } else if (order.status === 'fulfilled') {
              fulfilledOrderCount++
              // Count as paid-fulfilled only if fully paid
              if (sectionPaymentAllocated >= sectionFinalAmount) {
                paidFulfilledOrderCount++
              }
            }
          }
          
          stats = {
            totalOrders: ordersForSection.length,
            pendingOrders: pendingOrderCount,
            processingOrders: 0,
            fulfilledOrders: fulfilledOrderCount,
            totalUnits: 0,
            fulfilledUnits: 0,
            amountFulfilled: totalPaid,  // Paid portion of fulfilled orders (matches service logic)
            amountPaid: totalPaid,
          }
          
          console.log(`[SECTION/STATS] DATE FILTER - FINAL STATS: totalPaid=${totalPaid}, totalUnpaid=${totalUnpaid}, fulfilled=${fulfilledOrderCount}, pending=${pendingOrderCount}, orders=${ordersForSection.length}`)
        }
      } catch (e) {
        console.error('Failed to compute order stats with date filter:', e)
      }

    // Prepare response with only needed data
    console.log(`[SECTION/STATS] RESPONSE - Returning stats: amountPaid=${stats.amountPaid}, amountFulfilled=${stats.amountFulfilled}, pendingOrders=${stats.pendingOrders}`)
    
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
        totalAmount: stats.amountPaid || 0,  // Alias for compatibility
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

