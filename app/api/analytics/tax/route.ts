/**
 * Tax Report API
 * Provides comprehensive tax collection analytics
 * 
 * GET /api/analytics/tax?startDate=2024-01-01&endDate=2024-12-31
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/lib/date-filter';

export async function GET(request: NextRequest) {
  try {
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

    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canViewReports = await checkPermission(permCtx, 'reports.read', 'reports');
    if (!canViewReports) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch orders with tax collected - use OrderHeader model
    const orders = await prisma.orderHeader.findMany({
      where: {
        ...dateFilter,
        tax: { gt: 0 }, // Only orders with tax > 0
      },
      include: {
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const taxSettings = await prisma.taxSettings.findFirst();

    // Calculate tax breakdown
    const taxByPaymentMethod = new Map<string, { count: number; subtotal: number; taxAmount: number }>();
    const dailyTax = new Map<string, { collected: number; baseAmount: number; orderCount: number }>();
    let totalTaxCollected = 0;
    let totalTaxableAmount = 0;

    orders.forEach((order: any) => {
      const date = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const paymentMethod = (order.payments && order.payments.length > 0) ? (order.payments[0].paymentMethod || 'Unknown') : 'Unknown';
      const taxAmount = order.tax || 0;
      const subtotal = order.subtotal || 0;

      totalTaxCollected += taxAmount;
      totalTaxableAmount += subtotal;

      // By payment method
      if (!taxByPaymentMethod.has(paymentMethod)) {
        taxByPaymentMethod.set(paymentMethod, { count: 0, subtotal: 0, taxAmount: 0 });
      }
      const methodData = taxByPaymentMethod.get(paymentMethod)!;
      methodData.count += 1;
      methodData.subtotal += subtotal;
      methodData.taxAmount += taxAmount;

      // Daily tax
      if (!dailyTax.has(date)) {
        dailyTax.set(date, { collected: 0, baseAmount: 0, orderCount: 0 });
      }
      const dayData = dailyTax.get(date)!;
      dayData.collected += taxAmount;
      dayData.baseAmount += subtotal;
      dayData.orderCount += 1;
    });

    const effectiveTaxRate = totalTaxableAmount > 0 ? (totalTaxCollected / totalTaxableAmount) * 100 : 0;

    const report = {
      summary: {
        totalTaxCollected,
        totalTaxableAmount,
        effectiveTaxRate: parseFloat(effectiveTaxRate.toFixed(2)),
        orderCount: orders.length,
        averageTaxPerOrder: orders.length > 0 ? Math.round(totalTaxCollected / orders.length) : 0,
        taxRate: taxSettings?.taxRate || 0,
      },
      byPaymentMethod: Array.from(taxByPaymentMethod.entries()).map(([method, data]) => ({
        method,
        count: data.count,
        subtotal: data.subtotal,
        taxAmount: data.taxAmount,
        effectiveRate: data.subtotal > 0 ? parseFloat(((data.taxAmount / data.subtotal) * 100).toFixed(2)) : 0,
      })),
      dailyTax: Array.from(dailyTax.entries()).map(([date, data]) => ({
        date,
        collected: data.collected,
        baseAmount: data.baseAmount,
        orderCount: data.orderCount,
        rate: data.baseAmount > 0 ? parseFloat(((data.collected / data.baseAmount) * 100).toFixed(2)) : 0,
      })),
      taxSettings: taxSettings ? {
        taxRate: taxSettings.taxRate,
        isEnabled: taxSettings.enabled,
      } : null,
      orderDetails: orders
        .map((o: any) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          subtotal: o.subtotal,
          taxAmount: o.tax,
          total: o.total,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt,
        }))
        .slice(0, 100), // Limit to last 100 for performance
    };

    return NextResponse.json(
      successResponse({ data: report }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Tax report error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate tax report'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
