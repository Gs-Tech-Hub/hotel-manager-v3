/**
 * POS Reports API
 * 
 * GET /api/reports/pos - Fetch POS report data with filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/src/lib/date-filter';

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
    if (!userWithRoles) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Check permissions
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canViewReports = await checkPermission(permCtx, 'reports.read', 'reports');
    
    if (!canViewReports) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view reports'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentCode = searchParams.get('departmentCode');
    const paymentMethod = searchParams.get('paymentMethod');
    const orderStatus = searchParams.get('orderStatus');

    // Build date filter - note: buildDateFilter expects (fromDate, toDate) parameters
    const dateFilter = buildDateFilter(startDate, endDate);

    // Build where clause
    const where: any = {
      ...dateFilter,
    };

    if (departmentCode) {
      where.departments = {
        some: {
          code: departmentCode,
        },
      };
    }

    if (paymentMethod) {
      where.payments = {
        some: {
          paymentType: {
            type: paymentMethod,
          },
        },
      };
    }

    if (orderStatus) {
      where.status = orderStatus;
    }

    // Fetch orders with related data
    const orders = await prisma.orderHeader.findMany({
      where,
      include: {
        customer: true,
        departments: {
          include: {
            department: true,
          },
        },
        payments: {
          include: {
            paymentType: true,
          },
        },
        lines: true,
        fulfillments: true,
      },
    });

    // Calculate metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Group by status
    const ordersByStatus = orders.reduce(
      (acc, order) => {
        const status = order.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Group by payment method
    const ordersByPaymentMethod = orders.reduce(
      (acc, order) => {
        order.payments.forEach((payment) => {
          const method = payment.paymentType?.type || 'unknown';
          if (!acc[method]) {
            acc[method] = { count: 0, total: 0 };
          }
          acc[method].count += 1;
          acc[method].total += payment.amount || 0;
        });
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    // Group by department
    const ordersByDepartment = orders.reduce(
      (acc, order) => {
        order.departments.forEach((dept) => {
          const deptName = dept.department.name;
          if (!acc[deptName]) {
            acc[deptName] = { count: 0, total: 0 };
          }
          acc[deptName].count += 1;
          acc[deptName].total += order.total || 0;
        });
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    // Hourly breakdown
    const ordersByHour = orders.reduce(
      (acc, order) => {
        const hour = new Date(order.createdAt).getHours();
        if (!acc[hour]) {
          acc[hour] = { count: 0, total: 0 };
        }
        acc[hour].count += 1;
        acc[hour].total += order.total || 0;
        return acc;
      },
      {} as Record<number, { count: number; total: number }>
    );

    // Count items across orders
    const totalItems = orders.reduce((sum, order) => sum + (order.lines?.length || 0), 0);

    // Count completed orders
    const completedOrders = orders.filter((o) => o.status === 'completed').length;
    const fulfillmentRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    return NextResponse.json(
      successResponse({
        metrics: {
          totalOrders,
          totalRevenue,
          averageOrderValue,
          totalItems,
          completedOrders,
          fulfillmentRate,
        },
        ordersByStatus,
        ordersByPaymentMethod,
        ordersByDepartment,
        ordersByHour,
        orders: orders.slice(0, 100), // Return top 100 orders for detailed view
        filters: {
          startDate,
          endDate,
          departmentCode,
          paymentMethod,
          orderStatus,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('POS Reports Error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch POS reports'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}

