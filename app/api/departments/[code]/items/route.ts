import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { checkPermission } from '@/lib/auth/rbac';
import { DepartmentExtrasService } from '@/services/department-extras.service';

/**
 * GET /api/departments/[code]/items
 * Fetch both inventory items AND extras for a department (combined view)
 * Used for transfer and display purposes
 * 
 * Each item includes:
 * - id, name, sku, category, quantity, available
 * - itemType: 'inventory' | 'extra'
 * - If extra: price, unit, trackInventory, productId
 * 
 * DELETE /api/departments/[code]/items?itemId=X&itemType=extra|inventory
 * Delete an item (extra or inventory) from department
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
    let sectionId = request.nextUrl.searchParams.get('sectionId');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '999');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const search = request.nextUrl.searchParams.get('search') || undefined;
    const forTransfer = request.nextUrl.searchParams.get('forTransfer') === 'true';

    // Convert string 'null' to actual null
    if (sectionId === 'null') {
      sectionId = null;
    }

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

    // Fetch inventory items - show ALL active inventory items as single source of truth
    // Include items with AND without department allocations
    // This ensures every global inventory item is visible for potential transfer/allocation to this department

    // First, get ALL active inventory items (global source of truth)
    // Exclude soft-deleted items (deletedAt is not null)
    const inventoryWhere: any = {
      isActive: true,
      deletedAt: null
    };
    
    // Apply search filter if provided
    if (search) {
      inventoryWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const allInventoryItems = await prisma.inventoryItem.findMany({
      where: inventoryWhere,
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
      },
      orderBy: { name: 'asc' }
    });

    // Then get quantities summed across all departments for these items
    const allInventories = await prisma.departmentInventory.groupBy({
      by: ['inventoryItemId'],
      where: {
        sectionId: null,  // Only department-level, not sections
      },
      _sum: {
        quantity: true
      }
    });

    // Map totals for lookup
    const totalsMap = new Map(allInventories.map(inv => [inv.inventoryItemId, inv._sum.quantity ?? 0]));
    
    const inventoryRecords = allInventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      totalQuantity: totalsMap.get(item.id) ?? 0,
      totalReserved: 0  // Not tracking reserved separately
    }));

    // Fetch extras for this department
    const deptExtrasWhere: any = { departmentId: dept.id };
    if (sectionId) {
      deptExtrasWhere.sectionId = sectionId;
    } else {
      // Only fetch parent-level (department-level) extras when no section specified
      deptExtrasWhere.sectionId = null;
    }

    const extraRecords = await prisma.departmentExtra.findMany({
      where: {
        ...deptExtrasWhere,
        extra: {
          isActive: true,
          // Apply search filter to extras as well
          ...(search && {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
            ]
          })
        }
      },
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
    });

    // Combine and format response
    // NOTE: Return ONLY inventory items here (not extras)
    // Extras are fetched separately via /api/departments/[code]/extras
    // This ensures consistency with global inventory view - return all active items regardless of quantity
    let items = [
      // Inventory items (consolidated totals) - ALL active items shown
      ...inventoryRecords
        .map((record) => ({
          id: record.id,
          name: record.name,
          sku: record.sku,
          category: record.category,
          quantity: record.totalQuantity,
          available: record.totalQuantity - record.totalReserved,
          itemType: 'inventory' as const,
        })),
    ];

    // Filter out items with zero available quantity if loading for transfer
    if (forTransfer) {
      items = items.filter((item) => (item.available ?? 0) > 0);
    }

    // Apply pagination to results
    const total = items.length;
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;
    const paginatedItems = items.slice(startIdx, endIdx);
    const pages = Math.ceil(total / limit);

    return NextResponse.json(
      successResponse({
        data: {
          items: paginatedItems,
          count: paginatedItems.length,
          total,
          page,
          limit,
          pages,
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

export async function DELETE(
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

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'User not found'),
        { status: 403 }
      );
    }

    // Check permissions based on item type
    const itemType = request.nextUrl.searchParams.get('itemType') || '';
    const itemId = request.nextUrl.searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'itemId is required'),
        { status: 400 }
      );
    }

    const permCtx = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : 'employee') as any,
      departmentId: userWithRoles.userId, // Use userId as fallback
    };

    // Check appropriate permission based on item type
    if (itemType === 'extra') {
      const canDelete = await checkPermission(permCtx, 'extras.delete');
      if (!canDelete) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to delete extras'),
          { status: 403 }
        );
      }
    } else if (itemType === 'inventory') {
      const canDelete = await checkPermission(permCtx, 'inventory.delete');
      if (!canDelete) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to delete inventory'),
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid itemType'),
        { status: 400 }
      );
    }

    const { code: departmentCode } = await params;
    const sectionId = request.nextUrl.searchParams.get('sectionId');

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

    if (itemType === 'extra') {
      // Delete extra from department
      let deleted = { count: 0 };

      // First try to delete from parent level (sectionId = null)
      if (!sectionId) {
        deleted = await prisma.departmentExtra.deleteMany({
          where: {
            departmentId: dept.id,
            extraId: itemId,
            sectionId: null,
          },
        });

        // If not found at parent level, delete from ANY section
        if (deleted.count === 0) {
          deleted = await prisma.departmentExtra.deleteMany({
            where: {
              departmentId: dept.id,
              extraId: itemId,
            },
          });
        }
      } else {
        // If sectionId specified, delete only from that section
        deleted = await prisma.departmentExtra.deleteMany({
          where: {
            departmentId: dept.id,
            extraId: itemId,
            sectionId: sectionId,
          },
        });
      }

      if (deleted.count === 0) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Extra not found in this department'),
          { status: 404 }
        );
      }

      return NextResponse.json(
        successResponse({
          data: { message: 'Extra deleted successfully' },
        }),
        { status: 200 }
      );
    } else {
      // Delete inventory from department
      let deleted = { count: 0 };

      // First try to delete from parent level (sectionId = null)
      if (!sectionId) {
        deleted = await prisma.departmentInventory.deleteMany({
          where: {
            departmentId: dept.id,
            inventoryItemId: itemId,
            sectionId: null,
          },
        });

        // If not found at parent level, delete from ANY section
        if (deleted.count === 0) {
          deleted = await prisma.departmentInventory.deleteMany({
            where: {
              departmentId: dept.id,
              inventoryItemId: itemId,
            },
          });
        }
      } else {
        // If sectionId specified, delete only from that section
        deleted = await prisma.departmentInventory.deleteMany({
          where: {
            departmentId: dept.id,
            inventoryItemId: itemId,
            sectionId: sectionId,
          },
        });
      }

      if (deleted.count === 0) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Inventory item not found in this department'),
          { status: 404 }
        );
      }

      return NextResponse.json(
        successResponse({
          data: { message: 'Inventory item deleted successfully' },
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    const msg = error instanceof Error ? error.message : 'Failed to delete item';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, msg),
      { status: 500 }
    );
  }
}
