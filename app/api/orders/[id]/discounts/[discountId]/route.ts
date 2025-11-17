import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * DELETE /api/orders/[id]/discounts/[discountId]
 * Remove a discount from an order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; discountId: string }> }
) {
  try {
    const { id: orderId, discountId } = await params;

    // Get user context
    const ctx = extractUserContext(request);
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can remove discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        discounts: true,
        lines: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Find discount to delete
    const discount = order.discounts.find((d: any) => d.id === discountId);
    if (!discount) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount not found on this order'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Remove discount
    await prisma.$transaction(async (tx: any) => {
      // Delete discount
      await tx.orderDiscount.delete({
        where: { id: discountId },
      });

      // Recalculate order totals
      const remainingDiscounts = await tx.orderDiscount.findMany({
        where: { orderHeaderId: orderId },
      });

      const discountTotal = remainingDiscounts.reduce((sum: number, d: any) => sum + d.discountAmount, 0);
      const total = order.subtotal - discountTotal + order.tax;

      await tx.orderHeader.update({
        where: { id: orderId },
        data: {
          discountTotal,
          total,
        },
      });
    });

    // Fetch updated order
    const updatedOrder = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: true,
        departments: true,
        discounts: true,
        payments: true,
      },
    });

    return NextResponse.json(
      successResponse(updatedOrder, 'Discount removed successfully')
    );
  } catch (error) {
    console.error('DELETE /api/orders/[id]/discounts/[discountId] error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to remove discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
