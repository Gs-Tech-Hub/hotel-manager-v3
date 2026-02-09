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
    averageOrderValue: number;
    totalItems: number;
    byDepartment: Array<{
      department: string;
      revenue: number;
      orders: number;
      items: number;
    }>;
    topProducts: Array<{
      id: string;
      name: string;
      quantity: number;
      revenue: number;
    }>;
    dailyRevenue: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
  };
  taxData: {
    totalTaxCollected: number;
    taxBreakdown: Array<{
      type: string;
      amount: number;
      percentage: number;
    }>;
    byPaymentMethod: Array<{
      method: string;
      amount: number;
      taxAmount: number;
    }>;
  };
  userData: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    usersByRole: Array<{
      role: string;
      count: number;
    }>;
    newUsersThisPeriod: number;
  };
  employeeData: {
    totalEmployees: number;
    activeEmployees: number;
    onLeave: number;
    terminated: number;
    byDepartment: Array<{
      department: string;
      count: number;
    }>;
    salaryExpense: number;
    totalCharges: number;
    outstandingCharges: number;
    topEarners: Array<{
      id: string;
      firstname: string;
      lastname: string;
      salary: number;
      salaryFrequency: string;
    }>;
  };
  discountData: {
    totalDiscounts: number;
    discountAmount: number;
    discountPercentage: number;
    topDiscounts: Array<{
      id: string;
      name: string;
      timesUsed: number;
      totalDiscount: number;
    }>;
  };
  performanceMetrics: {
    peakHours: Array<{
      hour: number;
      orders: number;
      revenue: number;
    }>;
    topDays: Array<{
      dayOfWeek: string;
      orders: number;
      revenue: number;
    }>;
    customerSatisfaction?: number;
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
    const [orders, payments, employees, newUsers, discounts, taxSettings] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: dateFilter,
        },
      }),
      prisma.payment.findMany({
        where: {
          createdAt: dateFilter,
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
          createdAt: dateFilter,
        },
      }),
      prisma.discountRule.findMany(),
      prisma.taxSettings.findFirst(),
    ]);

    // Calculate sales data
    const totalRevenue = Math.round((orders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)) * 100);
    const totalOrders = orders.length;
    const totalItems = totalOrders;
    const averageOrderValue = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) / 100) * 100 : 0;

    // Group by department
    const byDepartment = orders.reduce((acc: any, order: any) => {
      const dept = order.department || 'Uncategorized';
      if (!acc[dept]) {
        acc[dept] = { department: dept, revenue: 0, orders: 0, items: 0 };
      }
      acc[dept].revenue += Math.round((order.total || 0) * 100);
      acc[dept].orders += 1;
      acc[dept].items += 1;
      return acc;
    }, {});

    // Calculate tax data
    const totalTaxCollected = payments.reduce((sum: number, p: any) => sum + (p.taxAmount || 0), 0);
    const byPaymentMethod = payments.reduce((acc: any, payment: any) => {
      const method = payment.paymentType?.name || 'Unknown';
      if (!acc[method]) {
        acc[method] = { method, amount: 0, taxAmount: 0 };
      }
      acc[method].amount += payment.amount || 0;
      acc[method].taxAmount += payment.taxAmount || 0;
      return acc;
    }, {});

    // Calculate user data
    const totalUsers = await prisma.pluginUsersPermissionsUser.count();
    const activeUsers = employees.filter((e: any) => !e.blocked).length;
    const blockedUsers = employees.filter((e: any) => e.blocked).length;
    const newUsersThisPeriod = newUsers.length;

    // User by role
    const usersByRole = employees.reduce((acc: any, emp: any) => {
      if (!acc['Staff']) {
        acc['Staff'] = { role: 'Staff', count: 0 };
      }
      acc['Staff'].count += 1;
      return acc;
    }, {});

    // Calculate employee data
    const activeEmployees = employees.filter((e: any) => e.employmentData && (e.employmentData as any).employmentStatus === 'active').length;
    const onLeave = 0;
    const terminated = employees.filter((e: any) => e.employmentData && (e.employmentData as any).employmentStatus === 'terminated').length;

    const salaryExpense = employees.reduce((sum: number, emp: any) => {
      if (emp.employmentData) {
        const salary = (emp.employmentData as any).salary || 0;
        return sum + (typeof salary === 'string' ? parseFloat(salary) : salary);
      }
      return sum;
    }, 0);

    const totalCharges = 0;
    const outstandingCharges = 0;

    // Calculate discount data
    const totalDiscounts = discounts.length;
    const discountAmount = 0;
    const discountPercentage = 0;

    // Build response
    const metrics: DashboardMetrics = {
      salesData: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalItems,
        byDepartment: Object.values(byDepartment),
        topProducts: [], // Will be populated below
        dailyRevenue: [], // Will be populated below
      },
      taxData: {
        totalTaxCollected,
        taxBreakdown: [
          {
            type: 'Standard Tax',
            amount: totalTaxCollected,
            percentage: 100,
          },
        ],
        byPaymentMethod: Object.values(byPaymentMethod),
      },
      userData: {
        totalUsers,
        activeUsers,
        blockedUsers,
        usersByRole: Object.values(usersByRole),
        newUsersThisPeriod,
      },
      employeeData: {
        totalEmployees: employees.length,
        activeEmployees,
        onLeave,
        terminated,
        byDepartment: employees.reduce((acc: any, emp: any) => {
          const dept = (emp.employmentData as any)?.department || 'Uncategorized';
          if (!acc[dept]) {
            acc[dept] = { department: dept, count: 0 };
          }
          acc[dept].count += 1;
          return acc;
        }, {}),
        salaryExpense,
        totalCharges,
        outstandingCharges,
        topEarners: employees
          .filter((e: any) => e.employmentData)
          .sort((a: any, b: any) => {
            const salaryA = typeof (a.employmentData as any).salary === 'string' ? parseFloat((a.employmentData as any).salary) : (a.employmentData as any).salary;
            const salaryB = typeof (b.employmentData as any).salary === 'string' ? parseFloat((b.employmentData as any).salary) : (b.employmentData as any).salary;
            return salaryB - salaryA;
          })
          .slice(0, 5)
          .map((e: any) => ({
            id: e.id,
            firstname: e.firstname || '',
            lastname: e.lastname || '',
            salary: typeof (e.employmentData as any).salary === 'string' ? parseFloat((e.employmentData as any).salary) : (e.employmentData as any).salary,
            salaryFrequency: (e.employmentData as any).salaryFrequency || 'monthly',
          })),
      },
      discountData: {
        totalDiscounts,
        discountAmount,
        discountPercentage,
        topDiscounts: discounts
          .map((d: any) => ({
            id: d.id,
            name: d.name,
            timesUsed: 0,
            totalDiscount: 0,
          }))
          .sort((a: any, b: any) => b.timesUsed - a.timesUsed)
          .slice(0, 5),
      },
      performanceMetrics: {
        peakHours: [],
        topDays: [],
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
