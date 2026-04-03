import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { errorResponse, successResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { logAudit } from '@/lib/auth/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract user context and check permissions
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check permission to update customer (require manager/admin role)
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to update customer details'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const { id } = await params;

    // Parse request body - only essential customer fields
    const body = await request.json();
    const { firstName, lastName, email, phone } = body;

    // Fetch the order
    const order = await prisma.orderHeader.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Update customer details
    if (order.customerId) {
      const updatedCustomer = await prisma.customer.update({
        where: { id: order.customerId },
        data: {
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          email: email ?? undefined,
          phone: phone ?? undefined,
        },
      });

      // Log audit trail
      await logAudit({
        action: 'customers.update',
        userId: ctx.userId,
        resourceType: 'customer',
        resourceId: order.customerId,
        metadata: { orderId: id },
        changes: {
          firstName,
          lastName,
          email,
          phone,
        },
      });
    }

    // Fetch and return updated order
    const updatedOrder = await prisma.orderHeader.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: true,
        payments: true,
        discounts: true,
        departments: { include: { department: true } },
        fulfillments: true,
        extras: true,
      },
    });

    return NextResponse.json(
      successResponse({ data: updatedOrder }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error?.message || 'Failed to update customer details'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
