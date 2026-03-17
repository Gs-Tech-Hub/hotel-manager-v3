import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';
import { isGamesStaffForDepartment } from '@/lib/auth/games-access';

/**
 * GET /api/departments/[code]/games/stats
 * Get game statistics for this department (total games, revenue, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code } = await params;

    // Support section-style codes: "parent:section"
    const rawCode = code;
    let departmentCode = rawCode;
    let resolvedSectionId: string | undefined = undefined;

    if (rawCode.includes(':')) {
      const parts = rawCode.split(':');
      departmentCode = parts[0];
      const sectionSlugOrId = parts.slice(1).join(':');
      const parentDept = await prisma.department.findFirst({ where: { code: departmentCode } });
      if (parentDept) {
        const section = await prisma.departmentSection.findFirst({
          where: {
            departmentId: parentDept.id,
            OR: [ { slug: sectionSlugOrId }, { id: sectionSlugOrId } ]
          }
        });
        if (section) resolvedSectionId = section.id;
      }
    }

    const department = await prisma.department.findFirst({
      where: { code: departmentCode },
    });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Games access is department-scoped: only games_staff for this department
    const canAccessGames = await isGamesStaffForDepartment(ctx.userId, department.id);
    if (!canAccessGames) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Games access is restricted to Games department users'),
        { status: 403 }
      );
    }

    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    const dateFilter: any = {};
    
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Build base where clause - filter by section if resolved, otherwise by department
    const baseWhere: any = {};
    if (resolvedSectionId) {
      baseWhere.sectionId = resolvedSectionId;
    } else {
      baseWhere.gameType = { departmentId: department.id };
    }

    // Get all game sessions for this department with their associated orders
    const gameSessions = await prisma.gameSession.findMany({
      where: {
        ...baseWhere,
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      include: {
        orderHeader: {
          include: {
            payments: true,
          },
        },
        section: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate stats from game sessions and their orders
    // IMPORTANT: totalGames counts the actual number of games played (gameCount), not sessions
    // This corresponds to payment as each game is a billable unit
    let totalGames = 0;
    let completedGames = 0; // Sum of gameCount from closed sessions that are paid
    let pendingGames = 0; // Sum of gameCount from active sessions or unpaid sessions
    let totalRevenue = 0; // Paid revenue (cents)
    let pendingRevenue = 0; // Unpaid revenue (cents)
    const revenueBySectionMap = new Map<string, { name: string; revenue: number; gamesCount: number; sessionCount: number }>();

    for (const session of gameSessions) {
      // Count actual games played (crucial for payment accuracy)
      const gamesInSession = session.gameCount || 1;
      totalGames += gamesInSession;

      // Track revenue and game count by section
      const sectionKey = session.sectionId;
      const sectionName = session.section?.name || 'Unknown';
      if (!revenueBySectionMap.has(sectionKey)) {
        revenueBySectionMap.set(sectionKey, { name: sectionName, revenue: 0, gamesCount: 0, sessionCount: 0 });
      }
      const sectionStats = revenueBySectionMap.get(sectionKey)!;
      sectionStats.gamesCount += gamesInSession;
      sectionStats.sessionCount += 1;

      // Only count as completed if session is closed AND paid
      // Otherwise count as pending (active sessions or unpaid sessions)
      const isSessionClosed = session.status === 'closed';

      if (session.orderHeader && isSessionClosed) {
        const orderTotal = Number(session.orderHeader.total) || 0;
        let totalPaid = 0;
        if (session.orderHeader.payments && session.orderHeader.payments.length > 0) {
          totalPaid = session.orderHeader.payments.reduce((sum: number, p: any) => sum + Number(p.amount ?? 0), 0);
        }
        const isPaid = totalPaid >= orderTotal && orderTotal > 0;

        if (isPaid) {
          // Count actual games played in this session
          completedGames += gamesInSession;
          totalRevenue += orderTotal;
          sectionStats.revenue += orderTotal;
        } else {
          // Closed but unpaid - still pending payment
          pendingGames += gamesInSession;
          pendingRevenue += orderTotal;
        }
      } else {
        // Active session or session without order
        pendingGames += gamesInSession;
        if (session.orderHeader) {
          const orderTotal = Number(session.orderHeader.total) || 0;
          pendingRevenue += orderTotal;
        }
      }
    }

    const revenueByTypeWithNames = Array.from(revenueBySectionMap.values()).map(item => ({
      gameType: item.name,
      revenue: item.revenue, // in cents
      sessionCount: item.sessionCount,
      gamesCount: item.gamesCount, // Actual games played
    }));

    const stats = {
      totalGames, // Total games played (sum of gameCount across all sessions)
      completedGames, // Games from closed sessions that are fully paid
      pendingGames, // Games from active sessions or unpaid sessions
      totalRevenue, // Revenue from paid games (cents)
      pendingRevenue, // Revenue pending from active/unpaid games (cents)
      completionRate: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0, // Percentage of games fully completed and paid
      revenueByType: revenueByTypeWithNames,
    };

    return NextResponse.json(
      successResponse({ data: { stats, department: { id: department.id, code: department.code }, sectionId: resolvedSectionId } }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching game stats:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch game statistics'),
      { status: 500 }
    );
  }
}
