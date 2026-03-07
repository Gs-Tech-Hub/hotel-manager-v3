/**
 * POST /api/departments/[code]/services/transfer
 * Transfer service inventory between sections within the same department
 * Supports two patterns:
 * 
 * 1. Direct Transfer (for section-to-section moves):
 *    Body: { serviceId, sourceSectionId, destinationSectionId }
 * 
 * 2. Received Flow (for receiving services from other departments):
 *    Body: { serviceId, destinationSectionId } (only - auto-discovers source)
 *    Used when auto-discovering where service currently exists
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
      select: { id: true, name: true, code: true },
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

    // Get source section if specified (direct transfer mode)
    let sourceSection: any = null;
    let sourceLocation = 'Unknown';
    
    if (sourceSectionId) {
      // Direct transfer within same department
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

      sourceLocation = sourceSection.name;
    } else {
      // Received flow: auto-discover where service currently exists
      // Service can be at global level or in any other department
      const service = await prisma.serviceInventory.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          departmentId: true,
          sectionId: true,
          department: { select: { name: true } },
          section: { select: { name: true } }
        }
      });

      if (!service) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Service not found'),
          { status: 404 }
        );
      }

      if (service.departmentId === null) {
        sourceLocation = 'Global';
      } else if (service.sectionId) {
        sourceLocation = `Section: ${service.section?.name} (${service.department?.name})`;
      } else {
        sourceLocation = `Department: ${service.department?.name}`;
      }
    }

    // Get the service
    const service = await prisma.serviceInventory.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, sectionId: true, departmentId: true },
    });

    if (!service) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Service not found'),
        { status: 404 }
      );
    }

    // For direct transfer, verify service exists in source location
    if (sourceSectionId && service.sectionId !== sourceSectionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Service not found at specified source location'),
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
      data: { 
        departmentId: dept.id,
        sectionId: destinationSectionId 
      },
      select: { id: true, name: true, sectionId: true, serviceType: true },
    });

    return NextResponse.json(
      successResponse({
        data: {
          message: 'Service transferred successfully',
          transfer: {
            serviceId: updated.id,
            serviceName: updated.name,
            serviceType: updated.serviceType,
            from: sourceLocation,
            to: destSection.name,
            receivedAt: new Date().toISOString(),
            type: 'received'
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
