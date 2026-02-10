/**
 * Analytics Dashboard API
 * Provides comprehensive dashboard data: sales, tax, users, employees
 * 
 * GET /api/analytics/dashboard?startDate=2024-01-01&endDate=2024-12-31&timezone=UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { extractUserContext, loadUserWithRoles, hasAnyRole } from '@/lib/user-context';
import { checkPermission, type PermissionContext } from '@/lib/auth/rbac';
import { successResponse, errorResponse, ErrorCodes, getStatusCode } from '@/lib/api-response';
import { buildDateFilter } from '@/lib/date-filter';

interface DashboardMetrics {
  salesData: {
    totalRevenue: number;
    totalOrders: number;
  };
  bookingData: {
    totalReservations: number;
  };
  employeeData: {
    activeEmployees: number;
  };
}

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

    // Check permissions - require dashboard access
    const permCtx: PermissionContext = {
      userId: ctx.userId,
      userType: (userWithRoles.isAdmin ? 'admin' : hasAnyRole(userWithRoles, ['admin', 'manager', 'staff']) ? 'employee' : 'other') as 'admin' | 'employee' | 'other',
    };

    const canViewDashboard = await checkPermission(permCtx, 'dashboard.read', 'dashboard');
    
    if (!canViewDashboard) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, 'Insufficient permissions to view analytics'),
        { status: getStatusCode(ErrorCodes.FORBIDDEN) }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const timezone = searchParams.get('timezone') || 'UTC';

    // Build date filter
    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch all data in parallel
    const [orders, payments, employees, newUsers, discounts, taxSettings, bookings] = await Promise.all([
      prisma.order.findMany({
        where: {
          ...dateFilter,
          orderStatus: {
            in: ['paid', 'fulfilled', 'completed'],
          },
        },
      }),
      prisma.payment.findMany({
        where: {
          ...dateFilter,
        },
      }),
      prisma.pluginUsersPermissionsUser.findMany({
        include: {
          employmentData: true,
          employeeRecords: true,
        },
      }),
      prisma.pluginUsersPermissionsUser.findMany({
        where: {
          ...dateFilter,
        },
      }),
      prisma.discountRule.findMany(),
      prisma.taxSettings.findFirst(),
      prisma.booking.findMany({
        where: {
          ...dateFilter,
        },
      }),
    ]);

    // Calculate sales data
    const totalRevenue = Math.round((orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)) * 100);
    const totalOrders = orders.length;

    // Calculate booking data
    const totalReservations = bookings.length;

    // Calculate employee data
    const activeEmployees = employees.filter((e: any) => e.employmentData && (e.employmentData as any).employmentStatus === 'active').length;

    // Build response - simplified for dashboard stats
    const metrics: DashboardMetrics = {
      salesData: {
        totalRevenue,
        totalOrders,
      },
      bookingData: {
        totalReservations,
      },
      employeeData: {
        activeEmployees,
      },
    };

    return NextResponse.json(
      successResponse({ data: metrics }),
      { status: 200 }
    );

  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch dashboard data'),
      { status: getStatusCode(ErrorCodes.INTERNAL_ERROR) }
    );
  }
}
