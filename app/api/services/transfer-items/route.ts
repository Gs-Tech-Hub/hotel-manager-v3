import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * POST /api/services/transfer-items
 * Transfer inventory items between department sections
 * Requires: admin or department manager role
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const body = await request.json();
    const { fromSectionId, toSectionId, itemId, quantity } = body;

    if (!fromSectionId || !toSectionId || !itemId || !quantity) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields'),
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Quantity must be positive'),
        { status: 400 }
      );
    }

    // Get both sections and verify they belong to the same department
    const [fromSection, toSection] = await Promise.all([
      prisma.departmentSection.findUnique({
        where: { id: fromSectionId },
        include: { department: true }
      }),
      prisma.departmentSection.findUnique({
        where: { id: toSectionId },
        include: { department: true }
      })
    ]);

    if (!fromSection || !toSection) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Section not found'),
        { status: 404 }
      );
    }

    if (fromSection.departmentId !== toSection.departmentId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Sections must be in the same department'),
        { status: 400 }
      );
    }

    // Get source inventory
    const sourceInventory = await prisma.departmentInventory.findFirst({
      where: {
        sectionId: fromSectionId,
        inventoryItemId: itemId
      },
      include: { inventoryItem: true }
    });

    if (!sourceInventory) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Item not found in source section'),
        { status: 404 }
      );
    }

    if (sourceInventory.quantity < quantity) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Insufficient quantity in source section'),
        { status: 400 }
      );
    }

    // Get or create destination inventory
    let destInventory = await prisma.departmentInventory.findFirst({
      where: {
        sectionId: toSectionId,
        inventoryItemId: itemId
      }
    });

    if (!destInventory) {
      destInventory = await prisma.departmentInventory.create({
        data: {
          departmentId: toSection.departmentId,
          sectionId: toSectionId,
          inventoryItemId: itemId,
          quantity: 0,
          unitPrice: sourceInventory.unitPrice
        }
      });
    }

    // Execute transfer in transaction
    const result = await prisma.$transaction([
      // Decrease source
      prisma.departmentInventory.update({
        where: { id: sourceInventory.id },
        data: {
          quantity: {
            decrement: quantity
          }
        }
      }),
      // Increase destination
      prisma.departmentInventory.update({
        where: { id: destInventory.id },
        data: {
          quantity: {
            increment: quantity
          }
        }
      })
    ]);

    return NextResponse.json(
      successResponse({
        data: {
          message: 'Transfer completed',
          from: { section: fromSection.name, quantity: sourceInventory.quantity - quantity },
          to: { section: toSection.name, quantity: destInventory.quantity + quantity }
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Transfer items error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to transfer items'),
      { status: 500 }
    );
  }
}
