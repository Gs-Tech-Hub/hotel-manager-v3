/**
 * Order Settlement API Route
 * 
 * POST /api/orders/settle - Record payment for pending/deferred order
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';

/**
 * POST /api/orders/settle
 * Record payment for one or more pending orders
 * 
 * Request body:
 * {
 *   orderId: string                      // Order to settle
 *   amount: number                       // Payment amount (in cents)
 *   paymentMethod: string               // cash, card, bank_transfer, etc.
 *   transactionReference?: string       // External reference (check #, transaction ID, etc.)
 *   notes?: string                      // Settlement notes
 * }
 */
export async function POST(request: NextRequest) {
  try {
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
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to process payments
    const hasPaymentPermission = hasAnyRole(userWithRoles, ['admin', 'manager', 'cashier']);
    if (!hasPaymentPermission) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to settle payments'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { orderId, amount, paymentMethod, transactionReference, notes } = body;

    // Validate inputs
    if (!orderId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'orderId is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'amount must be greater than 0'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'paymentMethod is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Fetch order with current payment state
    const order = await prisma.orderHeader.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: true,
        payments: true,
        departments: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check payment status, not fulfillment status
    // Orders can be fulfilled but still need payment - these are independent concerns
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot settle order with payment status: ${order.paymentStatus}. Only unpaid or partially paid orders can be settled.`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Calculate amount already paid
    const totalPaid = order.payments
      .filter((p) => p.paymentStatus === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const amountDue = order.total - totalPaid;

    // Validate payment amount doesn't exceed due amount
    if (amount > amountDue) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Payment amount (${amount}) exceeds amount due (${amountDue})`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Find or create payment type
    let paymentType = await prisma.paymentType.findUnique({
      where: { type: paymentMethod.toLowerCase() },
    });

    if (!paymentType) {
      // Create payment type if it doesn't exist
      paymentType = await prisma.paymentType.create({
        data: {
          type: paymentMethod.toLowerCase(),
          description: `Auto-created payment method: ${paymentMethod}`,
        },
      });
    }

    // Record the payment
    const payment = await prisma.orderPayment.create({
      data: {
        orderHeaderId: orderId,
        amount,
        paymentMethod,
        paymentTypeId: paymentType.id,
        paymentStatus: 'completed',
        transactionReference,
        processedAt: new Date(),
      },
    });

    // Calculate new state
    const newTotalPaid = totalPaid + amount;
    const newAmountDue = order.total - newTotalPaid;

    // If fully paid, move order to "processing" status
    let newStatus = order.status;
    if (newAmountDue <= 0) {
      newStatus = 'processing';
    }

    // Update order status if needed
    if (newStatus !== order.status) {
      await prisma.orderHeader.update({
        where: { id: orderId },
        data: { status: newStatus },
      });
    }

    // Step: Recalculate stats for all affected departments/sections
    // Now that payment is made, amountSold should be updated
    try {
      const { departmentService } = await import('@/services/department.service');

      // Get all unique department codes and section IDs from order lines
      const deptCodesWithSections = new Map<string, Set<string | undefined>>();
      
      for (const line of order.lines) {
        if (line.departmentCode) {
          if (!deptCodesWithSections.has(line.departmentCode)) {
            deptCodesWithSections.set(line.departmentCode, new Set());
          }
          deptCodesWithSections.get(line.departmentCode)?.add(line.departmentSectionId || undefined);
        }
      }

      // Batch all stat calculations in parallel for all affected departments and sections
      await Promise.all(
        Array.from(deptCodesWithSections.entries()).flatMap(([code, sectionIds]) =>
          Array.from(sectionIds).map(async (sectionId) => {
            try {
              await Promise.all([
                // Update section stats if sectionId exists, otherwise update parent department stats
                departmentService.recalculateSectionStats(code, sectionId),
                // Only rollup to parent if we have a section (to avoid duplicate parent updates)
                sectionId ? departmentService.rollupParentStats(code) : Promise.resolve(),
              ]);
            } catch (e) {
              console.error(`Error updating stats for department ${code}${sectionId ? ` section ${sectionId}` : ''}:`, e);
            }
          })
        )
      );
    } catch (e) {
      console.error('Error in post-payment stats recalculation:', e);
      // Don't fail the request, just log the error
    }

    // Return settlement response
    return NextResponse.json(
      successResponse(
       { 
        data: {
          orderId,
          orderNumber: order.orderNumber,
          paymentId: payment.id,
          paymentAmount: amount,
          totalPaid: newTotalPaid,
          amountDue: Math.max(0, newAmountDue),
          orderStatus: newStatus,
          isFullyPaid: newAmountDue <= 0,
          customer: {
            name: `${order.customer.firstName} ${order.customer.lastName}`,
            email: order.customer.email,
            phone: order.customer.phone,
          },
          orderTotal: order.total,
          timestamp: new Date().toISOString(),
        },
        message:
        newAmountDue <= 0 ? 'Order fully paid - moving to processing' : 'Partial payment recorded'
      }
      ),
      { status: 201 }
    );
  } catch (error) {
    try {
      const logger = await import('@/lib/logger');
      logger.error(error, { route: 'POST /api/orders/settle' });
    } catch (e) {
      console.error('POST /api/orders/settle error:', error);
    }
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to settle payment'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

