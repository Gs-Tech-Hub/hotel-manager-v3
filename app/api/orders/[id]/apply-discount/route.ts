import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/src/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { calculateDiscount } from '@/src/lib/price';
import { getMinorUnit } from '@/src/lib/currency';

interface Params {
  id: string;
}

/**
 * POST /api/orders/[id]/apply-discount
 * Apply a discount code to an existing order
 * 
 * Request body:
 * {
 *   code: string  // Discount code to apply
 * }
 * 
 * Response: Updated order with discount applied
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id: orderId } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'cashier'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to apply discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'code is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Fetch order with current state, including lines to check department/section applicability
    const order = await prisma.orderHeader.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            departmentSection: true,
          },
        },
        discounts: true,
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Order not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Find discount rule
    const rule = await (prisma as any).discountRule.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!rule) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount code not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    if (!rule.isActive) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code is inactive'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check time window
    const now = new Date();
    if (rule.startDate && now < rule.startDate) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Discount code is not yet active'
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (rule.endDate && now > rule.endDate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code has expired'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check department and section applicability
    const applicableDepts = JSON.parse(rule.applicableDepts || '[]') as string[];
    const applicableSections = JSON.parse(rule.applicableSections || '[]') as string[];

    if (applicableDepts.length > 0 || applicableSections.length > 0) {
      const orderDepts = new Set(order.lines.map(l => l.departmentCode));
      const orderSections = new Set(order.lines.map(l => l.departmentSectionId).filter(Boolean));

      // Check if at least one order line is in an applicable department/section
      let isApplicable = false;

      for (const line of order.lines) {
        const deptMatches = applicableDepts.length === 0 || applicableDepts.includes(line.departmentCode);
        const sectionMatches = applicableSections.length === 0 || (line.departmentSectionId && applicableSections.includes(line.departmentSectionId));

        if (deptMatches && (applicableSections.length === 0 || sectionMatches)) {
          isApplicable = true;
          break;
        }
      }

      if (!isApplicable) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'This discount code is not applicable to any items in this order'
          ),
          { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }
    }

    // Check minimum order amount
    if (rule.minOrderAmount && order.subtotal < rule.minOrderAmount) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Minimum order amount of ${(rule.minOrderAmount / 100).toFixed(2)} required`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check total usage limit
    if (rule.maxTotalUsage) {
      const usageCount = await prisma.orderDiscount.count({
        where: { discountRuleId: rule.id },
      });

      if (usageCount >= rule.maxTotalUsage) {
        return NextResponse.json(
          errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code usage limit exceeded'),
          { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }
    }

    // Check per-customer usage limit
    if (rule.maxUsagePerCustomer) {
      const customerUsageCount = await (prisma as any).orderDiscount.count({
        where: {
          discountRuleId: rule.id,
          orderHeader: { customerId: order.customerId },
        },
      });

      if (customerUsageCount >= rule.maxUsagePerCustomer) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.VALIDATION_ERROR,
            'You have reached the usage limit for this discount code'
          ),
          { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }
    }

    // Check if this code already applied to this order
    const alreadyApplied = order.discounts.find((d) => d.discountRuleId === rule.id);
    if (alreadyApplied) {
      return NextResponse.json(
        errorResponse(ErrorCodes.CONFLICT, 'This discount code is already applied to this order'),
        { status: getStatusCode(ErrorCodes.CONFLICT) }
      );
    }

    // Calculate discount amount using consistent currency handling
    // Get the minor unit for the discount's currency (e.g., 100 for USD cents)
    const minorUnit = getMinorUnit(rule.currency || 'USD');
    const discountAmount = calculateDiscount(
      order.subtotal,
      Number(rule.value),
      rule.type as 'percentage' | 'fixed',
      minorUnit
    );

    // Ensure discount doesn't exceed subtotal
    if (discountAmount > order.subtotal) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Discount cannot exceed order subtotal'
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Create OrderDiscount record
    const orderDiscount = await (prisma as any).orderDiscount.create({
      data: {
        orderHeaderId: orderId,
        discountRuleId: rule.id,
        discountType: rule.type,
        discountCode: rule.code,
        description: rule.description || rule.name,
        discountAmount,
      },
    });

    // Update order's discount total and final total
    const currentDiscountTotal = order.discountTotal + discountAmount;
    const newTotal = order.subtotal - currentDiscountTotal + order.tax;

    const updatedOrder = await (prisma as any).orderHeader.update({
      where: { id: orderId },
      data: {
        discountTotal: currentDiscountTotal,
        total: Math.max(0, newTotal), // Ensure total doesn't go negative
      },
      include: {
        lines: true,
        discounts: {
          include: {
            discountRule: true,
          },
        },
        customer: true,
      },
    });

    return NextResponse.json(
      successResponse({
        message: 'Discount applied successfully',
        order: updatedOrder,
        appliedDiscount: {
          ...orderDiscount,
          rule: {
            id: rule.id,
            code: rule.code,
            name: rule.name,
            type: rule.type,
            value: Number(rule.value),
            currency: rule.currency || 'USD',
          },
        },
      })
    );
  } catch (error) {
    console.error(`POST /api/orders/[id]/apply-discount error:`, error);
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
  { params }: { params: Promise<Params> }
) {
  try {
    const { id: orderId } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Fetch order
    const order = await prisma.orderHeader.findUnique({
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
        totalDiscountAmount: discounts.reduce((sum: any, d: any) => sum + d.discountAmount, 0),
      })
    );
  } catch (error) {
    console.error(`GET /api/orders/[id]/discounts error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discounts'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
