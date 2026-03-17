/**
 * POST /api/extras/transfer
 * Global extras transfer - transfer extras between ANY departments/sections
 * Extras start as global entities and can be transferred to departments
 * 
 * Body:
 * {
 *   "extraId": "string",
 *   "toDepartmentId": "string",
 *   "toSectionId": "string | null" (optional - if null, extra goes to department level)
 * }
 * 
 * Works exactly like services transfer - global to department allocation model
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
    
    // Check if user has permission to manage extras
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { extraId, toDepartmentId, toSectionId } = body;

    // Validation
    if (!extraId || !toDepartmentId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: extraId, toDepartmentId'),
        { status: 400 }
      );
    }

    // Get the extra to transfer
    const extra = await prisma.extra.findUnique({
      where: { id: extraId },
      include: { departmentExtras: true }
    });

    if (!extra) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Extra not found'),
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

      // Check if extra already exists in this section
      const existing = await prisma.departmentExtra.findFirst({
        where: {
          departmentId: toDepartmentId,
          sectionId: toSectionId,
          extraId
        }
      });

      if (existing) {
        return NextResponse.json(
          errorResponse(ErrorCodes.CONFLICT, 'Extra already allocated to this section'),
          { status: 409 }
        );
      }
    } else {
      // Check if extra already exists at department level
      const existing = await prisma.departmentExtra.findFirst({
        where: {
          departmentId: toDepartmentId,
          sectionId: null,
          extraId
        }
      });

      if (existing) {
        return NextResponse.json(
          errorResponse(ErrorCodes.CONFLICT, 'Extra already allocated to this department'),
          { status: 409 }
        );
      }
    }

    // Create or update the department extra allocation
    const existing = await prisma.departmentExtra.findFirst({
      where: {
        departmentId: toDepartmentId,
        sectionId: toSectionId || null,
        extraId
      }
    });

    let departmentExtra;
    if (existing) {
      departmentExtra = await prisma.departmentExtra.update({
        where: { id: existing.id },
        data: {
          updatedAt: new Date(),
        },
        include: {
          extra: true,
          department: true,
          section: true
        }
      });
    } else {
      departmentExtra = await prisma.departmentExtra.create({
        data: {
          extraId,
          departmentId: toDepartmentId,
          sectionId: toSectionId || null,
          quantity: 0, // Default quantity when allocated
        },
        include: {
          extra: true,
          department: true,
          section: true
        }
      });
    }

    return NextResponse.json(
      successResponse({
        data: { departmentExtra },
        message: toSection 
          ? `Extra "${extra.name}" transferred to section "${toSection.name}"`
          : `Extra "${extra.name}" transferred to department "${toDept.name}"`
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error transferring extra:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, `Transfer failed: ${message}`),
      { status: 500 }
    );
  }
}
