/**
 * Discounts by Type API
 * 
 * GET /api/discounts/by-type/[type] - Get discounts of a specific type
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/src/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

interface Params {
  type: string;
}

/**
 * GET /api/discounts/by-type/[type]
 * Get all discounts of a specific type
 * 
 * Valid types: percentage, fixed, tiered, employee, bulk
 * 
 * Query parameters:
 * - isActive?: boolean (filter by active status)
 * - page?: number
 * - limit?: number
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const ctx = await extractUserContext(request);
    const { type } = await params;

    if (!type) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'type is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const validTypes = ['percentage', 'fixed', 'tiered', 'employee', 'bulk'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `Invalid type. Valid types: ${validTypes.join(', ')}`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const where: any = { type };
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const [rules, total] = await Promise.all([
      (prisma as any).discountRule.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      (prisma as any).discountRule.count({ where }),
    ]);

    const discounts = rules.map((rule: any) => ({
      id: rule.id,
      code: rule.code,
      name: rule.name,
      description: rule.description,
      type: rule.type,
      value: Number(rule.value),
      minOrderAmount: rule.minOrderAmount,
      maxUsagePerCustomer: rule.maxUsagePerCustomer,
      maxTotalUsage: rule.maxTotalUsage,
      currentUsage: rule.currentUsage,
      startDate: rule.startDate,
      endDate: rule.endDate,
      isActive: rule.isActive,
      applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
    }));

    return NextResponse.json(
      successResponse({
        type,
        discounts,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    console.error(`GET /api/discounts/by-type/[type] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discounts'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
