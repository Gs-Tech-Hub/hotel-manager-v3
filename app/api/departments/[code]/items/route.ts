import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';

/**
 * GET /api/departments/[code]/items
 * Fetch both inventory items AND extras for a department (combined view)
 * Used for transfer and display purposes
 * 
 * Each item includes:
 * - id, name, sku, category, quantity, available
 * - itemType: 'inventory' | 'extra'
 * - If extra: price, unit, trackInventory, productId
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
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '999');

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

    // Fetch inventory items for this department
    const deptInvWhere: any = { departmentId: dept.id };
    if (sectionId) {
      deptInvWhere.sectionId = sectionId;
    } else {
      deptInvWhere.sectionId = null; // Only parent-level inventory when no section specified
    }

    const inventoryRecords = await prisma.departmentInventory.findMany({
      where: deptInvWhere,
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
      take: limit,
    });

    // Fetch extras for this department
    const deptExtrasWhere: any = { departmentId: dept.id };
    if (sectionId) {
      deptExtrasWhere.sectionId = sectionId;
    } else {
      deptExtrasWhere.sectionId = null;
    }

    const extraRecords = await prisma.departmentExtra.findMany({
      where: deptExtrasWhere,
      include: {
        extra: {
          select: {
            id: true,
            name: true,
            unit: true,
            price: true,
            productId: true,
            trackInventory: true,
          },
        },
      },
      take: limit,
    });

    // Combine and format response
    const items = [
      // Inventory items
      ...inventoryRecords.map((record) => ({
        id: record.inventoryItem.id,
        name: record.inventoryItem.name,
        sku: record.inventoryItem.sku,
        category: record.inventoryItem.category,
        quantity: record.quantity,
        available: record.quantity - record.reserved,
        itemType: 'inventory' as const,
        departmentInventoryId: record.id, // For transfers
      })),

      // Extras (treated as items)
      ...extraRecords.map((record) => ({
        id: record.extra.id,
        name: `${record.extra.name} (Extra)`,
        sku: '', // Extras don't have SKU
        category: 'extra',
        quantity: record.quantity,
        available: record.quantity - record.reserved,
        itemType: 'extra' as const,
        unit: record.extra.unit,
        price: record.extra.price,
        productId: record.extra.productId,
        trackInventory: record.extra.trackInventory,
        departmentExtraId: record.id, // For transfers
      })),
    ];

    return NextResponse.json(
      successResponse({
        data: {
          items,
          count: items.length,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching department items:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch items'),
      { status: 500 }
    );
  }
}
