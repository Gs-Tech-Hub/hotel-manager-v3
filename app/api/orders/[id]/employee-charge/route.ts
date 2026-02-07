/**
 * Employee Order Charge API
 * 
 * POST /api/orders/[id]/employee-charge
 * Charge an employee for order with employee discount
 * Skips payment processing - charge deducted from salary
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';

interface ChargeEmployeeRequest {
  employeeId: string; // Employee user ID to charge
}

/**
 * POST /api/orders/[id]/employee-charge
 * Apply employee charge and skip payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const ctx = await extractUserContext(request);

    // Verify authentication
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Verify authorization (staff/manager can charge employees)
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles?.roles?.some((r: any) => ['admin', 'manager', 'staff'].includes(r.code))) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body: ChargeEmployeeRequest = await request.json();
    if (!body.employeeId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'employeeId is required'),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    // Get order
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        discounts: { include: { discountRule: true } },
        lines: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if order has employee discount applied
    const employeeDiscount = order.discounts?.find(
      (d: any) => d.discountRule?.type === 'employee'
    );

    if (!employeeDiscount) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.BAD_REQUEST,
          'Order does not have employee discount applied'
        ),
        { status: getStatusCode(ErrorCodes.BAD_REQUEST) }
      );
    }

    // Convert order total from cents to dollars
    const chargeAmount = order.total / 100;

    console.log('[CHARGE EMPLOYEE API] Charging employee:', {
      orderId,
      employeeId: body.employeeId,
      chargeAmount,
      orderNumber: order.orderNumber,
    });

    // Call service to charge employee
    const orderService = new OrderService();
    const result = await orderService.chargeEmployeeForOrder(
      orderId,
      body.employeeId,
      chargeAmount,
      order.orderNumber,
      ctx
    );

    // Handle errors from service
    if ('error' in result && result.error) {
      return NextResponse.json(
        result,
        { status: getStatusCode((result as any).error?.code || ErrorCodes.INTERNAL_ERROR) }
      );
    }

    console.log('[CHARGE EMPLOYEE API] ✅ Employee charged successfully');

    return NextResponse.json(
      successResponse({
        data: {
          chargeId: (result as any).chargeId,
          employee: {
            id: body.employeeId,
            name: (result as any).employeeName,
            email: (result as any).employeeEmail,
          },
          charge: {
            amount: (result as any).chargeAmount,
            orderNumber: order.orderNumber,
            type: 'employee_order',
          },
        },
      }),
      { status: 201 }
    );

  } catch (error) {
    console.error('[CHARGE EMPLOYEE API] Error:', error);
    if (error instanceof Error) {
      console.error('[CHARGE EMPLOYEE API] Stack:', error.stack);
    }
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to charge employee'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
