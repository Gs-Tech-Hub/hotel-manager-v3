import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * GET /api/inventory/by-section/[sectionId]?type=all|items|services
 * Get unified inventory view for a section
 * Can filter by type: items, services, or both
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  try {
    const { sectionId } = await params;
    const typeFilter = request.nextUrl.searchParams.get('type') || 'all'; // all, items, services

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

    const result: any = {
      section: {
        id: section.id,
        name: section.name,
        department: section.department.code
      }
    };

    // Fetch items inventory for section
    if (['all', 'items'].includes(typeFilter)) {
      const items = await prisma.departmentInventory.findMany({
        where: {
          sectionId: sectionId,
          departmentId: section.departmentId
        },
        include: {
          inventoryItem: true
        },
        orderBy: { inventoryItem: { name: 'asc' } }
      });

      result.items = items.map(item => ({
        id: item.id,
        type: 'item',
        itemId: item.inventoryItemId,
        name: item.inventoryItem.name,
        quantity: item.quantity,
        reserved: item.reserved,
        available: item.quantity - item.reserved,
        unitPrice: item.unitPrice,
        sku: item.inventoryItem.sku
      }));
      result.itemCount = items.length;
    }

    // Fetch service inventory for section
    if (['all', 'services'].includes(typeFilter)) {
      const services = await prisma.serviceInventory.findMany({
        where: {
          sectionId: sectionId,
          departmentId: section.departmentId
        },
        orderBy: { name: 'asc' }
      });

      result.services = services.map(service => ({
        id: service.id,
        type: 'service',
        name: service.name,
        pricingModel: service.pricingModel,
        pricePerCount: service.pricePerCount,
        pricePerMinute: service.pricePerMinute,
        description: service.description
      }));
      result.serviceCount = services.length;
    }

    return NextResponse.json(
      successResponse({ data: result }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Get section inventory error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch inventory'),
      { status: 500 }
    );
  }
}
