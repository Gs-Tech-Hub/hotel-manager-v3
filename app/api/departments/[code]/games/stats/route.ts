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

    // Total games played
    const totalGamesResult = await prisma.gameSession.aggregate({
      _sum: { gameCount: true },
      where: {
        ...baseWhere,
        checkedOutAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
    });

    // Total revenue - filtered by department
    const totalRevenueResult = await prisma.gameSession.aggregate({
      _sum: { totalAmount: true },
      where: {
        ...baseWhere,
        status: { in: ['completed', 'checked_out'] },
        checkedOutAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
    });

    // Active sessions
    const activeSessions = await prisma.gameSession.count({
      where: {
        ...baseWhere,
        status: 'active'
      },
    });

    // Total unique customers
    const totalCustomers = await prisma.gameSession.findMany({
      where: { ...baseWhere },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    // Revenue by game type (now by section, since section name is game type)
    const revenueBySectionId = await prisma.gameSession.groupBy({
      by: ['sectionId'],
      _sum: { totalAmount: true },
      _count: { id: true },
      where: {
        ...baseWhere,
        status: { in: ['completed', 'checked_out'] },
        checkedOutAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
    });

    // Get section names for display
    const sectionIds = revenueBySectionId.map(item => item.sectionId);
    const sections = await prisma.departmentSection.findMany({
      where: { id: { in: sectionIds } },
      select: { id: true, name: true },
    });

    const sectionMap = new Map(sections.map(s => [s.id, s.name]));

    const revenueByTypeWithNames = revenueBySectionId.map(item => ({
      gameType: sectionMap.get(item.sectionId) || 'Unknown',
      revenue: Number(item._sum.totalAmount || 0).toFixed(2),
      sessionCount: item._count.id,
    }));

    const stats = {
      totalGamesPlayed: totalGamesResult._sum.gameCount || 0,
      totalRevenue: Number(totalRevenueResult._sum.totalAmount || 0).toFixed(2),
      activeSessions,
      totalCustomers: totalCustomers.length,
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
