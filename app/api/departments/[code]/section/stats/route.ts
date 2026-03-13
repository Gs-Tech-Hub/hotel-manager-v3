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
    console.log(`[DEDICATED SECTION/STATS] Section: ${section.id} (${section.name}), dept: ${deptCode}, dates: ${fromDate} to ${toDate}`)

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
        extras: true,
        lines: true // Get ALL lines to calculate proportions
      }
    })

    // Calculate SECTION-SPECIFIC stats (not full order totals)
    let totalPaidAmount = 0
    let totalUnpaidAmount = 0
    let cashAmount = 0
    let cardAmount = 0
    let bankAmount = 0
    let chargesAmount = 0
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

    console.log(`[DEDICATED SECTION/STATS] Processing ${sectionOrders.length} orders`)

    for (const order of sectionOrders) {
      // Calculate section's portion of the order
      const sectionLines = order.lines?.filter((l: any) => l.departmentSectionId === section.id) || []
      const allLines = order.lines || []
      
      // Section's line subtotal (before discount/tax)
      const sectionLineTotal = sectionLines.reduce((sum: number, l: any) => sum + (l.lineTotal || 0), 0)
      const allLineTotal = allLines.reduce((sum: number, l: any) => sum + (l.lineTotal || 0), 0)
      
      // If section has no lines in this order, skip it
      if (sectionLineTotal === 0 || allLineTotal === 0) {
        console.log(`[DEDICATED SECTION/STATS] Order ${order.id}: skipped (sectionLineTotal=${sectionLineTotal}, allLineTotal=${allLineTotal})`)
        continue
      }
      
      // Calculate section's proportion of discount and tax
      const sectionProportion = sectionLineTotal / allLineTotal
      const sectionDiscount = Math.round((order.discountTotal || 0) * sectionProportion)
      const sectionTax = Math.round((order.tax || 0) * sectionProportion)
      
      // Section's final amount = line items - discount (TAX NOT INCLUDED IN PAYMENT CALCULATION - tracked separately)
      const sectionFinalAmount = Math.max(0, sectionLineTotal - sectionDiscount)
      
      // DEBUG: Log payment fields to find the correct amount field
      if (order.payments && order.payments.length > 0) {
        console.log(`[DEDICATED SECTION/STATS] Order ${order.id} payments:`, JSON.stringify(order.payments[0], null, 2))
      } else {
        console.log(`[DEDICATED SECTION/STATS] Order ${order.id}: NO PAYMENTS FOUND`)
      }
      
      // Calculate section's proportion of payment collected - OPTION B: Simple proportional allocation
      const totalOrderPaid = order.payments.reduce((sum: number, p: any) => {
        const amt = p.amountPaid || p.amount || p.paymentAmount || 0
        return sum + amt
      }, 0)
      
      const sectionPaymentAllocated = Math.round(sectionProportion * totalOrderPaid)
      
      // Track payment method breakdown for paid section amount
      if (sectionPaymentAllocated > 0) {
        for (const payment of order.payments) {
          if (payment.paymentStatus === 'completed') {
            const paymentAmt = payment.amount || 0
            const sectionPaymentPortion = Math.round(sectionProportion * paymentAmt)
            
            if (payment.paymentMethod === 'cash') {
              cashAmount += sectionPaymentPortion
            } else if (payment.paymentMethod === 'card' || payment.paymentMethod === 'debit' || payment.paymentMethod === 'credit') {
              cardAmount += sectionPaymentPortion
            } else if (payment.paymentMethod === 'bank_transfer' || payment.paymentMethod === 'bank') {
              bankAmount += sectionPaymentPortion
            } else if (payment.paymentMethod === 'charges' || payment.paymentMethod === 'employee_charge') {
              chargesAmount += sectionPaymentPortion
            }
          }
        }
      }
      
      const sectionOwedAmount = Math.max(0, sectionFinalAmount - sectionPaymentAllocated)
      
      console.log(`[DEDICATED SECTION/STATS] Order ${order.id}: proportion=${sectionProportion.toFixed(2)}, lineTotal=${sectionLineTotal}, discount=${sectionDiscount}, tax=${sectionTax}, final=${sectionFinalAmount}, totalOrderPaid=${totalOrderPaid}, paid=${sectionPaymentAllocated}, owed=${sectionOwedAmount}`)

      // Determine payment status based on section's amount
      const isPaid = sectionPaymentAllocated >= sectionFinalAmount && sectionFinalAmount > 0
      const isUnpaid = sectionPaymentAllocated === 0
      const isPartial = !isPaid && !isUnpaid
      
      // Count units in this section only
      const sectionUnits = sectionLines.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0)
      const sectionFulfilledUnits = sectionLines.filter((l: any) => l.status === 'fulfilled')
        .reduce((sum: number, l: any) => sum + (l.quantity || 0), 0)

      if (isPaid) {
        totalPaidAmount += sectionFinalAmount
        paidOrderCount += 1
        
        if (order.status === 'pending') paidPendingOrders += 1
        if (order.status === 'processing') paidProcessingOrders += 1
        if (order.status === 'fulfilled') paidFulfilledOrders += 1
        
        paidTotalUnits += sectionUnits
        if (order.status === 'fulfilled') paidFulfilledUnits += sectionFulfilledUnits
      }

      if (isUnpaid) {
        totalUnpaidAmount += sectionFinalAmount
        unpaidOrderCount += 1
        
        if (order.status === 'pending') unpaidPendingOrders += 1
        if (order.status === 'processing') unpaidProcessingOrders += 1
        if (order.status === 'fulfilled') unpaidFulfilledOrders += 1
        
        unpaidTotalUnits += sectionUnits
        if (order.status === 'fulfilled') unpaidFulfilledUnits += sectionFulfilledUnits
      }

      if (isPartial) {
        // OPTION A: Amount-based allocation - split amounts but NOT order counts
        // This prevents double-counting when order is partially paid (e.g., discount applied)
        totalPaidAmount += sectionPaymentAllocated
        totalUnpaidAmount += sectionOwedAmount
        
        // Track units once (for fulfillment rate calculation)
        paidTotalUnits += sectionUnits
        unpaidTotalUnits += sectionUnits
        
        // Count status breakdowns in both buckets for rate calculation
        if (order.status === 'pending') {
          paidPendingOrders += 1
          unpaidPendingOrders += 1
        }
        if (order.status === 'processing') {
          paidProcessingOrders += 1
          unpaidProcessingOrders += 1
        }
        if (order.status === 'fulfilled') {
          paidFulfilledOrders += 1
          unpaidFulfilledOrders += 1
          paidFulfilledUnits += sectionFulfilledUnits
          unpaidFulfilledUnits += sectionFulfilledUnits
        }
        
        console.log(`[DEDICATED SECTION/STATS] PARTIAL: +${sectionPaymentAllocated} to paid, +${sectionOwedAmount} to unpaid (order NOT counted in either bucket)`)
      }
    }
    
    console.log(`[DEDICATED SECTION/STATS] FINAL TOTALS: paid=${totalPaidAmount}, unpaid=${totalUnpaidAmount}, paidOrders=${paidOrderCount}, unpaidOrders=${unpaidOrderCount}`)

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
            const sectionLines = o.lines?.filter((l: any) => l.departmentSectionId === section.id) || []
            const allLines = o.lines || []
            const sectionLineTotal = sectionLines.reduce((sum: number, l: any) => sum + (l.lineTotal || 0), 0)
            const allLineTotal = allLines.reduce((sum: number, l: any) => sum + (l.lineTotal || 0), 0)
            if (sectionLineTotal === 0 || allLineTotal === 0) return false
            
            const sectionProportion = sectionLineTotal / allLineTotal
            const sectionFinalAmount = Math.max(0, sectionLineTotal - Math.round((o.discountTotal || 0) * sectionProportion) + Math.round((o.tax || 0) * sectionProportion))
            const totalOrderPaid = o.payments.reduce((s: number, p: any) => s + p.amount, 0)
            const sectionPaymentAllocated = o.total > 0 
              ? Math.round((sectionFinalAmount / o.total) * totalOrderPaid)
              : 0
            
            return sectionPaymentAllocated >= sectionFinalAmount && o.status === 'fulfilled'
          })
          .reduce((sum: number, o: any) => {
            const sectionLines = o.lines?.filter((l: any) => l.departmentSectionId === section.id) || []
            const allLines = o.lines || []
            const sectionLineTotal = sectionLines.reduce((s: number, l: any) => s + (l.lineTotal || 0), 0)
            const allLineTotal = allLines.reduce((s: number, l: any) => s + (l.lineTotal || 0), 0)
            if (sectionLineTotal === 0 || allLineTotal === 0) return sum
            
            const sectionProportion = sectionLineTotal / allLineTotal
            const sectionFinalAmount = Math.max(0, sectionLineTotal - Math.round((o.discountTotal || 0) * sectionProportion) + Math.round((o.tax || 0) * sectionProportion))
            return sum + sectionFinalAmount
          }, 0),
        fulfillmentRate: paidTotalUnits > 0 ? Math.round((paidFulfilledUnits / paidTotalUnits) * 100) : 0,
        paymentMethods: {
          cash: cashAmount,
          card: cardAmount,
          bank: bankAmount,
          charges: chargesAmount,
        },
        updatedAt: new Date()
      },
      aggregated: {
        totalOrders: sectionOrders.length,  // Total UNIQUE orders (not paid + unpaid count)
        totalPending: unpaidPendingOrders + paidPendingOrders,
        totalProcessing: unpaidProcessingOrders + paidProcessingOrders,
        totalFulfilled: unpaidFulfilledOrders + paidFulfilledOrders,
        totalUnits: unpaidTotalUnits + paidTotalUnits,
        totalFulfilledUnits: unpaidFulfilledUnits + paidFulfilledUnits,
        totalAmount: totalUnpaidAmount + totalPaidAmount,
        totalByPaymentMethod: {
          cash: cashAmount,
          card: cardAmount,
          bank: bankAmount,
          charges: chargesAmount,
        },
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
