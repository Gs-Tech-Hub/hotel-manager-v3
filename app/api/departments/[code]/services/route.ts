/**
 * GET /api/departments/[code]/services
 * Fetch all services for a department
 * 
 * Query parameters:
 * - level: "all" | "department" | "section" (default: "all")
 *   - "all": services at both department and section levels
 *   - "department": only department-level services (sectionId is null)
 *   - "section": only section-assigned services
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const { code: departmentCode } = await params;
    const level = request.nextUrl.searchParams.get('level') || 'all'; // all, department, section

    // Get department
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode },
      select: { id: true, name: true, code: true },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Build where clause based on level filter
    const whereClause: any = { departmentId: dept.id };
    
    if (level === 'department') {
      // Only department-level services (no section assigned)
      whereClause.sectionId = null;
    } else if (level === 'section') {
      // Only section-assigned services
      whereClause.sectionId = { not: null };
    }
    // level === 'all': no additional filter

    // Fetch services
    const services = await prisma.serviceInventory.findMany({
      where: whereClause,
      include: {
        section: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { sectionId: 'asc' }, // Department-level first (null sorts first)
        { name: 'asc' },
      ],
    });

    return NextResponse.json(
      successResponse({
        data: {
          department: {
            id: dept.id,
            name: dept.name,
            code: dept.code,
          },
          level,
          services: services.map(s => ({
            id: s.id,
            name: s.name,
            serviceType: s.serviceType,
            pricingModel: s.pricingModel,
            pricePerCount: s.pricePerCount,
            pricePerMinute: s.pricePerMinute,
            description: s.description,
            sectionId: s.sectionId,
            section: s.section ? {
              id: s.section.id,
              name: s.section.name,
            } : null,
            isActive: s.isActive,
          })),
          count: services.length,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get department services error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch services'),
      { status: 500 }
    );
  }
}
