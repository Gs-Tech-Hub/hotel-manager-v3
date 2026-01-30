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

    // Build date filter
    const dateFilter = buildDateFilter(startDate, endDate)

    // Find order lines for this section to get the order header IDs
    const sectionLineWhere: any = {
      departmentCode: section.id, // departmentCode in orderLine contains the section ID
    }

    if (status) {
      sectionLineWhere.status = status
    }

    // Get distinct order header IDs from order lines in this section
    const sectionLines = await (prisma as any).orderLine.findMany({
      where: sectionLineWhere,
      distinct: ['orderHeaderId'],
      select: { orderHeaderId: true },
      orderBy: { createdAt: 'desc' }
    })

    const orderHeaderIds = sectionLines.map((l: any) => l.orderHeaderId)
    const total = orderHeaderIds.length

    // Apply pagination
    const skip = (page - 1) * limit
    const paginatedIds = orderHeaderIds.slice(skip, skip + limit)

    // Build where clause for headers with date filter
    const headerWhere: any = {
      id: { in: paginatedIds },
      ...dateFilter,
    }

    // Fetch orders
    const orders = paginatedIds.length > 0
      ? await (prisma as any).orderHeader.findMany({
          where: headerWhere,
          include: {
            lines: {
              where: { departmentCode: section.id },
              include: {
                fulfillments: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      : []

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
