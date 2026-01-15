/**
 * Upcoming/Active Discounts API
 * 
 * GET /api/discounts/upcoming - Get upcoming and currently active discounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext } from '@/src/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';

/**
 * GET /api/discounts/upcoming
 * Get discounts that are upcoming (starting soon) or currently active
 * 
 * Query parameters:
 * - daysAhead?: number (look ahead N days for upcoming discounts, default 7)
 * - departmentCode?: string (filter by department)
 * - type?: string (filter by type)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await extractUserContext(request);

    const searchParams = request.nextUrl.searchParams;
    const daysAhead = parseInt(searchParams.get('daysAhead') || '7', 10);
    const departmentCode = searchParams.get('departmentCode') || null;
    const type = searchParams.get('type') || null;

    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // Find discounts that are:
    // - Currently active (startDate <= now AND (endDate >= now OR endDate is null))
    // - OR Upcoming (startDate > now AND startDate <= futureDate AND isActive)
    const rules = await (prisma as any).discountRule.findMany({
      where: {
        isActive: true,
        OR: [
          // Currently active
          {
            AND: [
              { startDate: { lte: now } },
              { OR: [{ endDate: { gte: now } }, { endDate: null }] },
            ],
          },
          // Upcoming
          {
            AND: [{ startDate: { gt: now } }, { startDate: { lte: futureDate } }],
          },
        ],
        // Apply optional filters
        ...(type && { type }),
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    });

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INTERNAL_ERROR, 'Invalid response from database'),
        { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
      );
    }

    // Filter by department if provided
    let filtered = rules;
    if (departmentCode) {
      filtered = rules.filter((rule: any) => {
        const applicableDepts = JSON.parse(rule.applicableDepts || '[]') as string[];
        return applicableDepts.length === 0 || applicableDepts.includes(departmentCode);
      });
    }

    // Categorize by status
    const active = filtered.filter((rule: any) => rule.startDate! <= now);
    const upcoming = filtered.filter((rule: any) => rule.startDate! > now);

    const formatDiscount = (rule: any) => ({
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
      applicableDepts: JSON.parse(rule.applicableDepts || '[]'),
    });

    return NextResponse.json(
      successResponse({
        active: active.map(formatDiscount),
        upcoming: upcoming.map(formatDiscount),
        metadata: {
          lookAheadDays: daysAhead,
          departmentFilter: departmentCode,
          typeFilter: type,
          totalActive: active.length,
          totalUpcoming: upcoming.length,
          asOf: now.toISOString(),
        },
      })
    );
  } catch (error) {
    console.error('GET /api/discounts/upcoming error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch upcoming discounts'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

