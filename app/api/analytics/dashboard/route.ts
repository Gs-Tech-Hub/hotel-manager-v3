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
import { buildDateFilter, buildBookingCheckinFilter, getTodayDate } from '@/lib/date-filter';

interface DashboardMetrics {
  salesData: {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalItems: number;
    byDepartment: Array<{ department: string; revenue: number; orders: number; items: number }>;
    topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
    dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  };
  taxData: {
    totalTaxCollected: number;
    taxBreakdown: Array<{ type: string; amount: number; percentage: number }>;
    byPaymentMethod: Array<{ method: string; amount: number; taxAmount: number }>;
  };
  userData: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    usersByRole: Array<{ role: string; count: number }>;
    newUsersThisPeriod: number;
  };
  employeeData: {
    totalEmployees: number;
    activeEmployees: number;
    onLeave: number;
    terminated: number;
    byDepartment: Array<{ department: string; count: number }>;
    salaryExpense: number;
    totalCharges: number;
    outstandingCharges: number;
    topEarners: Array<{ id: string; firstname: string; lastname: string; salary: number; salaryFrequency: string }>;
  };
  discountData: {
    totalDiscounts: number;
    discountAmount: number;
    discountPercentage: number;
    topDiscounts: Array<{ id: string; name: string; timesUsed: number; totalDiscount: number }>;
  };
  performanceMetrics: {
    peakHours: Array<{ hour: number; orders: number; revenue: number }>;
    topDays: Array<{ dayOfWeek: string; orders: number; revenue: number }>;
  };
  bookingData: {
    totalReservations: number;
    totalIncome: number;
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
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');
    const timezone = searchParams.get('timezone') || 'UTC';

    // Default to today's date if no dates provided (consistent with section filtering)
    // 24 hours = today
    const today = getTodayDate();
    if (!startDate && !endDate) {
      startDate = today;
      endDate = today;
    } else if (startDate && !endDate) {
      // If only start date provided, default end date to today
      endDate = today;
    } else if (!startDate && endDate) {
      // If only end date provided, default start date to today
      startDate = today;
    }

    console.log(`[DASHBOARD] Date filtering - startDate=${startDate}, endDate=${endDate}, timezone=${timezone}, today=${today}`);

    // Build date filters - use createdAt for orders, checkin for bookings
    const dateFilter = buildDateFilter(startDate, endDate);
    const bookingDateFilter = buildBookingCheckinFilter(startDate, endDate);
    
    console.log(`[DASHBOARD] Built dateFilter:`, JSON.stringify(dateFilter, null, 2));

    // Fetch all data in parallel
    const [orderHeaders, orderPayments, employees, customers, discounts, bookings] = await Promise.all([
      (prisma as any).orderHeader.findMany({
        where: {
          ...dateFilter,
          status: {
            in: ['fulfilled', 'completed'],
          },
        },
        include: {
          payments: true,
          lines: {
            include: {
              departmentSection: true,
            },
          },
        },
      }),
      (prisma as any).orderPayment.findMany({
        where: {
          ...dateFilter,
          paymentStatus: 'completed',
        },
      }),
      (prisma as any).pluginUsersPermissionsUser.findMany({
        include: {
          employmentData: true,
        },
      }),
      (prisma as any).customer.findMany({
        where: {
          NOT: {
            OR: [
              { firstName: 'Guest', lastName: 'Customer' },
              { email: { contains: 'guest+', mode: 'insensitive' } },
            ],
          },
        },
      }),
      (prisma as any).discountRule.findMany(),
      (prisma as any).booking.findMany({
        where: {
          ...bookingDateFilter,
        },
        include: {
          payment: true,
        },
      }),
    ]);

    // Calculate sales data - count paid orders (those with sufficient payments)
    let totalRevenue = 0;
    let totalPaidOrders = 0;
    let totalFulfilledOrders = 0;

    console.log(`[DASHBOARD] Processing ${orderHeaders.length} orders with status fulfilled/completed`);

    for (const order of orderHeaders) {
      const totalPaid = (order.payments || []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
      const isPaid = totalPaid >= order.total && order.total > 0;
      
      console.log(`[DASHBOARD] Order ${order.id}: status=${order.status}, total=${order.total}, totalPaid=${totalPaid}, isPaid=${isPaid}, createdAt=${order.createdAt}`);
      
      if (isPaid) {
        totalPaidOrders += 1;
        totalRevenue += order.total;
      }
      
      if (order.status === 'fulfilled') {
        totalFulfilledOrders += 1;
      }
    }
    
    console.log(`[DASHBOARD] Sales Data - totalPaidOrders=${totalPaidOrders}, totalRevenue=${totalRevenue}`);

    // Calculate booking data
    const totalReservations = bookings.length;
    
    // Calculate booking payment income from bookings with completed payments
    let totalPaymentIncome = 0;
    for (const booking of bookings) {
      if (booking.payment && booking.payment.paymentStatus === 'completed') {
        totalPaymentIncome += booking.payment.totalPrice ?? 0;
        // Add booking income to total revenue
        totalRevenue += booking.payment.totalPrice ?? 0;
      }
    }

    // Calculate employee data
    const activeEmployees = employees.filter((e: any) => e.employmentData && (e.employmentData as any).employmentStatus === 'active').length;
    const totalEmployees = employees.length;
    const terminatedEmployees = employees.filter((e: any) => e.employmentData && (e.employmentData as any).employmentStatus === 'terminated').length;

    // Calculate total salary expense
    const totalSalaryExpense = employees.reduce((sum: number, e: any) => {
      if (e.employmentData) {
        const salary = (e.employmentData as any).salary || 0;
        return sum + (typeof salary === 'string' ? parseFloat(salary) : salary);
      }
      return sum;
    }, 0);

    // Group sales by department and daily
    const byDepartment = new Map<string, { revenue: number; orders: number; items: number }>();
    const dailyRevenue = new Map<string, { revenue: number; orders: number }>();
    let totalItems = 0;

    orderHeaders.forEach((order: any) => {
      const dept = order.departmentCode || 'uncategorized';
      const date = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const items = (order.lines || []).length;
      
      totalItems += items;

      // By department
      if (!byDepartment.has(dept)) {
        byDepartment.set(dept, { revenue: 0, orders: 0, items: 0 });
      }
      const deptData = byDepartment.get(dept)!;
      deptData.revenue += order.total || 0;
      deptData.orders += 1;
      deptData.items += items;

      // By day
      if (!dailyRevenue.has(date)) {
        dailyRevenue.set(date, { revenue: 0, orders: 0 });
      }
      const dayData = dailyRevenue.get(date)!;
      dayData.revenue += order.total || 0;
      dayData.orders += 1;
    });

    // Group employees by department
    const empByDepartment = new Map<string, number>();
    employees.forEach((e: any) => {
      if (e.employmentData) {
        const dept = (e.employmentData as any).department || 'unassigned';
        empByDepartment.set(dept, (empByDepartment.get(dept) || 0) + 1);
      }
    });

    // Calculate payment method breakdown
    const byPaymentMethod = new Map<string, { amount: number; taxAmount: number }>();
    orderPayments.forEach((payment: any) => {
      const method = payment.paymentMethod || 'unknown';
      if (!byPaymentMethod.has(method)) {
        byPaymentMethod.set(method, { amount: 0, taxAmount: 0 });
      }
      const methodData = byPaymentMethod.get(method)!;
      methodData.amount += payment.amount || 0;
    });

    // Calculate total charges for employees
    const totalCharges = employees.reduce((sum: number, e: any) => {
      if (e.employmentData) {
        const charges = (e.employmentData as any).totalCharges || 0;
        return sum + (typeof charges === 'string' ? parseFloat(charges) : charges);
      }
      return sum;
    }, 0);

    const outstandingCharges = employees.reduce((sum: number, e: any) => {
      if (e.employmentData) {
        const total = (e.employmentData as any).totalCharges || 0;
        const paid = (e.employmentData as any).totalPaid || 0;
        const outstanding = (typeof total === 'string' ? parseFloat(total) : total) - (typeof paid === 'string' ? parseFloat(paid) : paid);
        return sum + Math.max(0, outstanding);
      }
      return sum;
    }, 0);

    // Build response with full metrics
    const metrics: DashboardMetrics = {
      salesData: {
        totalRevenue,
        totalOrders: totalPaidOrders,
        averageOrderValue: totalPaidOrders > 0 ? Math.round(totalRevenue / totalPaidOrders) : 0,
        totalItems,
        byDepartment: Array.from(byDepartment.entries()).map(([dept, data]) => ({
          department: dept,
          revenue: data.revenue,
          orders: data.orders,
          items: data.items,
        })),
        topProducts: [],
        dailyRevenue: Array.from(dailyRevenue.entries()).map(([date, data]) => ({
          date,
          revenue: data.revenue,
          orders: data.orders,
        })),
      },
      taxData: {
        totalTaxCollected: orderHeaders.reduce((sum: number, o: any) => sum + (o.tax || 0), 0),
        taxBreakdown: [],
        byPaymentMethod: Array.from(byPaymentMethod.entries()).map(([method, data]) => ({
          method,
          amount: data.amount,
          taxAmount: data.taxAmount,
        })),
      },
      userData: {
        totalUsers: customers?.length || 0,
        activeUsers: customers?.length || 0,
        blockedUsers: 0,
        usersByRole: [],
        newUsersThisPeriod: 0,
      },
      employeeData: {
        totalEmployees,
        activeEmployees,
        onLeave: 0,
        terminated: terminatedEmployees,
        byDepartment: Array.from(empByDepartment.entries()).map(([dept, count]) => ({
          department: dept,
          count,
        })),
        salaryExpense: totalSalaryExpense,
        totalCharges: Math.round(totalCharges * 100) / 100, // Convert to decimal
        outstandingCharges: Math.round(outstandingCharges * 100) / 100,
        topEarners: [],
      },
      discountData: {
        totalDiscounts: discounts?.length || 0,
        discountAmount: discounts?.reduce((sum: number, d: any) => sum + (d.discountAmount || 0), 0) || 0,
        discountPercentage: 0,
        topDiscounts: [],
      },
      performanceMetrics: {
        peakHours: [],
        topDays: [],
      },
      bookingData: {
        totalReservations,
        totalIncome: totalPaymentIncome,
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
