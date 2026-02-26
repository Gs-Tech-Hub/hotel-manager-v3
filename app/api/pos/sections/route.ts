import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * GET /api/pos/sections
 * List all available POS sections (sections with hasTerminal = true)
 * Includes today's sales summary for each section
 * 
 * Query Parameters:
 * - departmentId: Filter by department ID (optional)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await extractUserContext(req);
    
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get('departmentId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '50'));
    const skip = (page - 1) * limit;

    // Build where clause: only get sections with hasTerminal = true
    const where: any = {
      isActive: true,
      hasTerminal: true,
    };

    if (departmentId) {
      where.departmentId = departmentId;
    }

    // Fetch POS-enabled sections
    const sections = await prisma.departmentSection.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        departmentId: true,
        hasTerminal: true,
        isActive: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.departmentSection.count({ where });

    // Enhance each section with today's sales summary
    const data = await Promise.all(
      sections.map(async (section) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Build the section identifier
        const sectionIdentifier = section.slug || section.id;
        const fullDepartmentCode = `${section.department.code}:${sectionIdentifier}`;

        // Query orders using the full department code
        const orders = await prisma.orderHeader.findMany({
          where: {
            departmentCode: fullDepartmentCode,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });

        const salesTotal = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
        const count = orders.length;

        return {
          id: section.id,
          name: section.name,
          slug: section.slug,
          departmentId: section.departmentId,
          departmentCode: section.department.code,
          sectionCode: sectionIdentifier,
          departmentName: section.department.name,
          isActive: section.isActive,
          hasTerminal: section.hasTerminal,
          today: { count, total: salesTotal },
        };
      })
    );

    return NextResponse.json(
      successResponse({
        data: { sections: data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching POS sections:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch POS sections'),
      { status: 500 }
    );
  }
}
