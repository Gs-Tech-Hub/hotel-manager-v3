/**
 * Individual Discount Rule API Routes
 * 
 * GET    /api/discounts/[id]  - Get single discount rule
 * PUT    /api/discounts/[id]  - Update discount rule
 * DELETE /api/discounts/[id]  - Delete discount rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

interface Params {
  id: string;
}

/**
 * GET /api/discounts/[id]
 * Get single discount rule details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    
    // Allow unauthenticated access for discount details (customers need to view discount info)
    // This is similar to /api/discounts/by-department which allows public discovery

    const rule = await (prisma as any).discountRule.findUnique({
      where: { id },
    });

    if (!rule) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount rule not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    return NextResponse.json(
      successResponse({
        data: {
          ...rule,
          applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
        },
      })
    );
  } catch (error) {
    console.error(`GET /api/discounts/[id] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * PUT /api/discounts/[id]
 * Update discount rule
 * 
 * Request body:
 * {
 *   name?: string
 *   description?: string
 *   type?: "percentage" | "fixed" | "tiered"
 *   value?: number                   // Discount value
 *                                    // - Percentage: 0-100 (e.g., 20 for 20% off)
 *                                    // - Fixed: dollars in minor units (e.g., 2000 for $20.00)
 *   minOrderAmount?: number          // Minimum order amount (in expanded minor units)
 *   maxUsagePerCustomer?: number
 *   maxTotalUsage?: number
 *   applicableDepts?: string[]
 *   startDate?: ISO8601 date
 *   endDate?: ISO8601 date
 *   isActive?: boolean
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admins and managers can update discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check if discount exists
    const existing = await (prisma as any).discountRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount rule not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      type,
      value,
      minOrderAmount,
      maxUsagePerCustomer,
      maxTotalUsage,
      applicableDepts,
      startDate,
      endDate,
      isActive,
    } = body;

    // Validate type if provided
    if (type && !['percentage', 'fixed', 'tiered'].includes(type)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid discount type'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Validate value range if provided
    if (value !== undefined && (value < 0 || (type === 'percentage' && value > 100))) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Invalid discount value'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Update discount rule
    const updated = await (prisma as any).discountRule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(type && { type }),
        ...(value !== undefined && { value }),
        ...(minOrderAmount !== undefined && { minOrderAmount }),
        ...(maxUsagePerCustomer !== undefined && { maxUsagePerCustomer }),
        ...(maxTotalUsage !== undefined && { maxTotalUsage }),
        ...(applicableDepts && { applicableDepts: JSON.stringify(applicableDepts) }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(
      successResponse({
        ...updated,
        applicableDepts: JSON.parse(updated.applicableDepts || '[]'),
      })
    );
  } catch (error) {
    console.error(`PUT /api/discounts/[id] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/discounts/[id]
 * Deactivate a discount rule (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const ctx = await extractUserContext(request);

    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admins and managers can delete discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check if discount exists
    const existing = await (prisma as any).discountRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'Discount rule not found'),
        { status: getStatusCode(ErrorCodes.NOT_FOUND) }
      );
    }

    // Soft delete by marking as inactive
    const deleted = await (prisma as any).discountRule.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(
      successResponse({
        message: 'Discount rule deactivated',
        data: {
          ...deleted,
          applicableDepts: JSON.parse(deleted.applicableDepts || '[]'),
        },
      })
    );
  } catch (error) {
    console.error(`DELETE /api/discounts/[id] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
