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
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    // Normalize code
    let lookupCode = code.toLowerCase()
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode)
        if (decoded === lookupCode) break
        lookupCode = decoded.toLowerCase()
      }
    } catch (e) {
      lookupCode = code.toLowerCase()
    }

    // Find the section or department
    const section = await (prisma as any).departmentSection.findFirst({
      where: { slug: lookupCode },
      include: { department: true }
    })

    if (!section) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Section not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      )
    }

    // Build date filter if provided
    const dateFilter = buildDateFilter(startDate, endDate)

    // Build query filter for orders in this section
    // Orders are linked via departmentCode like "DEPARTMENT:section"
    const departmentCode = section.department.code
    const sectionCode = section.slug || section.id
    const fullSectionCode = `${departmentCode}:${sectionCode}`

    const whereClause: any = {
      departmentCode: fullSectionCode,
    }

    if (dateFilter && Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter
    }

    // Fetch order stats for this section
    const [pendingOrders, cancelledOrders, completedOrders, totalOrders, amountSold] = await Promise.all([
      (prisma as any).orderHeader.count({
        where: {
          ...whereClause,
          status: 'pending'
        }
      }),
      (prisma as any).orderHeader.count({
        where: {
          ...whereClause,
          status: 'cancelled'
        }
      }),
      (prisma as any).orderHeader.count({
        where: {
          ...whereClause,
          status: 'completed'
        }
      }),
      (prisma as any).orderHeader.count({
        where: whereClause
      }),
      (prisma as any).orderHeader.aggregate({
        where: {
          ...whereClause,
          status: 'completed'
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
