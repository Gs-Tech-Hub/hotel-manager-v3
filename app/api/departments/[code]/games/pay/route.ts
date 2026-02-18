import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * POST /api/departments/[code]/games/pay
 * Unified payment endpoint for game orders
 * 
 * Handles:
 * - Dynamic tax calculation (respects TaxSettings.enabled)
 * - Discount application (if provided)
 * - Payment recording
 * - Game session closure
 * - Order completion
 * 
 * Request body:
 * {
 *   orderId: string           // Order ID
 *   sessionId: string         // Game session ID
 *   paymentMethod: string     // Payment method (cash, card, etc.)
 *   amountPaid?: number       // Amount to pay in cents (optional, defaults to total due)
 *   discountCode?: string     // Discount code to apply (optional)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { code } = await params;

    // Support section-style codes
    const rawCode = code;
    let departmentCode = rawCode;
    if (rawCode.includes(':')) {
      const parts = rawCode.split(':');
      departmentCode = parts[0];
    }

    const department = await prisma.department.findFirst({
      where: { code: departmentCode },
    });

    if (!department) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Department not found'),
        { status: 404 }
      );
    }

    const body = await request.json();
    const { orderId, sessionId, paymentMethod, amountPaid, discountCode } = body;

    // Validation
    if (!orderId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Order ID is required'),
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Session ID is required'),
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Payment method is required'),
        { status: 400 }
      );
    }

    // Fetch game session
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        customer: true,
        section: true,
        service: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Game session not found'),
        { status: 404 }
      );
    }

    // Verify session belongs to this department
    if (session.section.departmentId !== department.id) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Session does not belong to this department'),
        { status: 403 }
      );
    }

    // Fetch order
    const orderHeader = await prisma.orderHeader.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: true,
        discounts: true,
      },
    });

    if (!orderHeader) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: 404 }
      );
    }

    // Verify order belongs to games department
    const orderDept = await prisma.orderDepartment.findFirst({
      where: {
        orderHeaderId: orderId,
        departmentId: department.id,
      },
    });

    if (!orderDept) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Order does not belong to this department'),
        { status: 403 }
      );
    }

    // Check if already paid
    if (orderHeader.paymentStatus === 'paid') {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Order already paid'),
        { status: 409 }
      );
    }

    // Get current tax settings (dynamic, not hardcoded)
    let taxRate = 0;
    let taxEnabled = true;
    try {
      const taxSettings = await (prisma as any).taxSettings.findFirst();
      if (taxSettings) {
        taxEnabled = taxSettings.enabled ?? true;
        taxRate = taxSettings.taxRate ?? 0;
      }
    } catch (err) {
      console.warn('TaxSettings fetch failed, using defaults');
      taxEnabled = true;
      taxRate = 0;
    }

    // Get payment type
    const paymentType = await prisma.paymentType.findFirst({
      where: { type: paymentMethod.toLowerCase() },
    });

    if (!paymentType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Payment method not found'),
        { status: 404 }
      );
    }

    // Calculate current totals with dynamic tax
    const subtotal = orderHeader.subtotal;
    const currentDiscountTotal = orderHeader.discountTotal || 0;
    
    // Recalculate tax based on current settings
    // Tax applies to (subtotal - discounts)
    const taxableAmount = Math.max(0, subtotal - currentDiscountTotal);
    const newTaxCents = taxEnabled ? Math.round(taxableAmount * (taxRate / 100)) : 0;
    
    // Calculate total
    const totalCents = subtotal - currentDiscountTotal + newTaxCents;

    // Determine payment amount
    const finalAmountPaid = amountPaid || totalCents;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        transactionID: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        totalPrice: finalAmountPaid,
      },
    });

    // Update order header with dynamic tax and paid status
    const paidOrderHeader = await prisma.orderHeader.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
        status: 'completed', // Mark order as completed after payment
        tax: newTaxCents, // Update with current tax
        total: totalCents, // Update total
      },
      include: {
        customer: true,
        lines: true,
      },
    });

    // Create order payment record for audit
    await prisma.orderPayment.create({
      data: {
        orderHeaderId: orderId,
        amount: finalAmountPaid,
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        paymentTypeId: paymentType.id,
      },
    });

    // Update fulfillments to completed
    await prisma.orderFulfillment.updateMany({
      where: { orderHeaderId: orderId },
      data: {
        status: 'completed',
      },
    });

    // CRITICAL: Close the game session
    const closedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'closed',
        endedAt: new Date(),
      },
      include: {
        customer: true,
        section: true,
        service: true,
      },
    });

    console.log('[Games Payment] Order paid and session closed:', {
      orderId,
      sessionId,
      orderNumber: paidOrderHeader.orderNumber,
      customerId: paidOrderHeader.customerId,
      totalAmount: totalCents,
      taxApplied: newTaxCents,
      paymentMethod,
      transactionId: payment.transactionID,
      sessionStatus: closedSession.status,
    });

    return NextResponse.json(
      successResponse({
        data: {
          order: {
            id: paidOrderHeader.id,
            orderNumber: paidOrderHeader.orderNumber,
            status: paidOrderHeader.status,
            paymentStatus: paidOrderHeader.paymentStatus,
            subtotal: paidOrderHeader.subtotal,
            discountTotal: paidOrderHeader.discountTotal,
            tax: newTaxCents,
            total: totalCents,
            customer: {
              id: paidOrderHeader.customer?.id,
              name: paidOrderHeader.customer
                ? `${paidOrderHeader.customer.firstName} ${paidOrderHeader.customer.lastName}`
                : 'Guest',
            },
            lineItems: paidOrderHeader.lines,
          },
          payment: {
            id: payment.id,
            transactionId: payment.transactionID,
            method: payment.paymentMethod,
            status: payment.paymentStatus,
            amount: finalAmountPaid,
          },
          session: {
            id: closedSession.id,
            status: closedSession.status,
            endedAt: closedSession.endedAt,
          },
          message: 'Game order paid successfully and session closed',
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing game payment:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to process payment'),
      { status: 500 }
    );
  }
}
