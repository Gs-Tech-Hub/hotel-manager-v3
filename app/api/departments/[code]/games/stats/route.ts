import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

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
        order: {
          include: {
            payment: true,
          },
        },
        section: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate stats from game sessions and their orders
    let totalGames = 0;
    let completedGames = 0; // Paid games
    let pendingGames = 0; // Unpaid games
    let totalRevenue = 0; // Paid revenue (cents)
    let pendingRevenue = 0; // Unpaid revenue (cents)
    const revenueBySectionMap = new Map<string, { name: string; revenue: number; count: number }>();

    for (const session of gameSessions) {
      totalGames += 1;

      // Track revenue by section
      const sectionKey = session.sectionId;
      const sectionName = session.section?.name || 'Unknown';
      if (!revenueBySectionMap.has(sectionKey)) {
        revenueBySectionMap.set(sectionKey, { name: sectionName, revenue: 0, count: 0 });
      }
      const sectionStats = revenueBySectionMap.get(sectionKey)!;
      sectionStats.count += 1;

      if (session.order) {
        const orderTotal = Number(session.order.total) || 0;
        let totalPaid = 0;
        if (session.order.payment) {
          totalPaid = Array.isArray(session.order.payment) 
            ? (session.order.payment).reduce((sum: number, p: any) => sum + Number(p.totalPrice ?? 0), 0)
            : Number(session.order.payment.totalPrice ?? 0);
        }
        const isPaid = totalPaid >= orderTotal && orderTotal > 0;

        if (isPaid) {
          completedGames += 1;
          totalRevenue += orderTotal;
          sectionStats.revenue += orderTotal;
        } else {
          pendingGames += 1;
          pendingRevenue += orderTotal;
        }
      } else {
        // Game session without order (shouldn't happen with new flow)
        pendingGames += 1;
      }
    }

    const revenueByTypeWithNames = Array.from(revenueBySectionMap.values()).map(item => ({
      gameType: item.name,
      revenue: item.revenue, // in cents
      sessionCount: item.count,
    }));

    const stats = {
      totalGames, // Total game sessions/orders created
      completedGames, // Paid games (orders with full payment)
      pendingGames, // Unpaid games (orders without full payment)
      totalRevenue, // Revenue from paid games (cents)
      pendingRevenue, // Revenue pending from unpaid games (cents)
      completionRate: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0, // Percentage of games paid
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
