/**
 * Tax Collections Report API
 * GET /api/admin/tax-collections - Get tax collections with optional date filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/lib/date-filter';

export async function GET(request: NextRequest) {
  try {
    // Extract user context and verify authentication
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'Not authenticated'),
        { status: getStatusCode(ErrorCodes.UNAUTHORIZED) }
      );
    }

    // Check admin role
    const userWithRoles = await loadUserWithRoles(ctx.userId);
    if (!userWithRoles || !hasAnyRole(userWithRoles, ['admin'])) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Only admins can view tax collections'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Get query parameters for date filtering
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    // Build date filter
    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch orders with tax collection data
    // Only include orders where tax > 0 (tax was applied)
    const orders = await prisma.orderHeader.findMany({
      where: {
        tax: { gt: 0 }, // Only orders with tax > 0
        createdAt: dateFilter,
      },
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        tax: true,
        total: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get tax settings to determine the rate used
    let taxRate = 10; // default
    try {
      const taxSettings = await (prisma as any).taxSettings.findFirst();
      if (taxSettings) {
        taxRate = taxSettings.taxRate ?? 10;
      }
    } catch (err) {
      console.warn('Could not fetch tax rate:', err);
    }

    // Transform orders to tax collections format
    const collections = orders.map(order => ({
      orderNumber: order.orderNumber,
      orderDate: order.createdAt.toISOString(),
      subtotal: order.subtotal,
      taxRate,
      taxAmount: order.tax,
      total: order.total,
      paymentStatus: order.paymentStatus || 'unpaid',
    }));

    // Calculate total tax collected
    const totalTaxCollected = collections.reduce((sum, c) => sum + c.taxAmount, 0);

    return NextResponse.json(
      successResponse({
        data: {
          collections,
          totalTaxCollected,
          orderCount: collections.length,
          dateRange: {
            startDate,
            endDate,
          },
        },
        message: `Retrieved ${collections.length} tax collections`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching tax collections:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch tax collections'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
