/**
 * GET /api/services/list
 * List all services (optionally filtered by scope)
 * Query parameters:
 *   - scope: 'global' | 'department' | 'section'
 *   - departmentId: filter by department
 *   - sectionId: filter by section
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope'); // 'global' | 'department' | 'section'
    const departmentId = searchParams.get('departmentId');
    const sectionId = searchParams.get('sectionId');

    // Build where clause based on filters
    const where: any = {};

    if (scope === 'global') {
      where.departmentId = null;
      where.sectionId = null;
    } else if (scope === 'department') {
      where.sectionId = null;
      if (departmentId) {
        where.departmentId = departmentId;
      } else {
        where.departmentId = { not: null };
      }
    } else if (scope === 'section') {
      where.sectionId = { not: null };
      if (sectionId) {
        where.sectionId = sectionId;
      }
      if (departmentId) {
        where.departmentId = departmentId;
      }
    } else {
      // No scope filter - return all services, optionally filtered by department/section
      if (departmentId) {
        where.departmentId = departmentId;
      }
      if (sectionId) {
        where.sectionId = sectionId;
      }
    }

    const services = await prisma.serviceInventory.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        section: { select: { id: true, name: true } }
      },
      orderBy: [{ name: 'asc' }]
    });

    return NextResponse.json(
      successResponse({
        data: {
          services: services.map(service => ({
            id: service.id,
            name: service.name,
            serviceType: service.serviceType,
            pricingModel: service.pricingModel,
            pricePerCount: service.pricePerCount,
            pricePerMinute: service.pricePerMinute,
            departmentId: service.departmentId,
            departmentName: service.department?.name,
            departmentCode: service.department?.code,
            sectionId: service.sectionId,
            sectionName: service.section?.name,
            scope: service.sectionId 
              ? 'section'
              : service.departmentId 
                ? 'department'
                : 'global',
            isActive: service.isActive,
            createdAt: service.createdAt
          })),
          count: services.length
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('List services error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to list services'),
      { status: 500 }
    );
  }
}
