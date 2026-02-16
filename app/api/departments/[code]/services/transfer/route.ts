/**
 * POST /api/departments/[code]/services/transfer
 * Transfer service inventory between sections within the same department
 * Follows the same pattern as inventory and extras transfers
 * 
 * Body:
 * {
 *   "serviceId": "string",
 *   "sourceSectionId": "string | null" (null = department level),
 *   "destinationSectionId": "string"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function POST(
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
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    
    // Check if user has permission to manage services
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { serviceId, sourceSectionId, destinationSectionId } = body;

    // Validation
    if (!serviceId || !destinationSectionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: serviceId and destinationSectionId'),
        { status: 400 }
      );
    }

    // Get department
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode },
      select: { id: true },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Verify destination section exists and belongs to this department
    const destSection = await prisma.departmentSection.findUnique({
      where: { id: destinationSectionId },
      select: { id: true, name: true, departmentId: true },
    });

    if (!destSection) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Destination section not found'),
        { status: 404 }
      );
    }

    if (destSection.departmentId !== dept.id) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Destination section does not belong to this department'),
        { status: 400 }
      );
    }

    // Get source section if specified
    let sourceSection: any = null;
    if (sourceSectionId) {
      sourceSection = await prisma.departmentSection.findUnique({
        where: { id: sourceSectionId },
        select: { id: true, name: true, departmentId: true },
      });

      if (!sourceSection) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Source section not found'),
          { status: 404 }
        );
      }

      if (sourceSection.departmentId !== dept.id) {
        return NextResponse.json(
          errorResponse(ErrorCodes.BAD_REQUEST, 'Source section does not belong to this department'),
          { status: 400 }
        );
      }
    }

    // Get service from source (department level if sourceSectionId is null)
    const service = await prisma.serviceInventory.findFirst({
      where: {
        id: serviceId,
        departmentId: dept.id,
        sectionId: sourceSectionId || null,
      },
      select: { id: true, name: true, sectionId: true },
    });

    if (!service) {
      const location = sourceSectionId ? `section ${sourceSectionId}` : 'department level';
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, `Service not found at ${location}`),
        { status: 404 }
      );
    }

    // Check if service already exists in destination section
    const existingService = await prisma.serviceInventory.findFirst({
      where: {
        id: serviceId,
        sectionId: destinationSectionId,
      },
    });

    if (existingService) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Service already exists in destination section'),
        { status: 409 }
      );
    }

    // Transfer service in transaction
    const updated = await prisma.serviceInventory.update({
      where: { id: serviceId },
      data: { sectionId: destinationSectionId },
      select: { id: true, name: true, sectionId: true, serviceType: true },
    });

    return NextResponse.json(
      successResponse({
        data: {
          message: 'Service transferred successfully',
          service: {
            id: updated.id,
            name: updated.name,
            serviceType: updated.serviceType,
            fromSection: sourceSection?.name || 'Department Level',
            toSection: destSection.name,
          },
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Service transfer error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to transfer service'),
      { status: 500 }
    );
  }
}
