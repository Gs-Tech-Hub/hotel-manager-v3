/**
 * Order Payments API Routes
 * 
 * POST /api/orders/[id]/payments - Record payment against order
 * GET  /api/orders/[id]/payments - List payments for order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';

/**
 * POST /api/orders/[id]/payments
 * Record a payment against an order
 * 
 * Request body:
 * {
 *   amount: number              // Payment amount
 *   paymentTypeId: string       // Payment method ID
 *   transactionReference?: string // External transaction ID (for verification)
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can record payments'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { amount, paymentTypeId, transactionReference } = body;

    // Validate input
    if (!amount || amount <= 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'amount must be greater than 0'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (!paymentTypeId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'paymentTypeId is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Fetch order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Verify payment type exists
    const paymentType = await prisma.paymentType.findUnique({
      where: { id: paymentTypeId },
    });

    if (!paymentType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Payment type not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Record payment using service
    const orderService = new OrderService();
    const result = await orderService.recordPayment(
      orderId,
      {
        amount,
        paymentMethod: paymentType.type,
        paymentTypeId,
        transactionReference,
      },
      userWithRoles
    );

    // Check if result is error response
    if ('error' in result) {
      return NextResponse.json(
        result,
        { status: getStatusCode(result.error.code) }
      );
    }

    return NextResponse.json(
      successResponse(result, 'Payment recorded successfully'),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/orders/[id]/payments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to record payment'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * GET /api/orders/[id]/payments
 * List all payments for an order
 */
export async function GET(
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

    // Check permissions: customer can only view own order's payments
    if (userWithRoles && !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      if (order.customerId !== ctx.userId) {
        return NextResponse.json(
          errorResponse(ErrorCodes.FORBIDDEN, 'Cannot access this order'),
          { status: getStatusCode(ErrorCodes.FORBIDDEN) }
        );
      }
    }

    // Fetch payments
    const payments = await (prisma as any).orderPayment.findMany({
      where: { orderHeaderId: orderId },
      include: {
        paymentType: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary
    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const remaining = Math.max(0, order.total - totalPaid);

    return NextResponse.json(
      successResponse({
        payments,
        summary: {
          orderTotal: order.total,
          totalPaid,
          remaining,
          paymentStatus: remaining === 0 ? 'paid' : remaining === order.total ? 'unpaid' : 'partial',
        },
      })
    );
  } catch (error) {
    console.error('GET /api/orders/[id]/payments error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch payments'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
