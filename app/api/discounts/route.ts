/**
 * Discount Rule Management API Routes
 * 
 * GET  /api/discounts             - List discount rules
 * POST /api/discounts             - Create discount rule
 * GET  /api/discounts/[id]       - Get discount rule details
 * PUT  /api/discounts/[id]       - Update discount rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/src/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * POST /api/discounts
 * Create a new discount rule
 * 
 * Request body:
 * {
 *   code: string              // Unique discount code
 *   name?: string             // Discount name
 *   type: "percentage" | "fixed" | "tiered" | "employee" | "bulk"
 *   value: number             // Discount value (percentage: 0-100, fixed: amount in cents)
 *   description?: string
 *   startDate: ISO string     // When discount becomes active
 *   endDate?: ISO string      // When discount expires (optional)
 *   minOrderAmount?: number   // Minimum order amount to apply (in cents)
 *   maxUsageTotal?: number    // Total usage limit (optional)
 *   maxUsagePerCustomer?: number // Usage limit per customer (optional)
 *   applicableDepts?: string[] // Department codes (optional, all if not specified)
 *   applicableSections?: string[] // Section IDs (optional, all if not specified)
 *   currency?: string         // Currency code (default: USD)
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
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admins/managers can create discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      code,
      name,
      type,
      value,
      description,
      startDate,
      endDate,
      minOrderAmount,
      maxUsagePerCustomer,
      applicableDepts,
      applicableSections,
      currency,
    } = body;

    // Validate required fields
    if (!code || !type || value === undefined || !startDate) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'code, type, value, and startDate are required'
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Validate type
    const validTypes = ['percentage', 'fixed', 'tiered', 'employee', 'bulk'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          `type must be one of: ${validTypes.join(', ')}`
        ),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Check if code already exists
    const existing = await (prisma as any).discountRule.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.RESOURCE_ALREADY_EXISTS, `Discount code '${code}' already exists`),
        { status: getStatusCode(ErrorCodes.RESOURCE_ALREADY_EXISTS) }
      );
    }

    // Create discount rule
    const rule = await (prisma as any).discountRule.create({
      data: {
        code,
        name,
        type,
        value,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        minOrderAmount: minOrderAmount || 0,
        maxUsagePerCustomer,
        applicableDepts: applicableDepts ? JSON.stringify(applicableDepts) : JSON.stringify([]),
        applicableSections: applicableSections ? JSON.stringify(applicableSections) : JSON.stringify([]),
        currency: currency || 'USD',
        isActive: true,
      },
    });

    return NextResponse.json(
      successResponse(rule, 'Discount rule created successfully'),
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/discounts error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create discount rule'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * GET /api/discounts
 * List discount rules with filtering
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - isActive: boolean (filter active/inactive)
 * - type: string (filter by type)
 * - search: string (search code or name)
 */
export async function GET(request: NextRequest) {
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
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin', 'manager', 'staff'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const isActive = searchParams.get('isActive');
    const type = searchParams.get('type') || undefined;
    const search = searchParams.get('search') || undefined;

    // Build filters
    const filters: any = {};
    if (isActive !== null) {
      filters.isActive = isActive === 'true';
    }
    if (type) {
      filters.type = type;
    }
    if (search) {
      filters.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Query rules
    const skip = (page - 1) * limit;
    const [rules, total] = await Promise.all([
      (prisma as any).discountRule.findMany({
        where: filters,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).discountRule.count({ where: filters }),
    ]);

    // Parse applicableDepts and applicableSections JSON
    const rulesWithMetadata = rules.map((rule: any) => ({
      ...rule,
      applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
      applicableSections: JSON.parse(rule.applicableSections || '[]'),
    }));

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      successResponse({
        rules: rulesWithMetadata,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
      })
    );
  } catch (error) {
    console.error('GET /api/discounts error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discount rules'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

/**
 * DELETE /api/discounts/:id
 * Delete/deactivate a discount rule (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
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
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admins/managers can delete discounts'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Extract ID from URL path
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();

    if (!id || id === 'route.ts') {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'Discount ID is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    // Soft delete by marking as inactive
    const discount = await (prisma as any).discountRule.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(successResponse(discount));
  } catch (error) {
    console.error('DELETE /api/discounts error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete discount'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

// NOTE: The GET_ACTIVE handler was moved to `app/api/discounts/active/route.ts`
// to comply with Next.js App Router route handler conventions (each HTTP method
// must be exported as GET/POST/etc. from the route file). Keeping the function
// here would add non-standard exports and break Next.js type checks.

