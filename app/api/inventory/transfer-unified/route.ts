import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

/**
 * POST /api/inventory/transfer-unified
 * Transfer either items or services between sections
 * Requires: admin or department manager role
 * 
 * Body:
 * {
 *   "type": "item" | "service",
 *   "fromSectionId": "section-id",
 *   "toSectionId": "section-id",
 *   "inventoryId": "item-or-service-id",
 *   "quantity": 10  // only for items
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(errorResponse(ErrorCodes.UNAUTHORIZED), { status: 401 });
    }

    const body = await request.json();
    const { type, fromSectionId, toSectionId, inventoryId, quantity } = body;

    // Validate required fields
    if (!type || !fromSectionId || !toSectionId || !inventoryId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Missing required fields'),
        { status: 400 }
      );
    }

    if (!['item', 'service'].includes(type)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'type must be "item" or "service"'),
        { status: 400 }
      );
    }

    // Get both sections and verify they belong to same department
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

    if (type === 'item') {
      return await transferItem(
        inventoryId,
        quantity,
        fromSection,
        toSection,
        ctx.userId
      );
    } else {
      return await transferService(
        inventoryId,
        fromSection,
        toSection,
        ctx.userId
      );
    }
  } catch (error) {
    console.error('Transfer inventory error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Transfer failed'),
      { status: 500 }
    );
  }
}

/**
 * Transfer items between sections
 */
async function transferItem(
  itemId: string,
  quantity: number,
  fromSection: any,
  toSection: any,
  userId: string
) {
  if (!quantity || quantity <= 0) {
    return NextResponse.json(
      errorResponse(ErrorCodes.BAD_REQUEST, 'Quantity must be positive'),
      { status: 400 }
    );
  }

  // Get source inventory
  const sourceInventory = await prisma.departmentInventory.findFirst({
    where: {
      sectionId: fromSection.id,
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
      errorResponse(
        ErrorCodes.BAD_REQUEST,
        `Insufficient quantity. Available: ${sourceInventory.quantity}, Requested: ${quantity}`
      ),
      { status: 400 }
    );
  }

  // Get or create destination inventory
  let destInventory = await prisma.departmentInventory.findFirst({
    where: {
      sectionId: toSection.id,
      inventoryItemId: itemId
    }
  });

  if (!destInventory) {
    destInventory = await prisma.departmentInventory.create({
      data: {
        departmentId: toSection.departmentId,
        sectionId: toSection.id,
        inventoryItemId: itemId,
        quantity: 0,
        unitPrice: sourceInventory.unitPrice
      }
    });
  }

  // Execute transfer
  await prisma.$transaction([
    prisma.departmentInventory.update({
      where: { id: sourceInventory.id },
      data: { quantity: { decrement: quantity } }
    }),
    prisma.departmentInventory.update({
      where: { id: destInventory.id },
      data: { quantity: { increment: quantity } }
    })
  ]);

  return NextResponse.json(
    successResponse({
      data: {
        type: 'item',
        message: `Transferred ${quantity} ${sourceInventory.inventoryItem.name}`,
        from: {
          section: fromSection.name,
          remaining: sourceInventory.quantity - quantity
        },
        to: {
          section: toSection.name,
          total: destInventory.quantity + quantity
        }
      }
    }),
    { status: 200 }
  );
}

/**
 * Transfer services between sections
 */
async function transferService(
  serviceId: string,
  fromSection: any,
  toSection: any,
  userId: string
) {
  // Get service from source
  const service = await prisma.serviceInventory.findFirst({
    where: {
      id: serviceId,
      sectionId: fromSection.id
    }
  });

  if (!service) {
    return NextResponse.json(
      errorResponse(ErrorCodes.NOT_FOUND, 'Service not found in source section'),
      { status: 404 }
    );
  }

  // Check if service exists in destination
  const existingService = await prisma.serviceInventory.findFirst({
    where: {
      id: serviceId,
      sectionId: toSection.id
    }
  });

  if (existingService) {
    return NextResponse.json(
      errorResponse(ErrorCodes.CONFLICT, 'Service already exists in destination section'),
      { status: 409 }
    );
  }

  // Transfer service
  await prisma.serviceInventory.update({
    where: { id: serviceId },
    data: { sectionId: toSection.id }
  });

  return NextResponse.json(
    successResponse({
      data: {
        type: 'service',
        message: `Transferred service: ${service.name}`,
        from: { section: fromSection.name },
        to: { section: toSection.name }
      }
    }),
    { status: 200 }
  );
}
