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

    // Find order lines for this section, then get the distinct order headers
    const sectionLineWhere: any = {
      departmentCode: section.id, // departmentCode in orderLine contains the section ID
    }

    // Get distinct order header IDs that have lines in this section
    const sectionLines = await (prisma as any).orderLine.findMany({
      where: sectionLineWhere,
      distinct: ['orderHeaderId'],
      select: { orderHeaderId: true },
    })

    const orderHeaderIds = sectionLines.map((l: any) => l.orderHeaderId)

    // Build whereClause for orderHeader using the found header IDs and date filter
    const headerWhere: any = {
      id: { in: orderHeaderIds },
      ...dateFilter,
    }

    // Fetch order stats for this section
    const [pendingOrders, cancelledOrders, completedOrders, totalOrders, amountSold] = await Promise.all([
      (prisma as any).orderHeader.count({
        where: {
          ...headerWhere,
          status: 'pending'
        }
      }),
      (prisma as any).orderHeader.count({
        where: {
          ...headerWhere,
          status: 'cancelled'
        }
      }),
      (prisma as any).orderHeader.count({
        where: {
          ...headerWhere,
          status: 'fulfilled'
        }
      }),
      (prisma as any).orderHeader.count({
        where: headerWhere
      }),
      (prisma as any).orderHeader.aggregate({
        where: {
          ...headerWhere,
          status: 'fulfilled'
        },
        _sum: { total: true }
      })
    ])

    const stats = {
      pendingOrders,
      cancelledOrders,
      completedOrders,
      totalOrders,
      amountSold: amountSold._sum.total || 0,
      sectionCode: section.slug || section.id,
      sectionName: section.name,
      departmentCode: section.department.code
    }

    return NextResponse.json(successResponse({ data: stats }), { status: 200 })
  } catch (error) {
    console.error('GET /api/departments/[code]/section/stats error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section stats'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}
