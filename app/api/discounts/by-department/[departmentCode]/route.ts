/**
 * Discount Discovery API Routes
 * 
 * GET /api/discounts/by-department/[departmentCode] - Get discounts for a department
 * GET /api/discounts/by-type/[type]                - Get discounts by type
 * GET /api/discounts/upcoming                      - Get upcoming/active discounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

interface Params {
  departmentCode?: string;
  type?: string;
}

/**
 * GET /api/discounts/by-department/[departmentCode]
 * Get all active discounts applicable to a specific department and optional section
 * 
 * Query parameters:
 * - sectionId?: string (filter by section within department)
 * - includeInactive?: boolean (include inactive discounts)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const ctx = await extractUserContext(request);

    // Allow unauthenticated access for discount discovery (customers need to see available discounts)
    // but you could also require authentication if preferred
    
    const { departmentCode } = await params;

    if (!departmentCode) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, 'departmentCode is required'),
        { status: getStatusCode(ErrorCodes.VALIDATION_ERROR) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const sectionId = searchParams.get('sectionId') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const now = new Date();

    // Find all discounts applicable to this department
    const allRules = await (prisma as any).discountRule.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
      },
    });

    if (!Array.isArray(allRules)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INTERNAL_ERROR, 'Invalid response from database'),
        { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
      );
    }

    // Filter for those applicable to this department and section
    const applicable = allRules.filter((rule: any) => {
      const applicableDepts = JSON.parse(rule.applicableDepts || '[]') as string[];
      const applicableSections = JSON.parse(rule.applicableSections || '[]') as string[];

      // Check department applicability
      const deptMatch = applicableDepts.length === 0 || applicableDepts.includes(departmentCode);
      if (!deptMatch) return false;

      // If sectionId is provided, check section applicability
      if (sectionId) {
        // If sections are specified, sectionId must match
        // If no sections specified, discount applies to all sections in the department
        const sectionMatch = applicableSections.length === 0 || applicableSections.includes(sectionId);
        return sectionMatch;
      }

      // If no sectionId query param, return all discounts for the department
      return true;
    });

    // Filter for active time window if not including inactive
    const active = !includeInactive
      ? applicable.filter((rule: any) => {
          if (rule.startDate && now < rule.startDate) return false;
          if (rule.endDate && now > rule.endDate) return false;
          return true;
        })
      : applicable;

    const discounts = active.map((rule: any) => ({
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
      currency: rule.currency,
      applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
      applicableSections: JSON.parse(rule.applicableSections || '[]'),
    }));

    return NextResponse.json(
      successResponse({
        data: {
          departmentCode,
          ...(sectionId && { sectionId }),
          discounts,
          count: discounts.length,
        },
      })
    );
  } catch (error) {
    console.error(`GET /api/discounts/by-department/[departmentCode] error:`, error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch discounts'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
