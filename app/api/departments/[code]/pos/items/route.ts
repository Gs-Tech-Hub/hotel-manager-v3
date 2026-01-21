import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';

/**
 * GET /api/departments/[code]/pos/items
 * Fetch inventory items + extras for POS menu (with available quantities)
 * 
 * Query params:
 * - sectionId: Optional section filter
 * - category: Optional category filter (food, drinks, extra, etc.)
 * 
 * Returns items with format suitable for POS display
 */
export async function GET(
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
    const sectionId = request.nextUrl.searchParams.get('sectionId');
    const category = request.nextUrl.searchParams.get('category');

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

    // Fetch inventory items
    const invWhere: any = { departmentId: dept.id };
    if (sectionId) {
      invWhere.sectionId = sectionId;
    } else {
      invWhere.sectionId = null;
    }

    const inventoryRecords = await prisma.departmentInventory.findMany({
      where: invWhere,
      include: {
        inventoryItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
          },
        },
      },
    });

    // Fetch extras
    const extrasWhere: any = { departmentId: dept.id };
    if (sectionId) {
      extrasWhere.sectionId = sectionId;
    } else {
      extrasWhere.sectionId = null;
    }

    const extraRecords = await prisma.departmentExtra.findMany({
      where: extrasWhere,
      include: {
        extra: {
          select: {
            id: true,
            name: true,
            unit: true,
            price: true,
            isActive: true,
          },
        },
      },
    });

    // Format for POS display
    const items = [
      // Inventory items
      ...inventoryRecords.map((record) => ({
        id: record.inventoryItem.id,
        name: record.inventoryItem.name,
        category: record.inventoryItem.category,
        price: 0, // Inventory items don't have price in this system
        quantity: record.quantity - record.reserved,
        itemType: 'inventory' as const,
        sku: record.inventoryItem.sku,
      })),

      // Extras
      ...extraRecords
        .filter((r) => r.extra.isActive) // Only show active extras
        .map((record) => ({
          id: record.extra.id,
          name: record.extra.name,
          category: 'extra',
          price: record.extra.price,
          quantity: record.quantity - record.reserved,
          itemType: 'extra' as const,
          unit: record.extra.unit,
        })),
    ];

    // Filter by category if provided
    let filtered = items;
    if (category && category !== 'all') {
      filtered = items.filter((i) => i.category === category);
    }

    return NextResponse.json(
      successResponse({
        data: {
          items: filtered,
          count: filtered.length,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching POS items:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch POS items'),
      { status: 500 }
    );
  }
}
