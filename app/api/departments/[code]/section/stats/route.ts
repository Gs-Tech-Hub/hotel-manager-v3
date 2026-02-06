import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { buildDateFilter } from '@/lib/date-filter'
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context'

/**
 * GET /api/departments/[code]/section/stats
 * Get section order statistics (pending, cancelled, amount sold)
 * Requires: staff, manager, or admin role
 * 
 * Query params:
 *   - startDate: optional ISO date string
 *   - endDate: optional ISO date string
 * 
 * Returns:
 * {
 *   pendingOrders: number,
 *   cancelledOrders: number,
 *   completedOrders: number,
 *   amountSold: number (in cents),
 *   totalOrders: number
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Check authentication
    const ctx = await extractUserContext(request)
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      )
    }

    // Check authorization
    const userWithRoles = await loadUserWithRoles(ctx.userId)
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view section stats'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      )
    }

    const { code } = await params
    const url = new URL(request.url)
    const fromDate = url.searchParams.get('fromDate')
    const toDate = url.searchParams.get('toDate')

    // Normalize and parse code (format: department:sectionId)
    let decodedCode = code
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(decodedCode)
        if (decoded === decodedCode) break
        decodedCode = decoded
      }
    } catch (e) {
      decodedCode = code
    }

    // Split by colon to get department and section parts
    const [deptCode, sectionId] = decodedCode.split(':')
    
    if (!deptCode || !sectionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid section code format. Expected department:sectionId'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      )
    }

    // Find the section by ID and verify it belongs to the department
    const section = await (prisma as any).departmentSection.findFirst({
      where: { 
        id: sectionId,
        department: { code: deptCode }
      },
      include: { department: true }
    })

    if (!section) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Section not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    // Build date filter if provided
    const dateFilter = buildDateFilter(fromDate, toDate)

    // Get all orders with lines in this section to recalculate if needed
    const sectionOrders = await (prisma as any).orderHeader.findMany({
      where: {
        lines: {
          some: { departmentSectionId: section.id }
        },
        ...dateFilter
      },
      include: {
        payments: true,
        extras: true, // Include extras so we can verify total calculation
        lines: { where: { departmentSectionId: section.id } }
      }
    })

    // Calculate CURRENT stats from actual order data (this is the source of truth)
    let totalPaidAmount = 0
    let totalUnpaidAmount = 0
    let paidOrderCount = 0
    let unpaidOrderCount = 0
    let paidPendingOrders = 0
    let paidProcessingOrders = 0
    let paidFulfilledOrders = 0
    let unpaidPendingOrders = 0
    let unpaidProcessingOrders = 0
    let unpaidFulfilledOrders = 0
    let paidTotalUnits = 0
    let unpaidTotalUnits = 0
    let paidFulfilledUnits = 0
    let unpaidFulfilledUnits = 0

    for (const order of sectionOrders) {
      // Use persisted order.total (should include extras if properly updated)
      const orderTotal = order.total || 0
      
      // Calculate paid/owed for this order using persisted total
      const orderPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
      const orderOwed = Math.max(0, orderTotal - orderPaid)
      
      // Determine payment status based on actual paid amount
      const isPaid = orderPaid >= orderTotal && orderTotal > 0
      const isUnpaid = orderPaid === 0

      // Count units in order lines for this section
      const orderUnits = order.lines.reduce((sum: any, line: any) => sum + line.quantity, 0)

      if (isPaid) {
        totalPaidAmount += order.total
        paidOrderCount += 1
        
        if (order.status === 'pending') paidPendingOrders += 1
        if (order.status === 'processing') paidProcessingOrders += 1
        if (order.status === 'fulfilled') paidFulfilledOrders += 1
        
        paidTotalUnits += orderUnits
        if (order.status === 'fulfilled') paidFulfilledUnits += orderUnits
      }

      if (isUnpaid) {
        totalUnpaidAmount += order.total
        unpaidOrderCount += 1
        
        if (order.status === 'pending') unpaidPendingOrders += 1
        if (order.status === 'processing') unpaidProcessingOrders += 1
        if (order.status === 'fulfilled') unpaidFulfilledOrders += 1
        
        unpaidTotalUnits += orderUnits
        if (order.status === 'fulfilled') unpaidFulfilledUnits += orderUnits
      }
    }

    // Return stats matching the structure we store in sectionStats
    const stats = {
      unpaid: {
        totalOrders: unpaidOrderCount,
        pendingOrders: unpaidPendingOrders,
        processingOrders: unpaidProcessingOrders,
        fulfilledOrders: unpaidFulfilledOrders,
        totalUnits: unpaidTotalUnits,
        fulfilledUnits: unpaidFulfilledUnits,
        totalAmount: totalUnpaidAmount,
        fulfillmentRate: unpaidTotalUnits > 0 ? Math.round((unpaidFulfilledUnits / unpaidTotalUnits) * 100) : 0,
        updatedAt: new Date()
      },
      paid: {
        totalOrders: paidOrderCount,
        pendingOrders: paidPendingOrders,
        processingOrders: paidProcessingOrders,
        fulfilledOrders: paidFulfilledOrders,
        totalUnits: paidTotalUnits,
        amountFulfilled: sectionOrders
          .filter((o: any) => {
            const paid = o.payments.reduce((s: number, p: any) => s + p.amount, 0)
            return paid >= o.total && o.status === 'fulfilled'
          })
          .reduce((sum: number, o: any) => sum + o.total, 0),
        fulfillmentRate: paidTotalUnits > 0 ? Math.round((paidFulfilledUnits / paidTotalUnits) * 100) : 0,
        updatedAt: new Date()
      },
      aggregated: {
        totalOrders: unpaidOrderCount + paidOrderCount,
        totalPending: unpaidPendingOrders + paidPendingOrders,
        totalProcessing: unpaidProcessingOrders + paidProcessingOrders,
        totalFulfilled: unpaidFulfilledOrders + paidFulfilledOrders,
        totalUnits: unpaidTotalUnits + paidTotalUnits,
        totalFulfilledUnits: unpaidFulfilledUnits + paidFulfilledUnits,
        totalAmount: totalUnpaidAmount + totalPaidAmount,
        updatedAt: new Date()
      },
      updatedAt: new Date()
    }

    return NextResponse.json(successResponse({ data: { stats } }), { status: 200 })
  } catch (error) {
    console.error('GET /api/departments/[code]/section/stats error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section stats'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}
