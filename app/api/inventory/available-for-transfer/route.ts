import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * GET /api/inventory/available-for-transfer?departmentId=dept-id
 * Get all items and services available for transfer within a department
 * Organized by section
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const departmentId = request.nextUrl.searchParams.get('departmentId');
    if (!departmentId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'departmentId required'),
        { status: 400 }
      );
    }

    // Get all sections in department
    const sections = await prisma.departmentSection.findMany({
      where: { departmentId }
    });

    if (sections.length === 0) {
      return NextResponse.json(
        successResponse({
          data: {
            departmentId,
            sections: []
          }
        }),
        { status: 200 }
      );
    }

    const sectionIds = sections.map(s => s.id);

    // Get all items in all sections
    const items = await prisma.departmentInventory.findMany({
      where: {
        sectionId: { in: sectionIds },
        quantity: { gt: 0 }  // Only available items
      },
      include: {
        inventoryItem: true,
        section: true
      },
      orderBy: [
        { sectionId: 'asc' },
        { inventoryItem: { name: 'asc' } }
      ]
    });

    // Get all services in all sections
    const services = await prisma.serviceInventory.findMany({
      where: {
        sectionId: { in: sectionIds }
      },
      include: {
        section: true
      },
      orderBy: [
        { sectionId: 'asc' },
        { name: 'asc' }
      ]
    });

    // Organize by section
    const sectionMap = new Map();
    for (const section of sections) {
      sectionMap.set(section.id, {
        id: section.id,
        name: section.name,
        items: [],
        services: []
      });
    }

    // Add items to sections
    for (const item of items) {
      const section = sectionMap.get(item.sectionId);
      if (section) {
        section.items.push({
          id: item.id,
          type: 'item',
          inventoryId: item.inventoryItemId,
          name: item.inventoryItem.name,
          quantity: item.quantity,
          available: item.quantity - item.reserved,
          sku: item.inventoryItem.sku
        });
      }
    }

    // Add services to sections
    for (const service of services) {
      const section = sectionMap.get(service.sectionId);
      if (section) {
        section.services.push({
          id: service.id,
          type: 'service',
          inventoryId: service.id,
          name: service.name,
          pricingModel: service.pricingModel,
          price: service.pricePerCount || service.pricePerMinute
        });
      }
    }

    const sectionList = Array.from(sectionMap.values());

    return NextResponse.json(
      successResponse({
        data: {
          departmentId,
          sections: sectionList,
          stats: {
            totalSections: sectionList.length,
            totalItems: items.length,
            totalServices: services.length
          }
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get available inventory error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch inventory'),
      { status: 500 }
    );
  }
}
