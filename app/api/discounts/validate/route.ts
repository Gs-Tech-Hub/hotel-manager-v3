/**
 * Discount Validation API
 * 
 * GET /api/discounts/validate?code=X&subtotal=Y&deptCode=Z - Quick validation for checkout
 * POST /api/discounts/validate - Full validation with order details
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/discounts/validate
 * Quick validation of discount code during checkout
 * 
 * Query params:
 * - code: string              // Discount code to validate
 * - subtotal: number          // Order subtotal in cents
 * - deptCode?: string         // Department code (check if applicable)
 * 
 * Response (on success):
 * {
 *   success: true
 *   data: {
 *     id: string
 *     code: string
 *     name: string
 *     type: 'percentage' | 'fixed' | 'tiered'
 *     value: number
 *     description: string
 *     minorUnit: number (e.g., 100 for USD cents)
 *   }
 * }
 * 
 * Response (on invalid):
 * {
 *   success: false
 *   error: { message: string }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const subtotalStr = request.nextUrl.searchParams.get('subtotal');
    const deptCode = request.nextUrl.searchParams.get('deptCode');

    // Validate required fields
    if (!code) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'code is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const subtotal = subtotalStr ? parseInt(subtotalStr, 10) : null;
    if (subtotal === null || subtotal < 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'subtotal must be provided and non-negative'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Find discount rule by ID first (new system), then by code (backwards compatibility)
    let rule = await (prisma as any).discountRule.findUnique({
      where: { id: code },
    });

    if (!rule) {
      // Try to find by code
      rule = await (prisma as any).discountRule.findUnique({
        where: { code },
      });
    }

    if (!rule) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Check if active
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
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code is not yet active'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (rule.endDate && now > rule.endDate) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code has expired'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check minimum order amount
    if (rule.minOrderAmount && subtotal < rule.minOrderAmount) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, `Minimum order amount of ${(rule.minOrderAmount / 100).toFixed(2)} required`),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check department applicability
    if (deptCode) {
      const applicableDepts = JSON.parse(rule.applicableDepts || '[]') as string[];
      if (applicableDepts.length > 0 && !applicableDepts.includes(deptCode)) {
        return NextResponse.json(
          errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code is not applicable to this department'),
          { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }
    }

    // Check usage limits (basic check without customer context)
    if (rule.maxTotalUsage) {
      const usageCount = await (prisma as any).orderDiscount.count({
        where: { discountRuleId: rule.id },
      });

      if (usageCount >= rule.maxTotalUsage) {
        return NextResponse.json(
          errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount code usage limit exceeded'),
          { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
        );
      }
    }

    // Return valid discount
    return NextResponse.json(
      successResponse({
        data: {
        id: rule.id,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        type: rule.type,
        value: Number(rule.value),
        applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
        applicableSections: JSON.parse(rule.applicableSections || '[]'),
        minorUnit: 100, // USD always uses cents
      }
    })
    );
  } catch (error) {
    console.error('GET /api/discounts/validate error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to validate discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * POST /api/discounts/validate
 * Validate a discount code for use on an order
 * 
 * Request body:
 * {
 *   code: string              // Discount code to validate
 *   orderTotal: number        // Order total in cents
 *   customerId: string        // Customer ID to check per-customer limits
 *   departmentCode?: string   // Department code (check if applicable)
 * }
 * 
 * Response (on success):
 * {
 *   valid: true
 *   rule: {
 *     id: string
 *     code: string
 *     name: string
 *     type: string
 *     value: number
 *     discountAmount: number  // Calculated discount in cents
 *     ...
 *   }
 *   discountAmount: number    // Discount to apply in cents
 * }
 * 
 * Response (on invalid):
 * {
 *   valid: false
 *   error: string             // Reason why code is invalid
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication is optional for public discount codes, but preferred for tracking
    const ctx = await extractUserContext(request);

    const body = await request.json();
    const { code, orderTotal, customerId, departmentCode } = body;

    // Validate required fields
    if (!code) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'code is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (orderTotal === undefined || orderTotal < 0) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'orderTotal must be provided and non-negative'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'customerId is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Find discount rule
    const rule = await (prisma as any).discountRule.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!rule) {
      return NextResponse.json(
        successResponse({
          data: {
          valid: false,
          error: 'Discount code not found',
        }})
      );
    }

    // Check if active
    if (!rule.isActive) {
      return NextResponse.json(
        successResponse({
          data: {
          valid: false,
          error: 'Discount code is inactive',
        }})
      );
    }

    // Check time window
    const now = new Date();
    if (rule.startDate && now < rule.startDate) {
      return NextResponse.json(
        successResponse({
          data: {
          valid: false,
          error: 'Discount code is not yet active',
        }})
      );
    }

    if (rule.endDate && now > rule.endDate) {
      return NextResponse.json(
        successResponse({
          data: {
          valid: false,
          error: 'Discount code has expired',
        }})
      );
    }

    // Check minimum order amount
    if (rule.minOrderAmount && orderTotal < rule.minOrderAmount) {
      return NextResponse.json(
        successResponse({
          data: {
          valid: false,
          error: `Minimum order amount of ${(rule.minOrderAmount / 100).toFixed(2)} required`,
        }})
      );
    }

    // Check department applicability
    if (departmentCode) {
      const applicableDepts = JSON.parse(rule.applicableDepts || '[]') as string[];
      if (applicableDepts.length > 0 && !applicableDepts.includes(departmentCode)) {
        return NextResponse.json(
          successResponse({
            data: {
            valid: false,
            error: 'Discount code is not applicable to this department',
          }})
        );
      }
    }

    // Check total usage limit
    if (rule.maxTotalUsage) {
      const usageCount = await (prisma as any).orderDiscount.count({
        where: { discountRuleId: rule.id },
      });

      if (usageCount >= rule.maxTotalUsage) {
        return NextResponse.json(
          successResponse({
            data: { 
            valid: false,
            error: 'Discount code usage limit exceeded',
          }
        })
        );
      }
    }

    // Check per-customer usage limit
    if (rule.maxUsagePerCustomer) {
      const customerUsageCount = await (prisma as any).orderDiscount.count({
        where: {
          discountRuleId: rule.id,
          orderHeader: {
            customerId,
          },
        },
      });

      if (customerUsageCount >= rule.maxUsagePerCustomer) {
        return NextResponse.json(
          successResponse({
            data: { 
            valid: false,
            error: 'You have reached the usage limit for this discount code',
          }
        })
        );
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (rule.type === 'percentage') {
      discountAmount = Math.round(orderTotal * (Number(rule.value) / 100));
    } else if (rule.type === 'fixed') {
      // Fixed amount discount, don't exceed order total
      discountAmount = Math.min(Number(rule.value), orderTotal);
    } else if (rule.type === 'tiered') {
      // Tiered: calculate based on order amount brackets
      // For now, use value as percentage
      discountAmount = Math.round(orderTotal * (Number(rule.value) / 100));
    }

    // Return valid discount
    return NextResponse.json(
      successResponse({
        data: {
        valid: true,
        rule: {
          id: rule.id,
          code: rule.code,
          name: rule.name,
          description: rule.description,
          type: rule.type,
          value: Number(rule.value),
          applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
        },
        discountAmount,
      }})
    );
  } catch (error) {
    console.error('POST /api/discounts/validate error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to validate discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

