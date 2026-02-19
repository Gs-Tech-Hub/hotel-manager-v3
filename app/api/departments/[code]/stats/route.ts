import { NextRequest, NextResponse } from 'next/server'
import { extractUserContext } from '@/lib/user-context'
import { ErrorCodes, errorResponse, successResponse } from '@/lib/api-response'
import { DepartmentService } from '@/services/department.service'
import { prisma } from '@/lib/auth/prisma'

const departmentService = new DepartmentService()

/**
 * GET /api/departments/[code]/stats
 * Calculate section stats for a given date range
 * Query params: fromDate, toDate (YYYY-MM-DD format)
 * If section code is in format "parent:section", calculates for that section
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const ctx = await extractUserContext(request)
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 })
    }

    const { code } = await params
    const decodedCode = decodeURIComponent(code)

    // Parse date query params
    const fromDate = request.nextUrl.searchParams.get('fromDate')
    const toDate = request.nextUrl.searchParams.get('toDate')

    if (!fromDate || !toDate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'fromDate and toDate query params required (YYYY-MM-DD format)'),
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Invalid date format. Use YYYY-MM-DD'),
        { status: 400 }
      )
    }

    // Check if section-scoped (format: "parent:section")
    const isSectionCode = decodedCode.includes(':')
    
    // Determine if this is a games department
    const parentCode = isSectionCode ? decodedCode.split(':')[0] : decodedCode
    const parentDept = await prisma.department.findFirst({
      where: { code: parentCode }
    })

    if (!parentDept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, `Department not found: ${parentCode}`),
        { status: 404 }
      )
    }

    // If games department, use game stats endpoint logic
    if (parentDept.type === 'games') {
      return getGameStats(decodedCode, isSectionCode, fromDate, toDate)
    }
    
    if (isSectionCode) {
      // Section code - extract parent and section ID
      const [parentCode, sectionId] = decodedCode.split(':')
      
      // Look up section by ID
      const section = await prisma.departmentSection.findFirst({
        where: {
          id: sectionId,
          department: { code: parentCode }
        },
        select: { id: true }
      })

      if (!section) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, `Section not found: ${decodedCode}`),
          { status: 404 }
        )
      }

      // Calculate stats for this section with date range
      const stats = await departmentService.recalculateSectionStats(
        parentCode,
        section.id, // Now passing the actual section ID
        fromDate,
        toDate
      )

      if (!stats) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, `Section stats not found for ${decodedCode}`),
          { status: 404 }
        )
      }

      return NextResponse.json(successResponse({ data: { stats } }), { status: 200 })
    } else {
      // Parent department code - calculate department stats
      const stats = await departmentService.recalculateSectionStats(
        decodedCode,
        undefined,
        fromDate,
        toDate
      )

      if (!stats) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, `Department stats not found for ${decodedCode}`),
          { status: 404 }
        )
      }

      return NextResponse.json(successResponse({ data: { stats } }), { status: 200 })
    }
  } catch (error) {
    console.error('Error fetching department stats:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to calculate stats'),
      { status: 500 }
    )
  }
}

/**
 * Calculate game statistics for a games department
 * Only counts completed/paid games vs pending unpaid games
 * Ignores fulfillment stats
 */
async function getGameStats(decodedCode: string, isSectionCode: boolean, fromDate: string, toDate: string) {
  const [parentCode, sectionIdPart] = isSectionCode ? decodedCode.split(':') : [decodedCode, undefined]
  
  // Convert date strings to Date objects
  const startDate = new Date(fromDate)
  const endDate = new Date(toDate)
  endDate.setHours(23, 59, 59, 999)

  const dateFilter = {
    gte: startDate,
    lte: endDate
  }

  const baseWhere: any = {
    section: { department: { code: parentCode } },
    createdAt: dateFilter
  }

  // If section-specific, filter by section ID
  if (isSectionCode && sectionIdPart) {
    baseWhere.sectionId = sectionIdPart
  }

  const gameSessions = await prisma.gameSession.findMany({
    where: baseWhere,
    include: {
      orderHeader: {
        include: {
          payments: true
        }
      },
      section: {
        select: { id: true, name: true }
      }
    }
  })

  // Calculate game stats
  let totalGames = 0
  let completedGames = 0
  let pendingGames = 0
  let totalRevenue = 0
  let pendingRevenue = 0

  for (const session of gameSessions) {
    totalGames += 1

    if (session.orderHeader) {
      const orderTotal = Number(session.orderHeader.total) || 0
      let totalPaid = 0
      if (session.orderHeader.payments && session.orderHeader.payments.length > 0) {
        totalPaid = session.orderHeader.payments.reduce((sum: number, p: any) => sum + Number(p.total ?? 0), 0)
      }
      const isPaid = totalPaid >= orderTotal && orderTotal > 0

      if (isPaid) {
        completedGames += 1
        totalRevenue += orderTotal
      } else {
        pendingGames += 1
        pendingRevenue += orderTotal
      }
    } else {
      pendingGames += 1
    }
  }

  const stats = {
    totalGames,
    completedGames,
    pendingGames,
    totalRevenue,
    pendingRevenue,
    completionRate: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0
  }

  return NextResponse.json(successResponse({ data: { stats } }), { status: 200 })
}
