/**
 * Order Settlement API Route
 * 
 * POST /api/orders/settle - Record payment for pending/deferred order
 * Delegates all payment logic to unified PaymentService for consistency
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { paymentService } from '@/services/payment.service';

/**
 * POST /api/orders/settle
 * Record payment for pending orders (deferred payments without inventory consumption)
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

    // Delegate payment recording to unified PaymentService
    const result = await paymentService.recordDeferredOrderPayment(orderId, {
      amount,
      paymentMethod,
      transactionReference,
      context: {
        userId: ctx.userId,
        notes,
      },
    });

    // Check if result is an error response
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      const statusCode = result.code ? getStatusCode(result.code) : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    // Return settlement response
    return NextResponse.json(
      successResponse({
        data: {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          paymentId: result.paymentId,
          paymentAmount: result.paymentAmount,
          totalPaid: result.totalPaid,
          amountDue: result.amountDue,
          isFullyPaid: result.isFullyPaid,
          customer: result.customer,
          timestamp: new Date().toISOString(),
        },
        message: result.isFullyPaid
          ? 'Order fully paid - moving to processing'
          : 'Partial payment recorded',
      }),
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

