import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * POST /api/services/create
 * Create a new service inventory (game, pool, gym, activity, etc.)
 * Can be section-scoped or department-wide
 * Requires: admin or department manager role
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      pricingModel, 
      pricePerCount, 
      pricePerMinute, 
      serviceType,
      sectionId, 
      departmentId,
      description 
    } = body;

    // Validate required fields
    if (!name || !pricingModel || !departmentId || !serviceType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields: name, pricingModel, departmentId, serviceType'),
        { status: 400 }
      );
    }

    // Validate pricing model
    if (!['per_count', 'per_time'].includes(pricingModel)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'pricingModel must be "per_count" or "per_time"'),
        { status: 400 }
      );
    }

    // Validate pricing values
    if (pricingModel === 'per_count' && (!pricePerCount || pricePerCount <= 0)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'pricePerCount required and must be > 0'),
        { status: 400 }
      );
    }

    if (pricingModel === 'per_time' && (!pricePerMinute || pricePerMinute <= 0)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'pricePerMinute required and must be > 0'),
        { status: 400 }
      );
    }

    // Verify department exists
    const dept = await prisma.department.findUnique({
      where: { id: departmentId }
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // If sectionId provided, verify it belongs to the department
    if (sectionId) {
      const section = await prisma.departmentSection.findFirst({
        where: {
          id: sectionId,
          departmentId: departmentId
        }
      });

      if (!section) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Section not found in this department'),
          { status: 404 }
        );
      }
    }

    // Check for duplicate name in same scope
    const existing = await prisma.serviceInventory.findFirst({
      where: {
        name: name,
        departmentId: departmentId,
        sectionId: sectionId || null
      }
    });

    if (existing) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.CONFLICT,
          sectionId 
            ? 'Service already exists in this section'
            : 'Service already exists in this department'
        ),
        { status: 409 }
      );
    }

    // Create service inventory
    const service = await prisma.serviceInventory.create({
      data: {
        name,
        serviceType,
        pricingModel,
        pricePerCount: pricingModel === 'per_count' ? pricePerCount : null,
        pricePerMinute: pricingModel === 'per_time' ? pricePerMinute : null,
        departmentId,
        sectionId: sectionId || null,
        description: description || null
      },
      include: {
        section: true,
        department: true
      }
    });

    return NextResponse.json(
      successResponse({
        data: {
          service: {
            id: service.id,
            name: service.name,
            pricingModel: service.pricingModel,
            pricePerCount: service.pricePerCount,
            pricePerMinute: service.pricePerMinute,
            scope: sectionId ? `section: ${service.section?.name}` : `department: ${service.department?.name}`,
            createdAt: service.createdAt
          }
        }
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Create service error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create service'),
      { status: 500 }
    );
  }
}
