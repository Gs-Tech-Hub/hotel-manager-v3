import { NextRequest, NextResponse } from 'next/server'
import { extractUserContext } from '@/lib/user-context'
import { ErrorCodes, errorResponse, successResponse } from '@/lib/api-response'
import { DepartmentService } from '@/services/department.service'
import { prisma } from '@/lib/auth/prisma'
import { isGamesStaffForDepartment } from '@/lib/auth/games-access'

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
      const canAccessGames = await isGamesStaffForDepartment(ctx.userId, parentDept.id)
      if (!canAccessGames) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Games access is restricted to Games department users'),
          { status: 403 }
        )
      }
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
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true }
      },
      section: {
        select: { id: true, name: true }
      },
      service: {
        select: { id: true, name: true, pricingModel: true }
      },
    }
  })

  // Calculate game stats
  let totalGames = 0
  let completedGames = 0
  let pendingGames = 0
  let totalRevenue = 0
  let pendingRevenue = 0

  // Section summary: sessions + games played (sum of gameCount) + revenue
  const sectionSummaryMap = new Map<
    string,
    {
      sectionId: string
      sectionName: string
      sessions: number
      gamesPlayed: number
      completedSessions: number
      pendingSessions: number
      revenueCollected: number
      revenuePending: number
    }
  >()

  const paidGames: Array<{
    sessionId: string
    startedAt: Date | null
    endedAt: Date | null
    sectionId: string
    sectionName: string
    customerId: string | null
    customerName: string
    customerPhone: string | null
    serviceId: string | null
    serviceName: string
    gameCount: number
    orderId: string | null
    orderNumber: string | null
    subtotal: number
    tax: number
    total: number
    paymentStatus: string | null
  }> = []

  for (const session of gameSessions) {
    totalGames += 1

    const sectionId = session.sectionId
    const sectionName = session.section?.name || 'Unknown'
    if (!sectionSummaryMap.has(sectionId)) {
      sectionSummaryMap.set(sectionId, {
        sectionId,
        sectionName,
        sessions: 0,
        gamesPlayed: 0,
        completedSessions: 0,
        pendingSessions: 0,
        revenueCollected: 0,
        revenuePending: 0,
      })
    }
    const ss = sectionSummaryMap.get(sectionId)!
    ss.sessions += 1
    ss.gamesPlayed += Number((session as any).gameCount ?? 0)

    const isSessionClosed = (session as any).status === 'closed'

    if (session.orderHeader) {
      const orderTotal = Number(session.orderHeader.total) || 0
      const isPaid = (session as any).orderHeader?.paymentStatus === 'paid'

      if (isPaid && isSessionClosed) {
        completedGames += 1
        totalRevenue += orderTotal
        ss.completedSessions += 1
        ss.revenueCollected += orderTotal

        paidGames.push({
          sessionId: session.id,
          startedAt: (session as any).startedAt ?? null,
          endedAt: (session as any).endedAt ?? null,
          sectionId,
          sectionName,
          customerId: (session as any).customer?.id ?? null,
          customerName: (session as any).customer
            ? `${(session as any).customer.firstName || ''} ${(session as any).customer.lastName || ''}`.trim() || 'Guest'
            : 'Guest',
          customerPhone: (session as any).customer?.phone ?? null,
          serviceId: (session as any).service?.id ?? null,
          serviceName: (session as any).service?.name || sectionName,
          gameCount: Number((session as any).gameCount ?? 0),
          orderId: (session as any).orderHeader?.id ?? null,
          orderNumber: (session as any).orderHeader?.orderNumber ?? null,
          subtotal: Number((session as any).orderHeader?.subtotal ?? 0),
          tax: Number((session as any).orderHeader?.tax ?? 0),
          total: Number((session as any).orderHeader?.total ?? 0),
          paymentStatus: (session as any).orderHeader?.paymentStatus ?? null,
        })
      } else {
        pendingGames += 1
        pendingRevenue += orderTotal
        ss.pendingSessions += 1
        ss.revenuePending += orderTotal
      }
    } else {
      pendingGames += 1
      ss.pendingSessions += 1
    }
  }

  const stats = {
    totalGames,
    completedGames,
    pendingGames,
    totalRevenue,
    pendingRevenue,
    completionRate: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0,
    sectionSummary: Array.from(sectionSummaryMap.values()).sort((a, b) =>
      a.sectionName.localeCompare(b.sectionName)
    ),
    paidGames: paidGames.sort((a, b) => {
      const at = a.startedAt ? new Date(a.startedAt).getTime() : 0
      const bt = b.startedAt ? new Date(b.startedAt).getTime() : 0
      return bt - at
    }),
  }

  return NextResponse.json(successResponse({ data: { stats } }), { status: 200 })
}
