import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';
import { extractUserContext } from '@/lib/user-context';

/**
 * POST /api/departments/[code]/games/checkout-order
 * Finalize payment for a game order
 * Processes payment and updates order status
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
    const { orderId, paymentMethod, amountPaid } = body;

    // Validation
    if (!orderId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Order ID is required'),
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Payment method is required'),
        { status: 400 }
      );
    }

    // Fetch order header
    const orderHeader = await prisma.orderHeader.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: true,
        departments: true,
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

    // Verify order is for games (status should be 'fulfilled')
    if (orderHeader.status !== 'fulfilled') {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'Order is not in a valid state for payment'),
        { status: 409 }
      );
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

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        transactionID: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        totalPrice: orderHeader.total,
      },
    });

    // Update order header with payment info
    const paidOrderHeader = await prisma.orderHeader.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'paid',
      },
      include: {
        customer: true,
        lines: true,
      },
    });

    // Create order payment record for audit trail
    await prisma.orderPayment.create({
      data: {
        orderHeaderId: orderId,
        amount: orderHeader.total,
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        paymentTypeId: paymentType.id,
      },
    });

    // Update fulfillment records
    await prisma.orderFulfillment.updateMany({
      where: { orderHeaderId: orderId },
      data: {
        status: 'completed',
      },
    });

    console.log('[Games Checkout] Order payment completed:', {
      orderId,
      orderNumber: orderHeader.orderNumber,
      customerId: orderHeader.customerId,
      totalAmount: orderHeader.total,
      paymentMethod,
      transactionId: payment.transactionID,
    });

    // Return confirmation with order details
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
            tax: paidOrderHeader.tax,
            total: paidOrderHeader.total,
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
            amount: payment.totalPrice,
          },
          message: 'Game order payment completed successfully',
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing game order payment:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to process payment'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/departments/[code]/games/checkout-order?orderId=order-id
 * Load order details for checkout
 */
export async function GET(
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

    const orderId = request.nextUrl.searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'Order ID is required'),
        { status: 400 }
      );
    }

    // Fetch order header with all details
    const orderHeader = await prisma.orderHeader.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: true,
        departments: true,
        payments: true,
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

    // Get available payment methods
    const paymentMethods = await prisma.paymentType.findMany({
      where: { type: { in: ['cash', 'card', 'bank_transfer', 'mobile_payment'] } },
    });

    return NextResponse.json(
      successResponse({
        data: {
          order: {
            id: orderHeader.id,
            orderNumber: orderHeader.orderNumber,
            status: orderHeader.status,
            paymentStatus: orderHeader.paymentStatus,
            subtotal: orderHeader.subtotal,
            discountTotal: orderHeader.discountTotal,
            tax: orderHeader.tax,
            total: orderHeader.total,
            customer: {
              id: orderHeader.customer?.id,
              name: orderHeader.customer
                ? `${orderHeader.customer.firstName} ${orderHeader.customer.lastName}`
                : 'Guest',
              email: orderHeader.customer?.email,
              phone: orderHeader.customer?.phone,
            },
            lineItems: orderHeader.lines?.map(line => ({
              id: line.id,
              productName: line.productName,
              productType: line.productType,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              status: line.status,
            })),
          },
          paymentMethods: paymentMethods.map(pm => ({
            id: pm.id,
            type: pm.type,
            description: pm.description,
          })),
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error loading order for checkout:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to load order'),
      { status: 500 }
    );
  }
}
