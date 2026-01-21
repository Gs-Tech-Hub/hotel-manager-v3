import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';
import { prisma } from '@/lib/auth/prisma';
import { DepartmentExtrasService } from '@/services/department-extras.service';

/**
 * POST /api/departments/[code]/items/transfer
 * Transfer items (inventory or extras) between sections
 * 
 * Body:
 * - itemId: string (inventory item ID or extra ID)
 * - itemType: 'inventory' | 'extra'
 * - sourceSectionId: string | null (null = parent level)
 * - destinationSectionId: string | null (null = parent level)
 * - quantity: number
 */
export async function POST(
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
    const body = await request.json();
    const {
      itemId,
      itemType,
      sourceSectionId,
      destinationSectionId,
      quantity,
    } = body;

    // Validate input
    if (!itemId || !itemType || quantity === undefined || quantity <= 0) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'itemId, itemType, quantity are required'
        ),
        { status: 400 }
      );
    }

    if (itemType !== 'inventory' && itemType !== 'extra') {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'itemType must be "inventory" or "extra"'
        ),
        { status: 400 }
      );
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

    // Handle transfer based on item type
    if (itemType === 'inventory') {
      // Verify inventory item exists
      const invItem = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
      });
      if (!invItem) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Inventory item not found'),
          { status: 404 }
        );
      }

      // Get source allocation
      const source = await prisma.departmentInventory.findFirst({
        where: {
          departmentId: dept.id,
          inventoryItemId: itemId,
          sectionId: sourceSectionId || null,
        },
      });

      if (!source) {
        return NextResponse.json(
          errorResponse(ErrorCodes.NOT_FOUND, 'Source inventory not found'),
          { status: 404 }
        );
      }

      if (source.quantity < quantity) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.INVALID_INPUT,
            `Insufficient quantity. Available: ${source.quantity}`
          ),
          { status: 400 }
        );
      }

      // Reduce from source
      await prisma.departmentInventory.update({
        where: { id: source.id },
        data: {
          quantity: source.quantity - quantity,
        },
      });

      // Add to destination
      const destWhere: any = {
        departmentId: dept.id,
        inventoryItemId: itemId,
        sectionId: destinationSectionId || null,
      };

      const destination = await prisma.departmentInventory.findFirst({
        where: destWhere,
      });

      let result;
      if (destination) {
        result = await prisma.departmentInventory.update({
          where: { id: destination.id },
          data: {
            quantity: destination.quantity + quantity,
          },
          include: { inventoryItem: true },
        });
      } else {
        result = await prisma.departmentInventory.create({
          data: {
            departmentId: dept.id,
            inventoryItemId: itemId,
            sectionId: destinationSectionId || null,
            quantity,
          },
          include: { inventoryItem: true },
        });
      }

      return NextResponse.json(
        successResponse({
          data: { item: result },
          message: 'Inventory transferred successfully',
        }),
        { status: 200 }
      );
    } else {
      // Handle extras transfer
      const result = await DepartmentExtrasService.transferExtra(
        dept.id,
        itemId,
        sourceSectionId || null,
        destinationSectionId || null,
        quantity
      );

      return NextResponse.json(
        successResponse({
          data: { item: result },
          message: 'Extra transferred successfully',
        }),
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error transferring item:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to transfer item';
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}
