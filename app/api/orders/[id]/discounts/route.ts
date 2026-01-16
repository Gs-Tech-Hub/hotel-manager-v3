/**
 * Order Discounts API Routes
 * 
 * POST   /api/orders/[id]/discounts - Apply discount to order
 * DELETE /api/orders/[id]/discounts/[discountId] - Remove discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { OrderService } from '@/services/order.service';
import { DiscountService } from '@/services/discount.service';

/**
 * POST /api/orders/[id]/discounts
 * Apply a discount to an order
 * 
 * Request body:
 * {
 *   discountCode: string | null  // Promo code or discount rule ID
 *   discountRuleId?: string
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only staff can apply discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { discountCode, discountRuleId } = body;

    if (!discountCode && !discountRuleId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'discountCode or discountRuleId is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
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

    // Prevent applying discounts to cancelled or refunded orders
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, `Cannot apply discounts to a ${order.status} order`),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Get discount rule - use case-insensitive search for code
    const discountService = new DiscountService();
    let rule;
    
    if (discountRuleId) {
      rule = await (prisma as any).discountRule.findUnique({ where: { id: discountRuleId } });
    } else {
      // Try exact match first
      rule = await (prisma as any).discountRule.findUnique({ where: { code: discountCode } });
      
      // If not found, try case-insensitive search
      if (!rule) {
        const results = await (prisma as any).discountRule.findMany({
          where: {
            code: {
              equals: discountCode,
              mode: 'insensitive'
            }
          },
          take: 1
        });
        rule = results?.length > 0 ? results[0] : null;
      }
    }

    if (!rule) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount rule not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Validate discount code
    const validation = await discountService.validateDiscountCode(rule.code, order.total, order.customerId);
    if (!validation.valid) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, validation.error || 'Invalid discount'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Apply discount using OrderService
    const orderService = new OrderService();
    const result = await orderService.applyDiscount(
      orderId,
      {
        discountCode: rule.code,
        discountType: rule.type as any,
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
      successResponse(result, 'Discount applied successfully')
    );
  } catch (error) {
    console.error('POST /api/orders/[id]/discounts error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to apply discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

// DELETE moved to nested route: app/api/orders/[id]/discounts/[discountId]/route.ts
