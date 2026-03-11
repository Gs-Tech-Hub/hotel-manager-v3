/**
 * Sales Report API
 * Provides detailed sales analytics with filtering
 * 
 * GET /api/analytics/sales?startDate=2024-01-01&endDate=2024-12-31&department=kitchen&format=json
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
    const department = searchParams.get('department');
    const timezone = searchParams.get('timezone') || 'UTC';

    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch orders with detailed breakdown - use OrderHeader model
    const orders = await prisma.orderHeader.findMany({
      where: {
        ...dateFilter,
        ...(department && { departmentCode: department }),
      },
      include: {
        lines: true,
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Detailed sales breakdown
    const salesByHour = new Map<number, { orders: number; revenue: number; items: number }>();
    const salesByDay = new Map<string, { orders: number; revenue: number; items: number }>();
    const salesByPaymentMethod = new Map<string, { count: number; amount: number; taxAmount: number }>();
    let totalTaxCollected = 0;

    orders.forEach((order: any) => {
      const date = new Date(order.createdAt);
      const hour = date.getHours();
      const dayKey = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const itemCount = (order.lines || []).length;
      const paymentMethod = (order.payments && order.payments.length > 0) ? (order.payments[0].paymentMethod || 'Unknown') : 'Unknown';

      totalTaxCollected += order.tax || 0;

      // By hour
      if (!salesByHour.has(hour)) {
        salesByHour.set(hour, { orders: 0, revenue: 0, items: 0 });
      }
      const hourData = salesByHour.get(hour)!;
      hourData.orders += 1;
      hourData.revenue += order.total || 0;
      hourData.items += itemCount;

      // By day
      if (!salesByDay.has(dayKey)) {
        salesByDay.set(dayKey, { orders: 0, revenue: 0, items: 0 });
      }
      const dayData = salesByDay.get(dayKey)!;
      dayData.orders += 1;
      dayData.revenue += order.total || 0;
      dayData.items += itemCount;

      // By payment method
      if (!salesByPaymentMethod.has(paymentMethod)) {
        salesByPaymentMethod.set(paymentMethod, { count: 0, amount: 0, taxAmount: 0 });
      }
      const methodData = salesByPaymentMethod.get(paymentMethod)!;
      methodData.count += 1;
      methodData.amount += order.total || 0;
      methodData.taxAmount += order.tax || 0;
    });

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

    // Build top products map
    const topProducts = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
    orders.forEach((order: any) => {
      (order.lines || []).forEach((line: any) => {
        const key = line.productId || 'unknown';
        if (!topProducts.has(key)) {
          topProducts.set(key, {
            id: line.productId || 'unknown',
            name: line.productName || 'Unknown Product',
            quantity: 0,
            revenue: 0,
          });
        }
        const prodData = topProducts.get(key)!;
        prodData.quantity += line.quantity || 1;
        prodData.revenue += line.unitPrice * (line.quantity || 1) || 0;
      });
    });

    const report = {
      summary: {
        totalOrders: orders.length,
        totalRevenue: totalRevenue,
        totalItems: orders.reduce((sum: number, o: any) => sum + ((o.lines || []).length || 1), 0),
        averageOrderValue: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
        totalTax: totalTaxCollected,
      },
      byHour: Array.from(salesByHour.entries()).map(([hour, data]) => ({
        hour,
        orders: data.orders,
        revenue: data.revenue,
        items: data.items,
      })),
      byDay: Array.from(salesByDay.entries()).map(([day, data]) => ({
        day,
        orders: data.orders,
        revenue: data.revenue,
        items: data.items,
      })),
      byPaymentMethod: Array.from(salesByPaymentMethod.entries()).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
        taxAmount: data.taxAmount,
      })),
      topProducts: Array.from(topProducts.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      orders: orders.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: o.total,
        subtotal: o.subtotal,
        tax: o.tax,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        items: (o.lines || []).length,
        discount: o.discountTotal || 0,
      })),
    };

    return NextResponse.json(
      successResponse({ data: report }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Sales report error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to generate sales report'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
