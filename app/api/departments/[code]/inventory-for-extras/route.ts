/**
 * GET /api/departments/[code]/inventory-for-extras
 * Fetch department inventory items available for conversion to extras
 * Only returns items that:
 * - Are active in DepartmentInventory for this department
 * - Are not already used as extras for this department
 * 
 * Query params:
 * - search: string (search by name or SKU)
 * - page: number (default: 1)
 * - limit: number (default: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';

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
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(5, parseInt(url.searchParams.get('limit') || '20')));

    // Get department
    const dept = await prisma.department.findFirst({
      where: { code: departmentCode },
      select: { id: true, name: true },
    });

    if (!dept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    // Get all inventory items for this department
    const where: any = {
      departmentId: dept.id,
      inventoryItem: { isActive: true },
    };

    if (search) {
      where.OR = [
        { inventoryItem: { name: { contains: search, mode: 'insensitive' } } },
        { inventoryItem: { sku: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get department inventory records
    const departmentInventories = await prisma.departmentInventory.findMany({
      where,
      include: {
        inventoryItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            description: true,
            unitPrice: true,
            category: true,
            usedAsExtras: {
              select: {
                id: true,
                departmentExtras: {
                  where: { departmentId: dept.id },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    // Filter out items that are already used as extras in this department
    const availableItems = departmentInventories
      .filter((di) => {
        const usedAsExtras = di.inventoryItem.usedAsExtras || [];
        // Include if no extras linked, or if no department-level allocation yet
        const allocatedInThisDept = usedAsExtras.some(
          (extra) => extra.departmentExtras && extra.departmentExtras.length > 0
        );
        return !allocatedInThisDept;
      })
      .map((di) => ({
        id: di.inventoryItem.id,
        name: di.inventoryItem.name,
        sku: di.inventoryItem.sku,
        description: di.inventoryItem.description,
        unitPrice: di.inventoryItem.unitPrice,
        category: di.inventoryItem.category,
        quantity: di.quantity,
        reserved: di.reserved,
        available: Math.max(0, di.quantity - di.reserved),
      }));

    // Apply pagination
    const total = availableItems.length;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedItems = availableItems.slice(startIdx, endIdx);
    const pages = Math.ceil(total / limit);

    return NextResponse.json(
      successResponse({
        data: {
          items: paginatedItems,
          meta: {
            total,
            page,
            limit,
            pages,
            departmentId: dept.id,
            departmentName: dept.name,
          },
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching inventory for extras:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch inventory items'),
      { status: 500 }
    );
  }
}
