/**
 * POST /api/services/transfer
 * Global service transfer - transfer service between ANY departments/sections
 * Services start as global entities and can be transferred to departments
 * 
 * Body:
 * {
 *   "serviceId": "string",
 *   "toDepartmentId": "string",
 *   "toSectionId": "string | null" (optional - if null, service goes to department level)
 * }
 * 
 * Replaces: /api/services/transfer-services and /api/departments/[code]/services/transfer
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    
    // Check if user has permission to manage services
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { serviceId, toDepartmentId, toSectionId } = body;

    // Validation
    if (!serviceId || !toDepartmentId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: serviceId, toDepartmentId'),
        { status: 400 }
      );
    }

    // Get the service to transfer
    const service = await prisma.serviceInventory.findUnique({
      where: { id: serviceId },
      include: { department: true, section: true }
    });

    if (!service) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Service not found'),
        { status: 404 }
      );
    }

    // Verify destination department exists
    const toDept = await prisma.department.findUnique({
      where: { id: toDepartmentId },
      select: { id: true, name: true, code: true }
    });

    if (!toDept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Destination department not found'),
        { status: 404 }
      );
    }

    // If toSectionId provided, verify it exists and belongs to the destination department
    let toSection: any = null;
    if (toSectionId) {
      toSection = await prisma.departmentSection.findUnique({
        where: { id: toSectionId },
        select: { id: true, name: true, departmentId: true }
      });

      if (!toSection) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Destination section not found'),
          { status: 404 }
        );
      }

      if (toSection.departmentId !== toDepartmentId) {
        return NextResponse.json(
          errorResponse(ErrorCodes.BAD_REQUEST, 'Section does not belong to the destination department'),
          { status: 400 }
        );
      }

      // Check if service already exists in this section
      const existing = await prisma.serviceInventory.findFirst({
        where: {
          name: service.name,
          departmentId: toDepartmentId,
          sectionId: toSectionId
        }
      });

      if (existing) {
        return NextResponse.json(
          errorResponse(ErrorCodes.CONFLICT, 'Service already exists in this section'),
          { status: 409 }
        );
      }
    } else {
      // Check if service already exists at department level
      const existing = await prisma.serviceInventory.findFirst({
        where: {
          name: service.name,
          departmentId: toDepartmentId,
          sectionId: null
        }
      });

      if (existing) {
        return NextResponse.json(
          errorResponse(ErrorCodes.CONFLICT, 'Service already exists at this department level'),
          { status: 409 }
        );
      }
    }

    // Transfer the service
    const updated = await prisma.serviceInventory.update({
      where: { id: serviceId },
      data: {
        departmentId: toDepartmentId,
        sectionId: toSectionId || null
      },
      include: { department: true, section: true }
    });

    // Determine source location
    let sourceLocation = 'Global';
    if (service.departmentId) {
      sourceLocation = service.sectionId 
        ? `Section: ${service.section?.name}`
        : `Department: ${service.department?.name}`;
    }

    // Determine destination location
    const destLocation = toSection 
      ? `Section: ${toSection.name}`
      : `Department: ${toDept.name}`;

    return NextResponse.json(
      successResponse({
        data: {
          message: 'Service transferred successfully',
          transfer: {
            serviceId: updated.id,
            serviceName: updated.name,
            from: sourceLocation,
            to: destLocation,
            type: 'service_transfer'
          }
        }
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
