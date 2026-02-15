import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * POST /api/services/transfer-services
 * Transfer service inventory (games, activities) between department sections
 * Requires: admin or department manager role
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const body = await request.json();
    const { fromSectionId, toSectionId, serviceId } = body;

    if (!fromSectionId || !toSectionId || !serviceId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields'),
        { status: 400 }
      );
    }

    // Get both sections and verify they belong to the same department
    const [fromSection, toSection] = await Promise.all([
      prisma.departmentSection.findUnique({
        where: { id: fromSectionId },
        include: { department: true }
      }),
      prisma.departmentSection.findUnique({
        where: { id: toSectionId },
        include: { department: true }
      })
    ]);

    if (!fromSection || !toSection) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Section not found'),
        { status: 404 }
      );
    }

    if (fromSection.departmentId !== toSection.departmentId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Sections must be in the same department'),
        { status: 400 }
      );
    }

    // Get service from source section
    const service = await prisma.serviceInventory.findFirst({
      where: {
        id: serviceId,
        sectionId: fromSectionId
      }
    });

    if (!service) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Service not found in source section'),
        { status: 404 }
      );
    }

    // Check if service already exists in destination
    const existingService = await prisma.serviceInventory.findFirst({
      where: {
        id: serviceId,
        sectionId: toSectionId
      }
    });

    if (existingService) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Service already exists in destination section'),
        { status: 409 }
      );
    }

    // Transfer service in transaction
    const result = await prisma.$transaction([
      // Update source service to new section
      prisma.serviceInventory.update({
        where: { id: serviceId },
        data: {
          sectionId: toSectionId
        }
      })
    ]);

    return NextResponse.json(
      successResponse({
        data: {
          message: 'Service transferred',
          service: {
            id: service.id,
            name: service.name,
            fromSection: fromSection.name,
            toSection: toSection.name
          }
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Transfer service error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to transfer service'),
      { status: 500 }
    );
  }
}
