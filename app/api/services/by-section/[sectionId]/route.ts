import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * GET /api/services/by-section/[sectionId]
 * Get all services available in a section
 * Includes both section-scoped and department-wide services
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const { sectionId } = await params;

    // Get section with department
    const section = await prisma.departmentSection.findUnique({
      where: { id: sectionId },
      include: { department: true }
    });

    if (!section) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Section not found'),
        { status: 404 }
      );
    }

    // Get services: section-scoped first, then department-wide
    const services = await prisma.serviceInventory.findMany({
      where: {
        departmentId: section.departmentId,
        OR: [
          { sectionId: sectionId },      // Section-specific
          { sectionId: null }              // Department-wide (shared)
        ]
      },
      orderBy: [
        { sectionId: 'desc' },  // Section-scoped first
        { name: 'asc' }          // Then alphabetical
      ]
    });

    return NextResponse.json(
      successResponse({
        data: {
          section: {
            id: section.id,
            name: section.name,
            department: section.department.code
          },
          services: services.map(s => ({
            id: s.id,
            name: s.name,
            pricingModel: s.pricingModel,
            pricePerCount: s.pricePerCount,
            pricePerMinute: s.pricePerMinute,
            scope: s.sectionId ? 'section' : 'department'
          })),
          count: services.length
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get services by section error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch services'),
      { status: 500 }
    );
  }
}
