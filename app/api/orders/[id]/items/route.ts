/**
 * Order Line Items Management Routes
 * 
 * POST   /api/orders/[id]/items      - Add line item to order
 * PUT    /api/orders/[id]/items/[lineId] - Update line item
 * DELETE /api/orders/[id]/items/[lineId] - Remove line item
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { normalizeToCents } from '@/lib/price';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * POST /api/orders/[id]/items
 * Add a new line item to an existing order
 * 
 * Request body:
 * {
 *   productId: string
 *   productType: string
 *   productName: string
 *   departmentCode: string
 *   departmentSectionId?: string
 *   quantity: number
 *   unitPrice: number
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Get user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Load full user with roles
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can add items'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Prevent adding items to cancelled or refunded orders
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, `Cannot add items to a ${order.status} order`),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { productId, productType, productName, departmentCode, departmentSectionId, quantity, unitPrice } = body;

    // Validate required fields
    if (!productId || !productType || !productName || !departmentCode || !quantity || unitPrice === undefined) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Missing required fields'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Transactionally create line item and update order totals
    const createdLine = await prisma.$transaction(async (tx: any) => {
      const normalizedUnit = normalizeToCents(unitPrice)
      const lineTotal = quantity * normalizedUnit;

      // Get the next line number
      const lastLine = await tx.orderLine.findFirst({
        where: { orderHeaderId: orderId },
        orderBy: { lineNumber: 'desc' },
      });
      const nextLineNumber = (lastLine?.lineNumber ?? 0) + 1;

      const newLine = await tx.orderLine.create({
        data: {
          orderHeaderId: orderId,
          lineNumber: nextLineNumber,
          productId,
          productType,
          productName,
          departmentCode,
          departmentSectionId,
          quantity,
          unitPrice: normalizedUnit,
          lineTotal,
          status: 'pending',
        },
      });

      const allLines = await tx.orderLine.findMany({ where: { orderHeaderId: orderId } });
      const newSubtotal = allLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      const order = await tx.orderHeader.findUnique({ where: { id: orderId } });

      await tx.orderHeader.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newSubtotal - (order.discountTotal || 0) + (order.tax || 0),
        },
      });

      return newLine;
    });

    return NextResponse.json(
      successResponse(createdLine, 'Line item added successfully')
    );
  } catch (error) {
    console.error('POST /api/orders/[id]/items error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to add line item'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/orders/[id]/items/[lineId]
 * Remove a line item from an order
 */
// DELETE is handled by the nested route at /api/orders/[id]/items/[lineId]
