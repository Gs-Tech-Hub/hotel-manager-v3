/**
 * Order Discounts API Routes
 * 
 * POST   /api/orders/[id]/discounts - Apply discount to order
 * GET    /api/orders/[id]/discounts - Get all discounts applied to order
 * DELETE /api/orders/[id]/discounts/[discountId] - Remove discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
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
    console.log('[DISCOUNT API] POST /api/orders/' + orderId + '/discounts - Apply discount request received');

    // Get user context
    const ctx = await extractUserContext(request);
    console.log('[DISCOUNT API] User context extracted:', { userId: ctx.userId });
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
        errorResponse(ErrorCodes.FORBIDDEN, 'User not found'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permission to apply discounts
    const permCtx: PermissionContext = {
      userId: ctx.userId!,
      userType: (userWithRoles.userType as 'admin' | 'employee' | 'other') || 'employee',
      departmentId: null,
    };
    const canApplyDiscount = await checkPermission(permCtx, 'discounts.apply', 'discounts');
    if (!canApplyDiscount) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to apply discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { discountCode, discountRuleId } = body;
    console.log('[DISCOUNT API] Request body:', { discountCode, discountRuleId });

    if (!discountCode && !discountRuleId) {
      console.log('[DISCOUNT API] ❌ Validation failed: neither discountCode nor discountRuleId provided');
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'discountCode or discountRuleId is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Fetch order
    console.log('[DISCOUNT API] Fetching order:', orderId);
    const order = await (prisma as any).orderHeader.findUnique({
      where: { id: orderId },
      include: {
        discounts: true,
        lines: true,
      },
    });
    console.log('[DISCOUNT API] Order retrieved:', { id: order?.id, subtotal: order?.subtotal, total: order?.total, status: order?.status, discountCount: order?.discounts?.length });

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
    console.log('[DISCOUNT API] Looking up discount rule:', { byId: !!discountRuleId, byCode: !!discountCode });
    const discountService = new DiscountService();
    let rule;
    
    if (discountRuleId) {
      console.log('[DISCOUNT API] Searching by ID:', discountRuleId);
      rule = await (prisma as any).discountRule.findUnique({ where: { id: discountRuleId } });
    } else {
      // Try exact match first
      console.log('[DISCOUNT API] Searching by code (exact):', discountCode);
      rule = await (prisma as any).discountRule.findUnique({ where: { code: discountCode } });
      
      // If not found, try case-insensitive search
      if (!rule) {
        console.log('[DISCOUNT API] Exact match not found, trying case-insensitive...');
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
      console.error('[DISCOUNT API] ❌ Discount rule not found:', { discountCode, discountRuleId });
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount rule not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }
    console.log('[DISCOUNT API] ✅ Discount rule found:', { id: rule.id, code: rule.code, type: rule.type, value: rule.value, isActive: rule.isActive });

    // Validate discount code
    console.log('[DISCOUNT API] Validating discount with validation service...');
    const validation = await discountService.validateDiscountCode(rule.code, order.total, order.customerId);
    console.log('[DISCOUNT API] Validation result:', { valid: validation.valid, error: validation.error });
    if (!validation.valid) {
      console.warn('[DISCOUNT API] ❌ Validation failed:', validation.error);
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, validation.error || 'Invalid discount'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Apply discount using OrderService
    console.log('[DISCOUNT API] Calling OrderService.applyDiscount...');
    const orderService = new OrderService();
    const result = await orderService.applyDiscount(
      orderId,
      {
        discountCode: rule.code,
        discountType: rule.type as any,
      },
      userWithRoles
    );
    console.log('[DISCOUNT API] OrderService.applyDiscount returned:', { success: !('error' in result), result });

    // Check if result is error response
    if ('error' in result && typeof result.error === 'object' && result.error !== null && 'code' in result.error) {
      console.error('[DISCOUNT API] ❌ Error from OrderService:', result);
      return NextResponse.json(
        result,
        { status: getStatusCode((result.error as any).code) }
      );
    }

    console.log('[DISCOUNT API] ✅ Discount applied successfully for order:', orderId);
    return NextResponse.json(
      successResponse({data : result, message : 'Discount applied successfully'})
    );
  } catch (error) {
    console.error('[DISCOUNT API] ❌ POST /api/orders/[id]/discounts error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to apply discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * GET /api/orders/[id]/discounts
 * Get all discounts applied to an order
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
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

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

    // Fetch discounts
    const discounts = await (prisma as any).orderDiscount.findMany({
      where: { orderHeaderId: orderId },
      include: {
        discountRule: true,
      },
      orderBy: { appliedAt: 'asc' },
    });

    return NextResponse.json(
      successResponse({
        data: {
          orderId,
          discounts: discounts.map((d: any) => ({
            id: d.id,
            code: d.discountCode,
            type: d.discountType,
            amount: d.discountAmount,
            description: d.description,
            appliedAt: d.appliedAt,
            rule: d.discountRule
              ? {
                  id: d.discountRule.id,
                  code: d.discountRule.code,
                  name: d.discountRule.name,
                }
              : null,
          })),
          totalDiscountAmount: discounts.reduce((sum: number, d: any) => sum + d.discountAmount, 0),
        },
      })
    );
  } catch (error) {
    console.error('GET /api/orders/[id]/discounts error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discounts'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

// DELETE moved to nested route: app/api/orders/[id]/discounts/[discountId]/route.ts
