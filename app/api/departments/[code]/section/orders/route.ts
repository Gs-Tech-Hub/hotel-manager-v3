import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response'
import { buildDateFilter } from '@/lib/date-filter'
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context'

/**
 * GET /api/departments/[code]/section/orders
 * Get all orders for a specific section
 * Requires: staff, manager, or admin role
 * 
 * Query params:
 *   - status: optional filter (pending, processing, completed, cancelled)
 *   - page: page number (default 1)
 *   - limit: items per page (default 20, max 100)
 *   - startDate: optional ISO date string
 *   - endDate: optional ISO date string
 * 
 * Returns:
 * {
 *   orders: [...],
 *   pagination: { page, limit, total, pages }
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view section orders'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      )
    }

    const { code } = await params
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20'))
    const status = url.searchParams.get('status')
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

    // Find the section
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

    // Build date filter
    const dateFilter = buildDateFilter(startDate, endDate)

    // Build query filter for orders in this section
    const departmentCode = section.department.code
    const sectionCode = section.slug || section.id
    const fullSectionCode = `${departmentCode}:${sectionCode}`

    const whereClause: any = {
      departmentCode: fullSectionCode,
    }

    if (status) {
      whereClause.status = status
    }

    if (dateFilter && Object.keys(dateFilter).length > 0) {
      whereClause.createdAt = dateFilter
    }

    const skip = (page - 1) * limit

    // Fetch orders
    const [orders, total] = await Promise.all([
      (prisma as any).orderHeader.findMany({
        where: whereClause,
        include: {
          lines: {
            include: {
              fulfillments: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      (prisma as any).orderHeader.count({ where: whereClause })
    ])

    return NextResponse.json(
      successResponse({
        data: {
          orders,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      }),
      { status: 200 }
    )
  } catch (error) {
    console.error('GET /api/departments/[code]/section/orders error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch section orders'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    )
  }
}
