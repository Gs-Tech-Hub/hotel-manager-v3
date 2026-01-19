import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { normalizeToCents } from '@/lib/price';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * PUT /api/orders/[id]/items/[lineId]
 * Update an existing line item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id: orderId, lineId } = await params;

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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can update items'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { quantity, unitPrice } = body;

    // Fetch line item
    const lineItem = await (prisma as any).orderLine.findUnique({
      where: { id: lineId },
      include: { orderHeader: true },
    });

    if (!lineItem || lineItem.orderHeaderId !== orderId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Line item not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if can be updated
    if (['fulfilled', 'completed', 'cancelled'].includes(lineItem.status)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot update item with status: ${lineItem.status}`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Update line item
    const result = await prisma.$transaction(async (tx: any) => {
      const newQuantity = quantity !== undefined ? quantity : lineItem.quantity;
      const newUnitPrice = unitPrice !== undefined ? normalizeToCents(unitPrice) : lineItem.unitPrice;
      const newLineTotal = newQuantity * newUnitPrice;

      const updated = await tx.orderLine.update({
        where: { id: lineId },
        data: {
          quantity: newQuantity,
          unitPrice: newUnitPrice,
          lineTotal: newLineTotal,
        },
      });

      // Update order totals
      const allLines = await tx.orderLine.findMany({
        where: { orderHeaderId: orderId },
      });

      const newSubtotal = allLines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      const order = await tx.orderHeader.findUnique({
        where: { id: orderId },
      });

      await tx.orderHeader.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newSubtotal - (order.discountTotal || 0) + (order.tax || 0),
        },
      });

      return updated;
    });

    return NextResponse.json(
      successResponse({data : result, message : 'Line item updated successfully'})
    );
  } catch (error) {
    console.error('PUT /api/orders/[id]/items/[lineId] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update line item'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/orders/[id]/items/[lineId]
 * Remove a line item from an order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id: orderId, lineId } = await params;

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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can delete items'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch line item
    const lineItem = await (prisma as any).orderLine.findUnique({
      where: { id: lineId },
      include: { orderHeader: true },
    });

    if (!lineItem || lineItem.orderHeaderId !== orderId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Line item not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if can be deleted
    if (['fulfilled', 'completed', 'cancelled'].includes(lineItem.status)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot delete item with status: ${lineItem.status}`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Remove line and update order totals
    await prisma.$transaction(async (tx: any) => {
      await tx.orderLine.delete({ where: { id: lineId } });

      const remaining = await tx.orderLine.findMany({ where: { orderHeaderId: orderId } });
      const newSubtotal = remaining.reduce((sum: number, l: any) => sum + l.lineTotal, 0);

      const order = await tx.orderHeader.findUnique({ where: { id: orderId } });

      await tx.orderHeader.update({
        where: { id: orderId },
        data: {
          subtotal: newSubtotal,
          total: newSubtotal - (order.discountTotal || 0) + (order.tax || 0),
        },
      });
    });

    return NextResponse.json(
      successResponse({data : null, message : 'Line item removed'})
    );
  } catch (error) {
    console.error('DELETE /api/orders/[id]/items/[lineId] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete line item'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
