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
      // Only fetch parent-level (department-level) inventory when no section specified
      deptInvWhere.sectionId = null;
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
      // Only fetch parent-level (department-level) extras when no section specified
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
        // Non-tracked extras use quantity: 1 as persistent state (not countable)
        // Tracked extras have actual countable quantity
        quantity: record.extra.trackInventory ? record.quantity : 1,
        available: record.extra.trackInventory ? (record.quantity - record.reserved) : 1,
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
      const canDelete = await checkPermission(permCtx, 'extras.delete', 'extras');
      if (!canDelete) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to delete extras'),
          { status: 403 }
        );
      }
    } else if (itemType === 'inventory') {
      const canDelete = await checkPermission(permCtx, 'inventory.delete', 'inventory');
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
